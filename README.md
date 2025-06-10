## Usage
In order to try it, first you have to navigate to your Git repository (the project folder containing the .git directory) and run the next command.

### Command Line
```bash
ts-node git-blame-analyzer.ts <file-path> <line-number>
```

**Example:**
```bash
ts-node ../git-blame-analyzer/git-blame-analyzer.ts app/src/main/java/de/telekom/mobilityapp/ui/refuel/smartpay/viewmodel/RefuelSmartPayPumpViewModel.kt 42
```

## Requirements

- Node.js 14+
- TypeScript
- Must be run within a Git repository

## What it does

1. Analyzes the specified line using `git blame`
2. Retrieves commit information and diff context
3. Generates a formatted prompt with:
   - File and line details
   - Author and commit information
   - Git diff context
   - Analysis questions

## Installation

```bash
git clone <repository-url>
cd git-blame-analyzer
npm install
```

## Dependencies

- `simple-git`: Git operations
- `path`: File path resolution
