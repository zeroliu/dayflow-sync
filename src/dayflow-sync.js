#!/usr/bin/env node

/**
 * Dayflow Sync - Export Dayflow timeline data to markdown notes
 *
 * PRIVACY & SECURITY:
 * - This tool processes data 100% locally on your machine
 * - Opens Dayflow's SQLite database in READ-ONLY mode
 * - NO network calls - NO data uploads - NO tracking
 * - Only writes markdown files to your local filesystem
 * - You can verify: grep -r "http\|https\|fetch\|axios" src/
 */

import Database from 'better-sqlite3';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { format, subDays, addDays } from 'date-fns';

// ==================== Configuration ====================
const CONFIG = {
  // Default Dayflow database location (macOS only)
  dayflowDbPath: path.join(
    os.homedir(),
    'Library/Application Support/Dayflow/chunks.sqlite'
  ),
  // Default output directory (current working directory)
  defaultOutputDir: './dayflow-notes',
};

// ==================== Platform Validation ====================
function validatePlatform() {
  if (process.platform !== 'darwin') {
    console.error('\n❌ Dayflow is a macOS-only application\n');
    console.error('This sync tool requires:');
    console.error('  • macOS operating system');
    console.error('  • Dayflow app installed from https://dayflow.space');
    console.error('  • Dayflow database at ~/Library/Application Support/Dayflow/\n');
    process.exit(1);
  }
}

// ==================== CLI Setup ====================
const program = new Command();
program
  .name('dayflow-sync')
  .description('Export Dayflow timeline data to beautiful markdown notes')
  .version('1.0.0')
  .option('-d, --days <number>', 'Number of days to sync (1-365)', '7')
  .option('-o, --output <path>', 'Output directory path (default: ./dayflow-notes)')
  .option('--db <path>', 'Custom Dayflow database path (overrides default location)')
  .option('--includeDeleted <0|1>', 'Include deleted timeline cards', '0')
  .option('-f, --force', 'Force regenerate all notes, including complete days', false)
  .parse(process.argv);

const options = program.opts();
const DAYS = parseInt(options.days, 10);
const INCLUDE_DELETED = parseInt(options.includeDeleted, 10) === 1;
const FORCE = options.force;

// Configuration with environment variable fallbacks
const OUTPUT_DIR = path.resolve(
  options.output ||
  process.env.DAYFLOW_OUTPUT_DIR ||
  CONFIG.defaultOutputDir
);

const DB_PATH = options.db ||
                process.env.DAYFLOW_DB_PATH ||
                CONFIG.dayflowDbPath;

// ==================== Database Functions ====================
/**
 * Opens the Dayflow database in READ-ONLY mode for privacy and safety.
 * This ensures the tool cannot modify your Dayflow data.
 */
function openDatabase() {
  if (!fsSync.existsSync(DB_PATH)) {
    console.error('\n❌ Dayflow database not found!\n');
    console.error('Expected location:');
    console.error(`  ${DB_PATH}\n`);
    console.error('Possible solutions:');
    console.error('  1. Install Dayflow from https://dayflow.space');
    console.error('  2. Open Dayflow and let it record for a few minutes');
    console.error('  3. Verify Dayflow is tracking your activity');
    console.error('  4. Specify custom path with --db flag\n');
    console.error('Example:');
    console.error('  dayflow-sync --db ~/path/to/chunks.sqlite\n');
    process.exit(1);
  }

  try {
    // PRIVACY: Open database in READ-ONLY mode - cannot modify Dayflow data
    const db = new Database(DB_PATH, { readonly: true });

    // Test connection
    db.prepare('SELECT COUNT(*) FROM timeline_cards').get();
    return db;
  } catch (error) {
    console.error('\n❌ Failed to open Dayflow database\n');
    console.error(`Error: ${error.message}\n`);
    console.error('Possible causes:');
    console.error('  • Database is corrupted');
    console.error('  • Insufficient read permissions');
    console.error('  • Database format has changed\n');
    process.exit(1);
  }
}

function fetchTimelineCardsForDay(db, dayString, includeDeleted = false) {
  const query = `
    SELECT
      id, batch_id, start, end, start_ts, end_ts, day,
      title, summary, detailed_summary, category, subcategory,
      metadata, video_summary_url, created_at
    FROM timeline_cards
    WHERE day = ? ${includeDeleted ? '' : 'AND is_deleted = 0'}
    ORDER BY start_ts ASC
  `;

  return db.prepare(query).all(dayString);
}

function fetchJournalEntryForDay(db, dayString) {
  const query = `
    SELECT
      id, day, intentions, notes, goals, reflections,
      summary, status, created_at, updated_at
    FROM journal_entries
    WHERE day = ?
  `;

  return db.prepare(query).get(dayString);
}

