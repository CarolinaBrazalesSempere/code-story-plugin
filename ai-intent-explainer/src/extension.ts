import * as vscode from 'vscode';

// Called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  // Register the chat participant
  const participant = vscode.chat.createChatParticipant('ai-intent.chat', handleChat);

  // Optionally set an icon for the participant
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'res', 'icon_chat_240.png');

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

  try {
    // Select the language model
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });

    if (models.length === 0) {
      throw new Error('No suitable chat models available. Please ensure you have access to Copilot models.');
    }

    const model = models[0];
    
    // Create the prompt
    const prompt = [
      vscode.LanguageModelChatMessage.User(
        'You are a helpful assistant that explains Git commits in a clear and concise manner. ' +
        'Please explain the following Git commit in detail, including what changed and why. ' +
        'Format your response in markdown.\n\n' +
        '```\n' + request.prompt.trim() + '\n```'
      )
    ];
    
    // Send the request and stream the response
    const response = await model.sendRequest(prompt, {}, token);
    
    // Stream the response back to the chat
    for await (const chunk of response.stream) {
      if (typeof chunk === 'string') {
        stream.markdown(chunk);
      } else if (chunk && typeof chunk === 'object' && 'value' in chunk) {
        // Handle chunk objects with a 'value' property
        const chunkValue = (chunk as { value: string }).value;
        if (typeof chunkValue === 'string') {
          stream.markdown(chunkValue);
        } else {
          console.warn('Chunk value is not a string:', chunkValue);
        }
      } else {
        console.warn('Received unexpected chunk format:', chunk);
      }
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    stream.markdown('**Error:** Unable to process your request. Please try again later.');
  }
};

// Called when your extension is deactivated
export function deactivate() {}