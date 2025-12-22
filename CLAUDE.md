# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dayflow Sync exports timeline data from the Dayflow macOS app to markdown notes. It reads from Dayflow's SQLite database (read-only) and generates markdown files with YAML frontmatter suitable for Obsidian, Notion, Logseq, or other markdown-based tools.

**Key constraint**: 100% local processing with zero network calls. All data stays on the user's machine.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run sync directly (development)
npm run dev              # or: node src/dayflow-sync.js

# Build standalone bundle + Claude Code skill
npm run build

# Build only standalone bundle
npm run build:standalone

# Build only Claude Code skill package
npm run build:skill

# Quick test (sync 1 day)
npm run test
```

## Architecture

Single-file application (`src/dayflow-sync.js`) with clear sections:

1. **Configuration** - Default paths, CLI setup with commander
2. **Database Functions** - SQLite queries using better-sqlite3 in read-only mode
3. **Date Functions** - 4 AM day boundary logic (activities before 4 AM belong to previous day)
4. **Data Processing** - Duration calculation, category extraction, app aggregation
5. **Markdown Generation** - Frontmatter (js-yaml), sections for summary/timeline/journal/distractions
6. **File Operations** - Incremental sync with skip/force logic

### 4 AM Day Boundary

Dayflow considers a "day" to run from 4:00 AM to 3:59 AM the next day. The `getDayInfoFor4AMBoundary()` function replicates this logic. Activities at 2:00 AM on Dec 20 belong to Dec 19's note.

### Build Outputs

- `dist/dayflow-sync.js` - Bundled standalone script (ncc with better-sqlite3 native bindings)
- `dist/skill/` - Claude Code skill package (SKILL.md manifest + bundled script)

## Database Schema (Dayflow)

The tool queries two tables:

- `timeline_cards` - Activity summaries with start/end times, category, metadata JSON
- `journal_entries` - Daily intentions, goals, notes, reflections

Database location: `~/Library/Application Support/Dayflow/chunks.sqlite`

## Environment Variables

- `DAYFLOW_OUTPUT_DIR` - Override default output directory
- `DAYFLOW_DB_PATH` - Custom database path (rarely needed)