function parseMetadata(metadataJson) {
  if (!metadataJson) {
    return { distractions: [], appSites: {} };
  }

  try {
    const parsed = JSON.parse(metadataJson);
    return {
      distractions: Array.isArray(parsed.distractions) ? parsed.distractions : [],
      appSites: parsed.appSites || {}
    };
  } catch (error) {
    console.warn(`Failed to parse metadata: ${error.message}`);
    return { distractions: [], appSites: {} };
  }
}

// ==================== Date Functions ====================
/**
 * Check if a day is complete (current time is past 4 AM of the NEXT day)
 * Used to determine if a day's note should be updated or skipped
 */
function isDayComplete(dayString) {
  const dayDate = new Date(dayString + 'T04:00:00');
  const nextDay4AM = addDays(dayDate, 1);
  return new Date() >= nextDay4AM;
}

/**
 * Replicates Dayflow's 4 AM day boundary logic.
 *
 * Dayflow considers a "day" to run from 4:00 AM to 3:59 AM the next calendar day.
 * This matches natural sleep/work patterns and ensures late-night activities
 * are grouped with the correct working day.
 *
 * @param {Date} date - Reference date/time
 * @returns {Object} { dayString, startOfDay, endOfDay }
 *
 * @example
 * // Activity at 2:00 AM on Dec 20
 * getDayInfoFor4AMBoundary(new Date('2024-12-20T02:00:00'))
 * // Returns: { dayString: '2024-12-19', ... }
 */
function getDayInfoFor4AMBoundary(date) {
  const fourAMToday = new Date(date);
  fourAMToday.setHours(4, 0, 0, 0);

  if (date < fourAMToday) {
    // Before 4AM today = previous day
    const startOfDay = subDays(fourAMToday, 1);
    return {
      dayString: format(startOfDay, 'yyyy-MM-dd'),
      startOfDay: startOfDay,
      endOfDay: fourAMToday
    };
  } else {
    // After 4AM = current day
    return {
      dayString: format(fourAMToday, 'yyyy-MM-dd'),
      startOfDay: fourAMToday,
      endOfDay: addDays(fourAMToday, 1)
    };
  }
}

function calculateDateRange(days) {
  const today = new Date();
  const dates = [];

  for (let i = 0; i < days; i++) {
    const date = subDays(today, i);
    const dayInfo = getDayInfoFor4AMBoundary(date);
    // Avoid duplicates by using a Set
    if (!dates.includes(dayInfo.dayString)) {
      dates.push(dayInfo.dayString);
    }
  }

  return [...new Set(dates)]; // Remove any duplicates
}

// ==================== Data Processing Functions ====================
function calculateDuration(startTs, endTs) {
  return Math.round((endTs - startTs) / 60); // Convert seconds to minutes
}

function formatDayString(dayString) {
  const date = new Date(dayString + 'T00:00:00');
  return format(date, 'MMMM d, yyyy');
}

function extractCategories(cards) {
  const categories = new Set();
  cards.forEach(card => {
    if (card.category) {
      categories.add(card.category);
    }
  });
  return Array.from(categories);
}

function calculateTotalMinutes(cards) {
  return cards.reduce((total, card) => {
    return total + calculateDuration(card.start_ts, card.end_ts);
  }, 0);
}

function aggregateAppUsage(cards) {
  const appStats = {};

  cards.forEach(card => {
    const metadata = parseMetadata(card.metadata);
    const duration = calculateDuration(card.start_ts, card.end_ts);

    [metadata.appSites?.primary, metadata.appSites?.secondary]
      .filter(Boolean)
      .forEach(app => {
        if (!appStats[app]) {
          appStats[app] = { sessions: 0, totalMinutes: 0 };
        }
        appStats[app].sessions += 1;
        appStats[app].totalMinutes += duration;
      });
  });

  return Object.entries(appStats)
    .sort((a, b) => b[1].totalMinutes - a[1].totalMinutes)
    .map(([app, stats]) => ({ app, ...stats }));
}

function extractAllDistractions(cards) {
  const allDistractions = [];

  cards.forEach(card => {
    const metadata = parseMetadata(card.metadata);
    if (metadata.distractions && metadata.distractions.length > 0) {
      metadata.distractions.forEach(d => {
        allDistractions.push({
          ...d,
          cardStart: card.start,
          cardEnd: card.end
        });
      });
    }
  });

  return allDistractions;
}

// ==================== Markdown Generation Functions ====================
function generateFrontmatter(dayString, cards, journal, existingCreatedAt = null) {
  const totalMinutes = calculateTotalMinutes(cards);
  const categories = extractCategories(cards);

  const frontmatter = {
    dayflow_day: dayString,
    day_boundary: '4am',
    total_cards: cards.length,
    total_minutes: totalMinutes,
    categories: categories,
    has_journal: !!journal,
    journal_status: journal?.status || null,
    created_at: existingCreatedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['dayflow', 'timeline', ...categories.map(c => c.toLowerCase())]
  };

  return '---\n' + yaml.dump(frontmatter) + '---\n';
}

