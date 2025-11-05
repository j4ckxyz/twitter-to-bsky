# Twitter to Bluesky Crosspost Tool

Automatically crosspost from Twitter to Bluesky with full support for threads, media, and rich link previews.

## Features

- 🧵 **Thread support** - Automatically detects and preserves Twitter threads
- 📸 **Media support** - Images and videos with proper aspect ratios
- 🔗 **Rich link previews** - OpenGraph cards for external links
- ✨ **Rich text** - Properly formatted links, hashtags, and mentions
- 🔄 **Smart filtering** - Optionally exclude replies, retweets, or quote tweets
- 📝 **Auto-threading** - Splits long posts (>300 chars) into threads
- 🎯 **Duplicate prevention** - Tracks posted tweets to avoid reposts
- 🛡️ **Read-only Twitter access** - Only reads data, never posts to Twitter

## Quick Start

### 1. Install

```bash
git clone https://github.com/yourusername/twitter-to-bsky.git
cd twitter-to-bsky
npm install
```

### 2. Configure

Run the interactive setup tool:

```bash
npm run setup
```

This will guide you through:
- Getting your Twitter auth token
- Creating Bluesky app passwords
- Setting up account mappings (Twitter → Bluesky)
- Configuring filtering options

### 3. Test

Enable dry run mode (default) to see what would be posted without actually posting:

```bash
npm start
```

Check the console output to verify everything looks correct.

### 4. Go Live

When ready, use the setup tool to disable dry run mode:

```bash
npm run setup
# Select "Configure global options" → "Toggle dry run mode"
```

Then run again:

```bash
npm start
```

## Getting Authentication Credentials

### Twitter Auth Token

1. Log in to https://x.com in your browser
2. Open DevTools (press F12)
3. Go to the **Application** tab
4. Navigate to **Cookies** → **x.com**
5. Find the `auth_token` cookie
6. Copy its value

### Bluesky App Password

1. Log in to https://bsky.app
2. Go to **Settings** → **Privacy and Security** → **App Passwords**
3. Click **Add App Password**
4. Give it a name (e.g., "Twitter Crosspost")
5. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

**Note**: Use an app password, not your main Bluesky password!

## Configuration

The tool uses `config.json` to manage your settings. You can edit it manually or use the interactive setup tool (`npm run setup`).

### Example config.json

```json
{
  "twitter": {
    "authToken": "your_twitter_auth_token"
  },
  "crosspostMappings": [
    {
      "twitterUsername": "elonmusk",
      "blueskyHandle": "elon.bsky.social",
      "blueskyAppPassword": "xxxx-xxxx-xxxx-xxxx",
      "blueskyService": "https://bsky.social"
    }
  ],
  "options": {
    "dryRun": true,
    "maxTweetsPerCheck": 20,
    "includeReplies": false,
    "includeRetweets": false,
    "includeQuoteTweets": false
  }
}
```

### Options Explained

- **dryRun** - When `true`, shows what would be posted without actually posting
- **maxTweetsPerCheck** - How many recent tweets to check per run (default: 20)
- **includeReplies** - Crosspost replies to other users (default: false)
- **includeRetweets** - Crosspost retweets (default: false)
- **includeQuoteTweets** - Crosspost quote tweets (default: false)

## Managing Accounts

### Adding an Account

To add a new Twitter→Bluesky crosspost mapping:

```bash
npm run setup
# Select "Add new account mapping"
# Follow the prompts to enter:
#   - Twitter username
#   - Bluesky handle
#   - Bluesky app password
#   - Bluesky PDS URL (or press Enter for default bsky.social)
```

### Editing or Removing Accounts

```bash
npm run setup
# Select "Edit account mapping" or "Remove account mapping"
# Choose the account from the list
```

### Setting Twitter Auth Token

```bash
npm run setup
# Select "Set Twitter auth token"
# Paste your auth_token from x.com cookies (see Getting Authentication Credentials)
```

## Scheduling Automatic Crossposting

To automatically crosspost at regular intervals, set up a cron job or scheduled task.

### Linux/Mac (crontab)

```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/twitter-to-bsky && npm start >> crosspost.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create a new task
3. Set trigger to run every 5 minutes
4. Set action: `cmd /c "cd C:\path\to\twitter-to-bsky && npm start"`

### Using systemd (Linux)

Create a service file at `/etc/systemd/system/twitter-crosspost.service`:

```ini
[Unit]
Description=Twitter to Bluesky Crosspost
After=network.target

