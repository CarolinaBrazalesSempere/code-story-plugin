export interface BlameInfo {
  hash: string;
  author: string;
  date: string;
  lineContent: string;
}

export interface PromptInfo {
  filePath: string,
  lineNumber: number,
  blameInfo: BlameInfo,
  commitMessage: string,
  diffContext: string
}