function generateDailySummary(cards, dayString) {
  const totalMinutes = calculateTotalMinutes(cards);
  const hours = (totalMinutes / 60).toFixed(1);
  const categories = extractCategories(cards);

  const categoryCounts = {};
  let totalCategoryMinutes = 0;
  cards.forEach(card => {
    const cat = card.category || 'Uncategorized';
    const duration = calculateDuration(card.start_ts, card.end_ts);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + duration;
    totalCategoryMinutes += duration;
  });

  const categoryPercentages = Object.entries(categoryCounts)
    .map(([cat, mins]) => {
      const pct = Math.round((mins / totalCategoryMinutes) * 100);
      return `${cat} (${pct}%)`;
    })
    .join(', ');

  return `# Dayflow: ${formatDayString(dayString)}

## Daily Summary
**Total tracked time**: ${hours} hours (${totalMinutes} minutes)
**Categories**: ${categoryPercentages || 'None'}
**Timeline cards**: ${cards.length}

---
`;
}

function generateJournalSection(journal) {
  if (!journal) {
    return '';
  }

  let section = '';

  if (journal.intentions) {
    section += `## Morning Intentions\n${journal.intentions}\n\n`;
  }

  if (journal.goals) {
    section += `## Daily Goals\n${journal.goals}\n\n`;
  }

  if (journal.notes) {
    section += `## Journal Notes\n${journal.notes}\n\n`;
  }

  return section ? section + '---\n\n' : '';
}

function generateTimelineSection(cards) {
  if (cards.length === 0) {
    return '## Timeline\n*No timeline cards for this day*\n\n---\n\n';
  }

  const sections = cards.map(card => {
    const metadata = parseMetadata(card.metadata);
    const duration = calculateDuration(card.start_ts, card.end_ts);

    let section = `### ${card.start} - ${card.end} | ${card.category || 'Uncategorized'}\n`;
    section += `**${card.title}**\n\n`;

    if (card.detailed_summary) {
      section += `${card.detailed_summary}\n\n`;
    } else if (card.summary) {
      section += `${card.summary}\n\n`;
    }

    // Add metadata
    const apps = [
      metadata.appSites?.primary,
      metadata.appSites?.secondary
    ].filter(Boolean);

    if (apps.length > 0) {
      section += `**Apps**: ${apps.join(', ')}\n`;
    }

    section += `**Duration**: ${duration} minutes\n`;

    if (card.subcategory) {
      section += `**Subcategory**: ${card.subcategory}\n`;
    }

    if (card.video_summary_url) {
      const fileUrl = 'file://' + card.video_summary_url.replace(/ /g, '%20');
      section += `**Video summary**: [View](${fileUrl})\n`;
    }

    return section;
  });

  return `## Timeline\n\n${sections.join('\n---\n\n')}\n\n---\n\n`;
}

function generateJournalReflectionSection(journal) {
  if (!journal) {
    return '';
  }

  let section = '';

  if (journal.reflections) {
    section += `## Evening Reflection\n${journal.reflections}\n\n`;
  }

  if (journal.summary) {
    section += `## AI Summary\n${journal.summary}\n\n`;
  }

  return section ? section + '---\n\n' : '';
}

function generateDistractionsSection(cards) {
  const allDistractions = extractAllDistractions(cards);

  if (allDistractions.length === 0) {
    return '## Distractions Log\n*No distractions recorded today* ✨\n\n';
  }

  const items = allDistractions.map(d => {
    let item = `- **${d.startTime} - ${d.endTime}**: ${d.title}\n`;
    if (d.summary) {
      item += `  - ${d.summary}\n`;
    }
    return item;
  });

  return `## Distractions Log\n${items.join('\n')}\n\n`;
}

function generateAppUsageSection(cards) {
  const appUsage = aggregateAppUsage(cards);

  if (appUsage.length === 0) {
    return '## App Usage Summary\n*No app usage recorded*\n';
  }

  const items = appUsage.map(({ app, sessions, totalMinutes }) => {
    return `- ${app} (${sessions} sessions, ${totalMinutes} min)`;
  });

  return `## App Usage Summary\n${items.join('\n')}\n`;
}

function generateMarkdownNote(dayString, cards, journal, existingCreatedAt = null) {
  const frontmatter = generateFrontmatter(dayString, cards, journal, existingCreatedAt);
  const summary = generateDailySummary(cards, dayString);
  const journalSection = generateJournalSection(journal);
  const timeline = generateTimelineSection(cards);
  const reflectionSection = generateJournalReflectionSection(journal);
  const distractions = generateDistractionsSection(cards);
  const appUsage = generateAppUsageSection(cards);

  return frontmatter + '\n' + summary + journalSection + timeline + reflectionSection + distractions + appUsage;
}

