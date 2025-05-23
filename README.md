# README
Extension for inserting newlines in python.  

I have specific coding style for python:  
I use tabs, semicolons, and pass to close scope.  
So example program would be:  
```py
class A:
	def f():
		if (False
			or a
			or b
		): doSomething();
	pass
pass
```

But Pylance can't handle that:  
When entering a newline, it randomly erases indentation.  

## Usage

Just install it.  
It will create keybinding for `enter` when in Python file  
(i.e. with condition `editorTextFocus && !editorReadonly && editorLangId == 'python'`)  

## Source

my:  
* GitHub https://github.com/BartolHrg/vscode-PyNewline
* Visual Studio Marketplace https://marketplace.visualstudio.com/items?itemName=BartolHrg.pynewline
