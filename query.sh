#!/bin/bash

# Check input arguments
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <file-path> <line-number>"
  exit 1
fi

FILE_PATH=$1
LINE_NUMBER=$2

# Get blame info for the specific line
BLAME_OUTPUT=$(git blame --follow -L "$LINE_NUMBER","$LINE_NUMBER" --date=iso "$FILE_PATH")

if [ -z "$BLAME_OUTPUT" ]; then
  echo "Could not find blame information for line $LINE_NUMBER"
  exit 1
fi

# Parse the blame output
COMMIT_HASH=$(echo "$BLAME_OUTPUT" | awk '{print $1}')
AUTHOR=$(echo "$BLAME_OUTPUT" | sed -n 's/.*(\(.*\) [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}.*/\1/p' | sed 's/ *$//')
DATE=$(echo "$BLAME_OUTPUT" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
LINE_CONTENT=$(echo "$BLAME_OUTPUT" | sed 's/.*) //')

# Get diff context for the commit
DIFF_CONTEXT=$(git show --unified=3 "$COMMIT_HASH" -- "$FILE_PATH")

# Build the final prompt
echo "==================== Generated Prompt ===================="
echo ""
echo "Given the following information:"
echo ""
echo "- File: $FILE_PATH"
echo "- Line number: $LINE_NUMBER"
echo "- Line content: $LINE_CONTENT"
echo "- Author: $AUTHOR"
echo "- Commit date: $DATE"
echo "- Commit message: $(git log -1 --pretty=%s "$COMMIT_HASH")"
echo ""
echo "Git diff context:"
echo "-----------------------------------------------------------"
echo "$DIFF_CONTEXT"
echo "-----------------------------------------------------------"
echo ""
echo "Please explain why this line (\"$LINE_CONTENT\") was introduced or changed based on this information. Focus on the purpose and reasoning behind this change."
echo "Give the answer in a concise and clear manner, suitable for output in a terminal of a chat. Do not include any markdown formatting and do not repeat the line of code,"
echo "nor quote the commit message if not absolutely needed."
echo "Also explain, how the file worked before this change and how it works now."
echo ""
echo "==========================================================="