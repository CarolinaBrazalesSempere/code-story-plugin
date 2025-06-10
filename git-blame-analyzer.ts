#!/usr/bin/env node

import { simpleGit, SimpleGit } from 'simple-git';
import { resolve } from 'path';

// Export the main function so it can be imported and used programmatically
export async function analyzeGitBlame(filePath: string, lineNumber: number): Promise<void> {
  try {
    // Resolve the absolute path and find the git repository
    const absoluteFilePath = resolve(filePath);
    
    // Initialize git from the current working directory
    const git: SimpleGit = simpleGit();
    
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.error(`Not in a git repository. Please run this command from within a git repository.`);
      process.exit(1);
    }

    // Get the repository root
    const repoRoot = await git.revparse(['--show-toplevel']);
    const cleanRepoRoot = repoRoot.trim();

    // Calculate relative path from repo root
    let relativePath: string;
    if (absoluteFilePath.startsWith(cleanRepoRoot)) {
      relativePath = absoluteFilePath.substring(cleanRepoRoot.length + 1);
    } else {
      // If the file is not within the repo, this might be an issue
      console.error(`File ${absoluteFilePath} is not within the git repository ${cleanRepoRoot}`);
      process.exit(1);
    }
    
    const blameInfo = await getBlameInfo(git, relativePath, lineNumber);
    if (!blameInfo) {
      console.error(`Could not find blame information for line ${lineNumber}`);
      process.exit(1);
    }

    // Get commit message
    const commitMessage = await getCommitMessage(git, blameInfo.hash);

    // Get diff context for the commit
    const diffContext = await getDiffContext(git, blameInfo.hash, relativePath);

    // Generate and display the prompt
    generatePrompt(filePath, lineNumber, blameInfo, commitMessage, diffContext);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

interface BlameInfo {
  hash: string;
  author: string;
  date: string;
  lineContent: string;
}

// Main function for command line usage
async function main() {
  // Check input arguments
  const args = process.argv.slice(2);
  console.log(args)
  
  if (args.length !== 2) {
    console.error('Usage: ts-node git-blame-analyzer.ts <file-path> <line-number>');
    console.error('Example: ts-node git-blame-analyzer.ts src/index.ts 42');
    process.exit(1);
  }

  const [filePath, lineNumberStr] = args;
  const lineNumber = parseInt(lineNumberStr, 10);

  if (isNaN(lineNumber) || lineNumber < 1) {
    console.error('Line number must be a positive integer');
    process.exit(1);
  }

  // Call the exported function
  await analyzeGitBlame(filePath, lineNumber);
}

async function getBlameInfo(git: SimpleGit, filePath: string, lineNumber: number): Promise<BlameInfo | null> {
  try {
    // First, let's check if the file exists in git
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
      // Fallback parsing for different blame formats
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
      
      // Extract author (everything before the date)
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

function generatePrompt(
  filePath: string,
  lineNumber: number,
  blameInfo: BlameInfo,
  commitMessage: string,
  diffContext: string
): void {
  console.log('==================== Generated Prompt ====================');
  console.log('');
  console.log('Given the following information:');
  console.log('');
  console.log(`- File: ${filePath}`);
  console.log(`- Line number: ${lineNumber}`);
  console.log(`- Line content: ${blameInfo.lineContent}`);
  console.log(`- Author: ${blameInfo.author}`);
  console.log(`- Commit date: ${blameInfo.date}`);
  console.log(`- Commit message: ${commitMessage}`);
  console.log('');
  console.log('Git diff context:');
  console.log('-----------------------------------------------------------');
  console.log(diffContext);
  console.log('-----------------------------------------------------------');
  console.log('');
  console.log(`Please explain why this line ("${blameInfo.lineContent}") was introduced or changed based on this information. Focus on the purpose and reasoning behind this change.`);
  console.log('Give the answer in a concise and clear manner, suitable for output in a terminal of a chat. Do not include any markdown formatting and do not repeat the line of code,');
  console.log('nor quote the commit message if not absolutely needed.');
  console.log('Also explain, how the file worked before this change and how it works now.');
  console.log('');
  console.log('===========================================================');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}