[Service]
Type=oneshot
User=yourusername
WorkingDirectory=/path/to/twitter-to-bsky
ExecStart=/usr/bin/npm start

[Install]
WantedBy=multi-user.target
```

Create a timer at `/etc/systemd/system/twitter-crosspost.timer`:

```ini
[Unit]
Description=Run Twitter crosspost every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable twitter-crosspost.timer
sudo systemctl start twitter-crosspost.timer
```

## How It Works

### Thread Detection

When you post a Twitter thread (replies to your own tweets), the tool automatically:

1. Detects the thread structure
2. Posts tweets in the correct order
3. Maintains threading on Bluesky using proper reply references

**Example:**

Twitter:
```
Tweet 1: "Here's an interesting finding..."
└─ Tweet 2: "And here's more detail..."
   └─ Tweet 3: "Finally, the conclusion"
```

Becomes on Bluesky:
```
Post 1: "Here's an interesting finding..."
└─ Post 2: "And here's more detail..."
   └─ Post 3: "Finally, the conclusion"
```

### Link Handling

The tool intelligently processes links:

- **Media links** (pic.twitter.com, t.co to images/videos) are removed from text
- **Content links** (articles, websites) are expanded from t.co to full URLs
- **Link preview cards** are created for external links using OpenGraph metadata
- **Rich text facets** make links, hashtags, and mentions clickable

**Example:**

Twitter: `"Check this out: https://t.co/abc123 https://t.co/img456"`
- First link → Article URL (kept as clickable link)
- Second link → Image (removed from text, shown as media embed)

Bluesky: `"Check this out: https://example.com/article"` + image embed  
*Note: Link is clickable but shown as text, not as an OpenGraph card (media takes priority)*

**Without media:**

Twitter: `"Check this out: https://t.co/abc123"`

Bluesky: Post with full OpenGraph link preview card (title, description, thumbnail)

### Auto-Splitting Long Posts

If a tweet's text exceeds 300 characters after processing, it's automatically split into a thread:

```
Post 1: "This is a very long tweet that exceeds 300 characters..."
└─ Post 2: "...and this is the rest of the content."
```

## Files

- `index.js` - Main crosspost script
- `setup.js` - Interactive configuration tool
- `config.json` - Your configuration (auto-created, gitignored)
- `config.example.json` - Example configuration template
- `crosspost-log.json` - Tracks posted tweets (auto-created, gitignored)
- `AGENTS.md` - Technical documentation for AI agents/LLMs

## Troubleshooting

### "Twitter auth failed"

Your auth token may have expired. Get a fresh one from x.com cookies.

### "Bluesky login failed"

Check that you're using an **app password**, not your main password. Create a new one at bsky.app/settings/app-passwords.

### Videos show "Video not found"

This should be fixed in the latest version. Make sure you have the latest code with video `aspectRatio` support.

### Posts are duplicated

The tool tracks posted tweets in `crosspost-log.json`. If this file is deleted or corrupted, it may re-post old tweets. Keep this file intact.

### Rate limiting

If you're hitting rate limits:
- Reduce `maxTweetsPerCheck` in config
- Increase delay between runs (e.g., every 10 minutes instead of 5)
- The tool includes 1-2 second delays between posts

## Privacy & Security

- **Twitter auth token** - Only used for reading data, never for posting
- **Bluesky app password** - Only has access to your Bluesky account, not your main password
- **config.json** - Gitignored by default, keep it private
- **crosspost-log.json** - Gitignored, contains tweet IDs and Bluesky URIs

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - Free to use, modify, and distribute. See LICENSE file for details.

## Support

- Report bugs: [GitHub Issues](https://github.com/yourusername/twitter-to-bsky/issues)
- Feature requests: [GitHub Discussions](https://github.com/yourusername/twitter-to-bsky/discussions)

## Credits

Built with:
- [@atproto/api](https://github.com/bluesky-social/atproto) - AT Protocol client
- [emusks](https://www.npmjs.com/package/emusks) - Twitter API wrapper
- [open-graph-scraper](https://github.com/jshemas/openGraphScraper) - OpenGraph metadata extraction

---

**Note**: This tool is unofficial and not affiliated with Twitter/X or Bluesky. Use responsibly and in accordance with both platforms' terms of service.
