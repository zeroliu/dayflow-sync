#!/usr/bin/env node

/**
 * Build script to generate Claude Code skill package
 *
 * This script creates a dist/skill/ directory containing:
 * - SKILL.md: Skill manifest for Claude Code
 * - dayflow-sync.cjs: Bundled executable
 * - README.md: Installation and usage instructions
 * - LICENSE: MIT license
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

async function buildSkill() {
  console.log('Building Claude Code skill package...\n');

  const skillDir = path.join(rootDir, 'dist', 'skill');

  try {
    // 1. Create skill directory
    console.log('Creating skill directory...');
    await fs.mkdir(skillDir, { recursive: true });
    console.log('✓ Directory created\n');

    // 2. Copy bundled script
    console.log('Copying bundled script...');
    const bundledScript = path.join(rootDir, 'dist', 'dayflow-sync.js');
    const skillScript = path.join(skillDir, 'dayflow-sync.js');

    try {
      await fs.copyFile(bundledScript, skillScript);
      console.log('✓ Script copied\n');
    } catch (error) {
      console.error('✗ Failed to copy bundled script');
      console.error('  Make sure to run "npm run build:standalone" first\n');
      process.exit(1);
    }

    // 3. Generate SKILL.md
    console.log('Generating SKILL.md...');
    const skillManifest = generateSkillManifest();
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillManifest);
    console.log('✓ SKILL.md created\n');

    // 4. Create skill README
    console.log('Creating skill README...');
    const skillReadme = generateSkillReadme();
    await fs.writeFile(path.join(skillDir, 'README.md'), skillReadme);
    console.log('✓ README.md created\n');

    // 5. Copy LICENSE
    console.log('Copying LICENSE...');
    const licenseSrc = path.join(rootDir, 'LICENSE');
    const licenseDest = path.join(skillDir, 'LICENSE');
    await fs.copyFile(licenseSrc, licenseDest);
    console.log('✓ LICENSE copied\n');

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│  Claude Code skill built successfully!      │');
    console.log('└─────────────────────────────────────────────┘');
    console.log(`\nOutput directory: ${skillDir}\n`);
    console.log('To install:');
    console.log(`  cp -r ${skillDir} ~/.claude/skills/dayflow-sync\n`);
    console.log('To configure output for your vault:');
    console.log('  export DAYFLOW_OUTPUT_DIR="$HOME/path/to/vault/notes/dayflow"\n');

  } catch (error) {
    console.error('✗ Build failed:', error.message);
    process.exit(1);
  }
}

function generateSkillManifest() {
  return `---
name: dayflow-sync
description: Sync Dayflow timeline data to markdown notes. Use when user asks to "sync dayflow", "fetch dayflow timeline", "export dayflow data", or wants to import Dayflow activity tracking into their notes.
---

# Dayflow Sync

Syncs your Dayflow timeline data into beautiful markdown notes with rich formatting.

## What is Dayflow?

Dayflow is a macOS app that automatically records your screen activity at 1 FPS and generates AI-powered timeline summaries. It tracks:
- **Timeline cards**: Activity summaries with app usage, categories, and durations
- **Journal entries**: Morning intentions, daily goals, and evening reflections
- **Distractions**: Off-task activities with timestamps
- **App usage**: Aggregated time spent in each application

## Usage

This skill syncs Dayflow data to your vault. Common triggers:

\`\`\`
sync dayflow for last 7 days
fetch dayflow timeline
export dayflow data for yesterday
sync dayflow for last month
\`\`\`

## Configuration

By default, notes are saved to \`./dayflow-notes/\` in the current directory.

To save to your vault, set the output directory:

\`\`\`bash
export DAYFLOW_OUTPUT_DIR="$HOME/Documents/MyVault/dayflow"
\`\`\`

Or specify it when running:

\`\`\`bash
node dayflow-sync.cjs --output ~/Documents/MyVault/dayflow
\`\`\`

## Output Format

Each day generates a markdown file named \`Dayflow_YYYY-MM-DD.md\` with:

- **YAML frontmatter**: Metadata (total time, categories, tags)
- **Daily summary**: Tracked time and category breakdown
- **Journal sections**: Intentions, goals, notes, reflections
- **Timeline**: Detailed activity cards with timestamps
- **Distractions log**: Off-task activities
- **App usage summary**: Aggregated time per application

## Privacy & Security

- **100% local processing** - No network calls, no data uploads
- **Read-only database access** - Cannot modify your Dayflow data
- **No tracking** - No analytics, telemetry, or phone-home features
- **Open source** - Audit the code yourself

## Options

- \`--days <number>\`: Number of days to sync (default: 7)
- \`--output <path>\`: Custom output directory
- \`--force\`: Force regenerate existing notes
- \`--db <path>\`: Custom Dayflow database path

## Requirements

- macOS (Dayflow is macOS-only)
- Dayflow app installed and running
- Node.js 18 or higher

## Example

\`\`\`bash
# Sync last 7 days to vault
node dayflow-sync.cjs --output ~/Documents/Vault/dayflow --days 7

# Force regenerate last 30 days
node dayflow-sync.cjs --days 30 --force
\`\`\`
`;
}

function generateSkillReadme() {
  return `# Dayflow Sync - Claude Code Skill

This is a Claude Code skill package for syncing Dayflow timeline data to markdown notes.

## Installation

1. **Copy skill to Claude Code skills directory**:
   \`\`\`bash
   cp -r dist/skill ~/.claude/skills/dayflow-sync
   \`\`\`

2. **Configure output directory** (optional):
   \`\`\`bash
   # Add to your ~/.zshrc or ~/.bashrc:
   export DAYFLOW_OUTPUT_DIR="$HOME/Documents/MyVault/dayflow"
   \`\`\`

3. **Reload Claude Code** to detect the new skill

## Usage in Claude Code

Once installed, you can trigger the skill by asking Claude to sync Dayflow data:

- "sync dayflow for last 7 days"
- "fetch dayflow timeline"
- "export dayflow data for yesterday"
- "sync dayflow for last month"

## Configuration Options

### Environment Variables

- \`DAYFLOW_OUTPUT_DIR\`: Override default output directory
- \`DAYFLOW_DB_PATH\`: Custom Dayflow database path (rarely needed)

### CLI Flags

When running manually:
- \`--output <path>\`: Specify output directory
- \`--days <number>\`: Number of days to sync (default: 7)
- \`--force\`: Force regenerate existing notes
- \`--db <path>\`: Custom database path

## Output Structure

The skill creates markdown files in your specified output directory:

\`\`\`
dayflow/
├── Dayflow_2025-12-19.md
├── Dayflow_2025-12-20.md
└── Dayflow_2025-12-21.md
\`\`\`

Each file contains:
- Daily summary with tracked time and category breakdown
- Timeline cards with detailed activity summaries
- Journal entries (intentions, goals, reflections)
- Distractions log
- App usage summary

## Manual Execution

You can also run the script directly:

\`\`\`bash
cd ~/.claude/skills/dayflow-sync
node dayflow-sync.cjs --days 7
\`\`\`

## Troubleshooting

**"Dayflow database not found"**
- Ensure Dayflow app is installed and has run at least once
- Check that Dayflow has recorded some activity
- Database location: \`~/Library/Application Support/Dayflow/chunks.sqlite\`

**"Permission denied"**
- Check write permissions for output directory
- Try specifying a different output path with \`--output\`

**"Command not found"**
- Ensure Node.js 18+ is installed
- The skill requires Node.js to run

## Privacy

This tool:
- Processes data 100% locally on your machine
- Opens Dayflow's database in read-only mode
- Makes zero network calls
- Does not upload or share your data
- Includes no tracking or telemetry

You can verify by searching the code for network calls:
\`\`\`bash
grep -r "http\\|https\\|fetch\\|axios" dayflow-sync.cjs
\`\`\`

## Links

- [Main Repository](https://github.com/zeroliu/dayflow-sync)
- [Documentation](https://github.com/zeroliu/dayflow-sync#readme)
- [Issue Tracker](https://github.com/zeroliu/dayflow-sync/issues)

## License

MIT License - see LICENSE file for details
`;
}

// Run the build
await buildSkill();
