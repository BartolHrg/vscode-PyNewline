'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Selection, Position, Range } from 'vscode';

function* zip<T extends any[]>(...iterables: { [K in keyof T]: Iterable<T[K]> }): Generator<T> {
	const iterators = iterables.map(iterable => iterable[Symbol.iterator]());
	while (true) {
		const results = iterators.map(iterator => iterator.next());
		if (results.some(result => result.done)) { break; }
		yield results.map(result => result.value) as T;
	}
}

export class Inserter {
	private logger = vscode.window.createOutputChannel("PyNewline log");
	public async processNewline() {
		//	this.logger.show(true);
		const text_editor = vscode.window.activeTextEditor;
		this.log("we have text editor:", text_editor !== undefined);
		if (text_editor === undefined) { return; }

		const selections: readonly Selection[] = text_editor.selections;
		this.log("selections length:", selections.length);
		if (selections.length === 0) { return; }
		this.log("selections: ", selections.map(sel => `(${sel.start.line}:${sel.start.character}-${sel.end.line}:${sel.end.character})`).slice(0, 3));
		
		const sort_key = this.getSortKey(selections);
		
		const edits: Array<[Range, string]> = [];
		const indents: string[] = [];
		let line_difference = 0;
		const new_sorted = sort_key.map(index => {
			const sel = selections[index];
			const line_index = sel.start.line;
			const line = text_editor.document.getText(new Range(
				new Position(line_index    , 0), 
				new Position(line_index + 1, 0), 
			));
			const next_line = text_editor.document.getText(new Range(
				new Position(sel.end.line + 1, 0),
				new Position(sel.end.line + 2, 0),
			));
			this.log("line:", line);
			this.log("next:", next_line);
			
			
			let diff_diff;
			
			const max = sel.start.character;
			const indent_type = this.getShouldIndent(line, max);
			let base_indent = this.getIndent(line, max);
			let indent = base_indent + "\t";
			let index_character: number;
			
			switch (indent_type) {
				case false: {
					edits.push([sel, "\n" + base_indent]);
					//	@+1, +base_indent.length
					//	 +1, +base_indent.length
					index_character = base_indent.length;
					diff_diff = 1;
				} break;
				case "open":
				case "string": {
					edits.push([sel, "\n" + indent + "\n" + base_indent]);
					//	would be too hard to analyze next line, so whatever
					//	@+1, +indent.length
					//	 +2, +base_indent.length
					index_character = indent.length;
					diff_diff = 2;
				} break;
				case "colon": {
					const additional_range = new Range(sel.end, sel.end.translate(1).with(undefined, 0));
					this.log("sel:", sel);
					let   additional_line = text_editor.document.getText(additional_range);
					if (additional_line.endsWith("\r")) { additional_line = additional_line.slice(0, -1); }
					if (additional_line.endsWith("\n")) { additional_line = additional_line.slice(0, -1); }
					if (additional_line.endsWith("\r")) { additional_line = additional_line.slice(0, -1); }
					if (additional_line.endsWith("\n")) { additional_line = additional_line.slice(0, -1); }
					this.log("additi lin:", additional_line);
					const edit_range = new Range(sel.start, sel.end.translate(0, additional_line.length));
					let closer = base_indent + "pass";
					if (next_line.startsWith(closer) || next_line.startsWith(indent)) {
						closer = "";
						diff_diff = 1;
					} else {
						closer = "\n" + closer;
						diff_diff = 2;
					}
					edits.push([edit_range, "\n" + indent + additional_line + closer ]);
					//	@+1, +indent.length
					//	 +2, +base_indent.length + 4
					index_character = indent.length;
				}
			}
			
			this.log("indent:", indent);
			indents.push(indent);
			const position = new Position(line_index + 1 + line_difference, index_character);
			line_difference += diff_diff + sel.start.line - sel.end.line;
			return new Selection(position, position);
		});
		
		const new_selections = this.unsort(new_sorted, sort_key);
		
		await text_editor.edit((builder) => {
			for (const [range, str] of edits) {
				builder.replace(range, str);
			}
		});
		// vscode.window.showInformationMessage(JSON.stringify(new_selections));
		text_editor.selections = new_selections;
	}
	
