import * as vscode from 'vscode';
import { sendChatParticipantRequest } from '@vscode/chat-extension-utils';

// Called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  // Register the chat participant
  const participant = vscode.chat.createChatParticipant('ai-intent.chat', handleChat);

  // Optionally set an icon for the participant
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icon.png');

  // Register the sayHello command for a popup
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.sayHelloAigerim', () => {
      vscode.window.showInformationMessage('Hello, Aigerim!');
    })
  );
}

// This handles all chat requests directed at your participant
const handleChat: vscode.ChatRequestHandler = async (
  request,
  chatContext,
  stream,
  token
) => {
  console.log('➡️ handleChat:', { command: request.command, prompt: request.prompt });
  // Handle the /sayHello command
  if (request.command === 'sayHello') {
    stream.markdown('**Hello, Aigerim!** 👋');
    return;
  }

    // 3) Real AI path: explain any commit text the user provided
    const result = await sendChatParticipantRequest(
      request,
      chatContext,
      {
        prompt: `Explain this Git commit:\n\`\`\`\n${request.prompt.trim()}\n\`\`\`\n`,
        responseStreamOptions: { stream, references: false, responseText: true }
      },
      token
    );
    return result.result;
};

// Called when your extension is deactivated
export function deactivate() {}