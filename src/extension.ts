import * as vscode from 'vscode';
import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { BlameInfo, PromptInfo } from './interfaces';

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

function getCurrentFileAndLine(): { filePath: string; lineNumber: number } | null {
  const activeEditor = vscode.window.activeTextEditor;
  
  if (!activeEditor) {
    return null;
  }
  
  const document = activeEditor.document;
  const selection = activeEditor.selection;
  
  // Get the current cursor position (line is 0-based, so we add 1)
  const lineNumber = selection.active.line + 1;
  const filePath = document.uri.fsPath;
  
  return {
    filePath,
    lineNumber
  };
}

async function findGitRepository(filePath: string): Promise<string | null> {
  try {
    const absoluteFilePath = path.resolve(filePath);
    let currentDir = path.dirname(absoluteFilePath);
    
    while (currentDir !== path.dirname(currentDir)) {
      const gitPath = path.join(currentDir, '.git');
      
      try {
        if (fs.existsSync(gitPath)) {
          console.log('Found .git at:', gitPath);
          
          const git: SimpleGit = simpleGit(currentDir);
          const isRepo = await git.checkIsRepo();
          
          if (isRepo) {
            console.log('Confirmed git repository at:', currentDir);
            return currentDir;
          }
        }
      } catch (error) {
        console.log('Error checking directory:', currentDir, error);
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    console.log('No git repository found in directory tree');
    return null;
  } catch (error) {
    console.error('Error finding git repository:', error);
    return null;
  }
}

async function getBlameInfo(git: SimpleGit, filePath: string, lineNumber: number): Promise<BlameInfo | null> {
  try {
    try {
      await git.raw(['ls-files', '--error-unmatch', filePath]);
    } catch (lsError) {
      return null;
    }

    // simple-git doesn't have a direct blame method, so we'll use raw git command
    const blameCommand = [
      'blame',
      '--follow',
      '-L', `${lineNumber},${lineNumber}`,
      '--date=iso',
      filePath
    ];
    
    const blameOutput = await git.raw(blameCommand);

    if (!blameOutput.trim()) {
      return null;
    }

    // Parse the blame output
    // Format: commit_hash (author date time timezone line_number) content
    const blameRegex = /^([a-f0-9]+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\s+\d+\)\s*(.*)$/;
    const match = blameOutput.trim().match(blameRegex);

    if (!match) {
      const parts = blameOutput.trim().split(/\s+/);
      const hash = parts[0];
      const parenIndex = blameOutput.indexOf('(');
      const lastParenIndex = blameOutput.lastIndexOf(')');
      
      if (parenIndex === -1 || lastParenIndex === -1) {
        return null;
      }

      const insideParens = blameOutput.substring(parenIndex + 1, lastParenIndex);
      const dateMatch = insideParens.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : '';
      
      const authorMatch = insideParens.match(/^(.+?)\s+\d{4}-\d{2}-\d{2}/);
      const author = authorMatch ? authorMatch[1].trim() : '';
      
      const lineContent = blameOutput.substring(lastParenIndex + 1).trim();

      return {
        hash,
        author,
        date,
        lineContent
      };
    }

    return {
      hash: match[1],
      author: match[2].trim(),
      date: match[3],
      lineContent: match[4]
    };
  } catch (error) {
    return null;
  }
}

async function getCommitMessage(git: SimpleGit, commitHash: string): Promise<string> {
  try {
    const log = await git.show(['-s', '--pretty=%s', commitHash]);
    return log.trim();
  } catch (error) {
    return 'Could not retrieve commit message';
  }
}

async function getDiffContext(git: SimpleGit, commitHash: string, filePath: string): Promise<string> {
  try {
    const diff = await git.show(['--unified=3', commitHash, '--', filePath]);
    return diff;
  } catch (error) {
    return 'Could not retrieve diff context';
  }
}

function generatePrompt(promptInfo: PromptInfo): string {
  const { filePath, lineNumber, blameInfo, commitMessage, diffContext } = promptInfo;

  return 'Given the following information:\n\n' +
          `- File: ${filePath}\n` +
          `- Line number: ${lineNumber}\n` +
          `- Line content: ${blameInfo.lineContent}\n` +
          `- Author: ${blameInfo.author}\n` +
          `- Commit date: ${blameInfo.date}\n` +
          `- Commit message: ${commitMessage}\n\n` +
          'Git diff context:\n' +
          '-----------------------------------------------------------\n' +
          diffContext + '\n' +
          '-----------------------------------------------------------\n\n' +
          `Please explain why this line ("${blameInfo.lineContent}") was introduced or changed based on this information. Focus on the purpose and reasoning behind this change.\n` +
          'Give the answer in a concise and clear manner, suitable for output in a terminal of a chat. Do not include any markdown formatting and do not repeat the line of code, ' +
          'nor quote the commit message if not absolutely needed.\n' +
          'Also explain, how the file worked before this change and how it works now.'
}

async function analyzeGitBlame(filePath: string, lineNumber: number): Promise<PromptInfo | null> {
  try {
    const absoluteFilePath = path.resolve(filePath);
    console.log('Analyzing git blame for file:', absoluteFilePath, 'at line:', lineNumber);
    
    const repoPath = await findGitRepository(absoluteFilePath);
    if (!repoPath) {
      console.error(`No git repository found for file: ${absoluteFilePath}`);
      return null;
    }

    console.log('Found git repository at:', repoPath);
    
    const git: SimpleGit = simpleGit(repoPath);

    const repoRoot = await git.revparse(['--show-toplevel']);
    const cleanRepoRoot = repoRoot.trim();

    let relativePath: string;
    if (absoluteFilePath.startsWith(cleanRepoRoot)) {
      relativePath = absoluteFilePath.substring(cleanRepoRoot.length + 1);
    } else {
      console.error(`File ${absoluteFilePath} is not within the git repository ${cleanRepoRoot}`);
      return null;
    }

    const blameInfo: BlameInfo | null = await getBlameInfo(git, relativePath, lineNumber);
    if (!blameInfo) {
      console.error(`No blame information found for ${relativePath} at line ${lineNumber}`);
      return null;
    }

    const commitMessage = await getCommitMessage(git, blameInfo.hash);

    const diffContext = await getDiffContext(git, blameInfo.hash, relativePath);

    const promptInfo: PromptInfo = {
      filePath: absoluteFilePath,
      lineNumber: lineNumber,
      blameInfo: blameInfo,
      commitMessage: commitMessage,
      diffContext: diffContext
    };    

    return promptInfo

  }
  catch (error) {    
    console.error('Error analyzing git blame:', error);
    return null;
  }
}

// This handles all chat requests directed at your participant
const handleChat: vscode.ChatRequestHandler = async (
  request,
  chatContext,
  stream,
  token
) => {
  console.log('➡️ handleChat:', { command: request.command, prompt: request.prompt });
  const [filePath, lineNumber] = request.prompt.split(' ');
  console.log('filePath:', filePath, 'Line number:', lineNumber);
  
  if (request.command === 'explainCommit') {
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
  } else if (request.command === 'explainBlame'){
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

      // Auto-detect from current editor
      const currentPosition = getCurrentFileAndLine();
      if (!currentPosition) {
        stream.markdown('**Error:** No active editor found. Please open a file and place your cursor on the line you want to analyze.');
        return;
      }
      
      const filePath = currentPosition.filePath;
      const lineNumber = currentPosition.lineNumber;
      console.log('Auto-detected:', { filePath, lineNumber });
      
      // Show user what was detected
      stream.markdown(`🔍 **Analyzing line ${lineNumber} in:** \`${path.basename(filePath)}\`\n\n`);

      const promptInfo = await analyzeGitBlame(filePath, lineNumber);

      // Check if promptInfo is null before proceeding
      if (!promptInfo) {
        stream.markdown('**Error:** Could not analyze git blame information. Please check that:');
        stream.markdown('- The file exists and is tracked by git');
        stream.markdown('- You are in a git repository');
        stream.markdown('- The line number is valid');
        stream.markdown('- The file path is correct');
        return;
      }

      // Create the prompt
      const prompt = [
        vscode.LanguageModelChatMessage.User(generatePrompt(promptInfo))
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
  }
};

// Called when your extension is deactivated
export function deactivate() {}