# Dayflow Sync

Export your [Dayflow](https://github.com/JerryZLiu/Dayflow) timeline to markdown notes. Perfect for Obsidian, Logseq, or any markdown-based workflow.

**100% local** — zero network calls, read-only database access, no tracking.

## Installation

### Pre-built Binary

```bash
curl -L https://github.com/zeroliu/dayflow-sync/releases/latest/download/dayflow-sync.js -o dayflow-sync
chmod +x dayflow-sync
./dayflow-sync --days 7
```

### From Source

```bash
git clone https://github.com/zeroliu/dayflow-sync.git
cd dayflow-sync
npm install
npm run dev
```

## Usage

```bash
# Sync last 7 days (default)
node src/dayflow-sync.js

# Sync last 30 days
node src/dayflow-sync.js --days 30

# Save to Obsidian vault
node src/dayflow-sync.js --output ~/Documents/MyVault/dayflow

# Force overwrite existing notes
node src/dayflow-sync.js --days 7 --force
```

### Environment Variables

```bash
# Set default output directory
export DAYFLOW_OUTPUT_DIR="$HOME/Documents/MyVault/dayflow"
```

## CLI Reference

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --days <n>` | 7 | Days to sync (1-365) |
| `-o, --output <path>` | ./dayflow-notes | Output directory |
| `--db <path>` | ~/Library/.../chunks.sqlite | Custom database path |
| `--includeDeleted <0\|1>` | 0 | Include deleted cards |
| `-f, --force` | false | Overwrite existing notes |

## Output Format

Files are named `Dayflow_YYYY-MM-DD.md` and contain:

- **YAML frontmatter** — metadata for search/filtering
- **Daily summary** — total time, category breakdown
- **Journal sections** — intentions, goals, reflections (if recorded)
- **Timeline** — activity cards with times, apps, summaries
- **Distractions log** — off-task activities
- **App usage** — time per application

See [examples/sample-output.md](examples/sample-output.md) for a complete example.

### Day Boundary

Dayflow uses a **4 AM boundary** — activities between midnight and 4 AM belong to the previous day's note.

## Automation

Sync daily with launchd. Create `~/Library/LaunchAgents/com.dayflow.sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dayflow.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/dayflow-sync/src/dayflow-sync.js</string>
        <string>--output</string>
        <string>/path/to/vault/dayflow</string>
        <string>--days</string>
        <string>7</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>19</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/dayflow-sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/dayflow-sync.error.log</string>
</dict>
</plist>
```

Then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.dayflow.sync.plist
launchctl list | grep dayflow  # verify
```

**Commands:**

- `launchctl start com.dayflow.sync` — run now
- `launchctl unload ...plist` — stop
- `tail /tmp/dayflow-sync.log` — view logs

## Troubleshooting

### Database not found

```bash
ls ~/Library/Application\ Support/Dayflow/chunks.sqlite
```

Ensure Dayflow is installed and has recorded some activity.

### Permission denied

```bash
mkdir -p ~/Documents/MyVault/dayflow  # create output dir
```

### Native module build fails

```bash
xcode-select --install
npm rebuild better-sqlite3
```

### Node version

```bash
node --version  # must be >= 18
```

### Automation not running

```bash
which node  # use this full path in plist
launchctl list | grep dayflow  # check if loaded
tail /tmp/dayflow-sync.error.log  # check errors
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

[Open an issue](https://github.com/zeroliu/dayflow-sync/issues) for bugs or feature requests.

## Requirements

- macOS (Dayflow is macOS-only)
- Node.js 18+
- [Dayflow](https://github.com/JerryZLiu/Dayflow) installed

## License

MIT — see [LICENSE](LICENSE)
