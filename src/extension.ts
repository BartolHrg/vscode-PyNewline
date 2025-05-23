'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

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

		const selections: readonly vscode.Selection[] = text_editor.selections;
		this.log("selections length:", selections.length);
		if (selections.length === 0) { return; }
		this.log("selections: ", selections.map(sel => `(${sel.start.line}:${sel.start.character}-${sel.end.line}:${sel.end.character})`).slice(0, 3));
		
		const sorted = selections.map(x => x);
		sorted.sort((a, b) => a.start.compareTo(b.start));
		
		const indents: string[] = [];
		let line_difference = 0;
		const new_selections = sorted.map((sel, index) => {
			const line_index = sel.start.line;
			const line = text_editor.document.getText(new vscode.Range(
				new vscode.Position(line_index    , 0), 
				new vscode.Position(line_index + 1, 0), 
			));
			this.log("line:", line);
			
			let diff_diff = 1;
			
			const max = sel.start.character;
			let base_indent = this.getIndent(line, max);
			let indent = base_indent;
			let active_index = base_indent.length;
			
			let stack = 0;
			let colon = /:\s*\\?$/.test(line.slice(0, max));
			for (let i = 0; i < max; i++) {
				const c = line.charAt(i);
				if      (/^[\(\[\{]$/.test(c)) { ++stack; }
				else if (/^[\)\]\}]$/.test(c)) { --stack; }
			}
			this.log("shouldIndent info:", [stack, colon]);
			if (stack > 0) {
				indent = base_indent + "\t\n" + base_indent;
				active_index += 1;
				diff_diff = 2;
			} else if (colon) {
				indent = base_indent + "\t\n" + base_indent + "pass";
				active_index += 1;
			}
			
			this.log("indent:", indent);
			indents.push(indent);
			const position = new vscode.Position(line_index + 1 + line_difference, active_index);
			line_difference += diff_diff + sel.start.line - sel.end.line;
			return new vscode.Selection(position, position);
		});
		
		await text_editor.edit((builder) => {
			for (const [sel, indent] of zip(sorted, indents)) {
				builder.replace(sel, "\n" + indent);
			}
		});
		// vscode.window.showInformationMessage(JSON.stringify(new_selections));
		text_editor.selections = new_selections;

	}
	
	private log(prefix: string, msg: any) {
		//	this.logger.appendLine(prefix + " " + JSON.stringify(msg));
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

