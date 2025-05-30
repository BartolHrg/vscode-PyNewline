import * as assert from "assert";

// You can import and use all API from the "vscode" module
// as well as import your extension to test it
import * as vscode from "vscode";
import { Inserter } from "../extension";
// import * as myExtension from "../../extension";

let text_editor: Exclude<typeof vscode.window.activeTextEditor, undefined>;
async function prepare() {
	//	const p = new Promise(res => vscode.workspace.onDidOpenTextDocument(res));
	const doc = await vscode.workspace.openTextDocument({ language: "python", content: "print();" });
	//	await p;
	await new Promise(res => setTimeout(res, 2000)); // vscode doesn't open doc even though it's awaited
	text_editor = vscode.window.activeTextEditor!;
	
	//	await text_editor.edit(builder => {
	//		builder.insert(new vscode.Position(0, 0), active_line);
	//	});
}

function normalizeString(str: string): string {
	return str.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

async function setContents(before_cursor: string, after_cursor: string) {
	before_cursor = normalizeString(before_cursor);
	 after_cursor = normalizeString( after_cursor);
	
	const p0 = new vscode.Position(0, 0);
	
	await text_editor.edit(builder => {
		builder.insert(p0, before_cursor + after_cursor + "\n");
	});
	let lines_count = 0;
	let last_n = 0;
	for (let i = 0; i < before_cursor.length; i++) {
		if (before_cursor[i] === "\n") {
			++lines_count;
			last_n = i + 1;
		}
	}
	const pos = new vscode.Position(lines_count, before_cursor.length - last_n);
	text_editor.selection = new vscode.Selection(pos, pos);
}
function getContents(max_length?: number): string {
	const content = normalizeString(text_editor.document.getText());
	if (max_length !== undefined) { 
		return content.slice(0, max_length); 
	} else {
		return content;
	}
}


suite("Inserter Tests", function () {
	this.timeout(5000);
	vscode.window.showInformationMessage("Start all tests.");
	
	const parser = new Inserter();
	
	this.beforeAll(prepare);

	test("insert after colon", async () => {
		await setContents("\tdef f():", "# cur\n end");
		const expected = "\tdef f():\n\t\t# cur\n\tpass\n end";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});
	test("insert after paren", async () => {
		await setContents("\t[something", "]");
		const expected =  "\t[something\n\t\t\n\t]";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});

	test("dont insert after inline colon", async () => {
		await setContents("\tdef f(): something", " end");
		const expected =  "\tdef f(): something\n\t end";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});
	test("dont insert after closed paren", async () => {
		await setContents("\t[something]", "]");
		const expected =  "\t[something]\n\t]";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});

	test("dont insert after string", async () => {
		await setContents("\t'['something", "]");
		const expected =  "\t'['something\n\t]";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});

	test("dont insert after comment - colon", async () => {
		await setContents("\tdef f()#:", " end");
		const expected =  "\tdef f()#:\n\t end";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});
	test("dont insert after comment - paren", async () => {
		await setContents("\t#[something", "]");
		const expected =  "\t#[something\n\t]";
		const inserter = new Inserter();
		
		await inserter.processNewline();
		
		const result = getContents(expected.length);
		assert.strictEqual(result, expected);
	});
});
