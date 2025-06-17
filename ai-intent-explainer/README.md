AI Intent Explainer

A VS Code Chat extension that leverages AI to explain developer intent behind Git commits.

Features
	•	@ai-intent /sayHello
Greets the user with “Hello, Aigerim! 👋”.
	•	@ai-intent /explainCommit <message or hash>
Analyzes a Git commit message or hash and explains:
	1.	What changed
	2.	Why it was done
	3.	Any potential impact or follow-up needed

Getting Started
	1.	Clone the repository

git clone https://github.com/<your-username>/ai-intent-explainer.git
cd ai-intent-explainer


	2.	Install dependencies

npm install


	3.	Compile the extension

npm run compile


	4.	Launch in VS Code
	•	Open the folder in VS Code.
	•	Press F5 (or go to Run & Debug → Launch Extension).
	5.	Use the commands in the Chat panel:

@ai-intent /sayHello
@ai-intent /explainCommit Refactored login flow for async validation



Packaging & Publishing

Package

Install the VS Code Extension CLI (vsce) and package your extension:

npm install --global vsce
vsce package
# This generates ai-intent-explainer-0.0.1.vsix

Publish to GitHub
	1.	Commit and push your code to GitHub.
	2.	On your GitHub repository, go to Releases and create a new release.
	3.	Upload the .vsix file as a release asset and tag it with the version (e.g., v0.0.1).

Publish to the VS Code Marketplace
	1.	Ensure you have a publisher account on the Visual Studio Marketplace.
	2.	Authenticate with vsce:

vsce login <your-publisher-name>


	3.	Publish your extension:

vsce publish



⸻

Happy coding!