	private log(prefix: string, msg: any) {
		this.logger.appendLine(prefix + " " + JSON.stringify(msg));
	}
	
	private getIndent(line: string, max: number): string {
		let endex = 0;
		while (endex < max) {
			const c = line.charAt(endex);
			if (c === " " || c === "\t") {
				++endex;
			} else {
				break;
			}
		}
		return line.slice(0, endex);
	}
	private getSortKey(selections: readonly Selection[]): number[] {
		return selections.map((s, i) => i).sort((a, b) => selections[a].start.compareTo(selections[b].start));
	}
	private unsort(sorted: Selection[], sort_key: number[]): Selection[] {
		const result = Array<Selection>(sorted.length);
		for (let i = 0; i < sort_key.length; ++i) {
			result[sort_key[i]] = sorted[i];
		}
		return result;
	}
	private getShouldIndent(line: string, max: number): false | "colon" | "string" | "open" {
		line = line.slice(0, max); 
		if (line.endsWith("\\")) { line = line.slice(0, -1); }
		const x = this.getStringsAndComment(line);
		if (x === "string") { return x; }
		const [strings, comment] = x;
		this.log("comment", [comment, line.length]);
		if (line.slice(0, comment).trimEnd().endsWith(":")) { return "colon"; }
		const inString = (i: number) => strings.some(([a, b]) => a < i && i < b);
		const stack: string[] = [];
		for (let i = 0; i < comment; ++i) {
			if (inString(i)) { continue; }
			const c = line[i];
			switch (c) {
				case "(": stack.push(")"); break;
				case "[": stack.push("]"); break;
				case "{": stack.push("}"); break;
				case ")": if (stack.length > 0) { if (stack.pop() !== c) { return false; } } break;
				case "]": if (stack.length > 0) { if (stack.pop() !== c) { return false; } } break;
				case "}": if (stack.length > 0) { if (stack.pop() !== c) { return false; } } break;
			}
		}
		if (stack.length > 0) { return "open"; }
		return false;
	}
	private getStringsAndComment(line: string): [Array<[number, number]>, number] | "string" {
		const quotes: Array<[string, number]> = [];
		//	const comments: number[] = [];
		for (let i = 0; i < line.length; ++i) {
			const c = line[i];
			//	if (c === "#") { comm}
			if (!`"'`.includes(c)) { continue; }
			let count_backslash = 0;
			for (let j = i - 1; j >= 0 && line[j] === "\\"; --j) { ++count_backslash; }
			if (count_backslash % 2 === 0) { quotes.push([c, i]); }
		}
		const result: Array<[number, number]> = [];
		let unpaired = false;
		while (quotes.length > 0) {
			const [quote_a, index_a] = quotes.shift()!;
			while (true) {
				if (quotes.length === 0) { unpaired = true; break; }
				const [quote_b, index_b] = quotes.shift()!;
				if (quote_a === quote_b) {
					result.push([index_a, index_b]);
					break;
				}
			}
		}
		let comment = line.length;
		for (let i = 0; i < line.length; ++i) {
			const c = line[i];
			if (result.some(([a, b]) => a < i && i < b)) { continue; }
			if (c === "#") {
				comment = i;
				unpaired = false;
				break;
			}
		}
		if (unpaired) { return "string"; }
		return [result, comment];
	}

	public dispose() {
		// this._settings.dispose();
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//console.log('Congratulations, your extension "insertnumbers" is now active!');
	// console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	const inserter = new Inserter();
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	/* 
	
	      {
        "command": "pynewline.pyNewline",
        "title": "PyNewline"
      },
      {
        "command": "pynewline.pyNewlineBefore",
        "title": "PyNewlineBefore"
      },
      {
        "command": "pynewline.pyNewlineAfter",
        "title": "PyNewlineAfter"
      }

	*/
	context.subscriptions.push(vscode.commands.registerCommand('pynewline.pyNewline', async () => {
		await inserter.processNewline();
	}));
	context.subscriptions.push(inserter);
	// console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
}

// this method is called when your extension is deactivated
export function deactivate() {
	// console.log("dddddddddddddddddddddddddddddd");
}