// ==================== File Operations ====================
function generateFilename(dayString) {
  return `Dayflow_${dayString}.md`;
}

async function findExistingNoteByDay(dayString, directory) {
  const filename = generateFilename(dayString);
  const filePath = path.join(directory, filename);

  try {
    await fs.access(filePath);
    return filePath; // File exists
  } catch {
    return null; // File doesn't exist
  }
}

// Read existing note's created_at from frontmatter (for preserving timestamps on updates)
async function getExistingCreatedAt(dayString, directory) {
  const filePath = path.join(directory, generateFilename(dayString));
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const match = content.match(/created_at:\s*['"]?([^'"\n]+)['"]?/);
    if (match) return match[1].trim();
  } catch {
    // File doesn't exist or can't be read
  }
  return null;
}

async function saveNote(filename, content, directory) {
  try {
    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    console.error('\n❌ Failed to save note\n');
    console.error(`File: ${filename}`);
    console.error(`Error: ${error.message}\n`);
    console.error('Possible causes:');
    console.error('  • Insufficient write permissions');
    console.error('  • Disk space full');
    console.error('  • Invalid output directory path\n');
    console.error(`Directory: ${directory}\n`);
    process.exit(1);
  }
}

// ==================== Main Sync Function ====================
async function syncDayflowData() {
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│  Dayflow Sync - Export to Markdown         │');
  console.log('└─────────────────────────────────────────────┘\n');

  // Validate platform
  validatePlatform();

  // Show configuration
  console.log('Configuration:');
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  Days to sync: ${DAYS}`);
  console.log(`  Force regenerate: ${FORCE ? 'Yes' : 'No'}\n`);

  // Open database
  console.log('Opening Dayflow database...');
  const db = openDatabase();
  console.log('✓ Database connected (read-only mode)\n');

  // Calculate date range
  const dates = calculateDateRange(DAYS);
  console.log(`Syncing ${dates.length} days: ${dates[0]} to ${dates[dates.length - 1]}\n`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Process each day
  let savedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const dayString of dates) {
    try {
      console.log(`Processing ${dayString}...`);

      const existingPath = await findExistingNoteByDay(dayString, OUTPUT_DIR);
      const dayComplete = isDayComplete(dayString);

      // Smart sync (default): skip complete days with existing notes
      // Force mode: regenerate everything
      if (!FORCE && existingPath && dayComplete) {
        console.log(`  ⊘ Skipped (day complete, note exists)`);
        skippedCount++;
        continue;
      }

      // Fetch data
      const allCards = fetchTimelineCardsForDay(db, dayString, INCLUDE_DELETED);

      // Filter out failed processing cards (System category with "Processing failed" title)
      const timelineCards = allCards.filter(card => {
        const isFailed = card.category === 'System' &&
                        (card.title?.includes('Processing failed') ||
                         card.title?.includes('Error') ||
                         card.subcategory === 'Error');
        return !isFailed;
      });

      const filteredCount = allCards.length - timelineCards.length;
      if (filteredCount > 0) {
        console.log(`  ℹ Filtered out ${filteredCount} failed processing card(s)`);
      }

      const journalEntry = fetchJournalEntryForDay(db, dayString);

      if (timelineCards.length === 0 && !journalEntry) {
        console.log(`  ⊘ Skipped (no data for this day)`);
        skippedCount++;
        continue;
      }

      // Preserve created_at when updating existing notes (unless forcing)
      const existingCreatedAt = (!FORCE && existingPath)
        ? await getExistingCreatedAt(dayString, OUTPUT_DIR)
        : null;

      // Generate markdown
      const markdown = generateMarkdownNote(dayString, timelineCards, journalEntry, existingCreatedAt);
      const filename = generateFilename(dayString);

      // Save note
      await saveNote(filename, markdown, OUTPUT_DIR);

      if (existingPath) {
        console.log(`  ✓ Updated: ${filename} (${timelineCards.length} cards)`);
        updatedCount++;
      } else {
        console.log(`  ✓ Created: ${filename} (${timelineCards.length} cards)`);
        savedCount++;
      }

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      skippedCount++;
    }
  }

  // Close database
  db.close();

  // Summary
  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│  Sync Complete!                             │');
  console.log('└─────────────────────────────────────────────┘');
  console.log(`  New notes: ${savedCount}`);
  console.log(`  Updated notes: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total days: ${dates.length}`);
  console.log(`\n  Output directory: ${OUTPUT_DIR}\n`);
}

// ==================== Main Execution ====================
try {
  await syncDayflowData();
} catch (error) {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
}
