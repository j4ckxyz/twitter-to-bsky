# Twitter to Bluesky Crosspost Tool

A tool that automatically crossposts Twitter accounts to Bluesky using the emusks package and AT Protocol.

## Features

- Crosspost multiple Twitter accounts to multiple Bluesky accounts
- **Thread support**: Automatically detects and crossposts Twitter threads
- **Auto-threading**: Splits long posts (>300 chars) into threaded posts on Bluesky
- **Smart link handling**: Expands t.co links to real URLs, removes media links
- **Rich text facets**: Automatically detects and formats links, hashtags, and mentions
- Support for images (with proper aspect ratios) and videos
- Filter out replies, retweets, and quote tweets
- Track posted tweets to avoid duplicates
- Interactive configuration tool for easy setup
- Support for custom PDS instances
- Dry run mode for testing
- Read-only Twitter authentication (only reads data, never posts)

## Setup

### Quick Setup (Interactive)

The easiest way to get started is using the interactive configuration tool:

```bash
npm run setup
```

This will guide you through:
- Configuring your Twitter authentication
- Adding account mappings (Twitter → Bluesky)
- Setting up Bluesky credentials and PDS URLs
- Configuring filtering options (replies, retweets, quotes)
- Managing existing accounts

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Get your Twitter auth token:
   - Log in to https://x.com
   - Open DevTools (F12)
   - Go to the Application tab
   - Find Cookies → x.com
   - Copy the value of the `auth_token` cookie

3. Create Bluesky App Passwords:
   - Go to https://bsky.app/settings/app-passwords
   - Create a new app password for each account you want to post to

4. Configure `config.json`:
```json
{
  "twitter": {
    "authToken": "your_twitter_auth_token_here"
  },
  "crosspostMappings": [
    {
      "twitterUsername": "elonmusk",
      "blueskyHandle": "example.bsky.social",
      "blueskyAppPassword": "your-app-password-here",
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

## Usage

### Configuration Manager

Manage your accounts and settings with the interactive tool:
```bash
npm run setup
# or
npm run config
```

This allows you to:
- Add, edit, or remove account mappings
- Configure Twitter authentication
- Adjust global options (dry run, filters, etc.)
- View current configuration

### Testing the Setup

First, test that the packages are installed correctly:
```bash
node test.js
```

Test thread detection with any Twitter account:
```bash
# Analyze thread structure (no posting)
TWITTER_AUTH_TOKEN=xxx node test-threading.js OpenAI

# Test with actual Bluesky posting
TWITTER_AUTH_TOKEN=xxx node test-threading.js OpenAI your.handle.bsky.social xxxx-xxxx-xxxx-xxxx
```

Test fetching tweets from Twitter (optional):
```bash
node demo.js "your_auth_token" "twitter_username"
```

### Running the Crosspost Tool

Run the crosspost tool:
```bash
npm start
```

This will:
1. Fetch recent tweets from each configured Twitter account
2. Filter out replies, retweets, and quote tweets (based on config)
3. **Detect Twitter threads** (self-replies) and crosspost them as Bluesky threads
4. **Auto-split long posts** (>300 chars) into threaded posts
5. Download and process media (images/videos) with proper aspect ratios
6. Remove t.co links from media-only posts
7. Post new tweets to the corresponding Bluesky account
8. Track posted tweets in `crosspost-log.json` to avoid duplicates

**Important:** Make sure to disable dry run mode in your config when you're ready to actually post!

### Scheduling Automatic Runs

To automatically crosspost at regular intervals, set up a cron job (Linux/Mac) or Task Scheduler (Windows):

**Linux/Mac (crontab):**
```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/twitter-to-bsky && npm start
```

**Windows (Task Scheduler):**
1. Create a new task
2. Set trigger to run every 5 minutes
3. Set action to run: `cmd /c "cd C:\path\to\twitter-to-bsky && npm start"`

## Configuration Options

- `twitter.authToken`: Your Twitter auth token (read-only access)
- `crosspostMappings`: Array of Twitter-to-Bluesky account mappings
  - `twitterUsername`: Twitter account to monitor
  - `blueskyHandle`: Bluesky handle to post to (e.g., username.bsky.social)
  - `blueskyAppPassword`: Bluesky app password for authentication
  - `blueskyService`: (Optional) Custom PDS URL (defaults to https://bsky.social)
- `options.dryRun`: Run without actually posting to Bluesky (default: true)
- `options.maxTweetsPerCheck`: Maximum number of recent tweets to check (default: 20)
- `options.includeReplies`: Whether to crosspost replies (default: false)
- `options.includeRetweets`: Whether to crosspost retweets (default: false)
- `options.includeQuoteTweets`: Whether to crosspost quote tweets (default: false)

## Files

- `index.js`: Main crosspost script with threading support
- `setup.js`: Interactive configuration manager
- `test-threading.js`: Test tool for thread detection and Bluesky posting
- `test.js`: Tests package installation
- `demo.js`: Demo script to test Twitter API and view tweet structure
- `config.json`: Your configuration file (auto-created by setup tool)
- `config.example.json`: Example configuration template
- `crosspost-log.json`: Tracks which tweets have been posted and thread relationships (auto-generated)
- `README.md`: This file

## Notes

- The Twitter auth token is only used for reading data, never for posting
- Each run checks for new tweets and posts them to Bluesky
- **Threads**: When a tweet is a reply to itself (thread continuation), it will be posted as a threaded reply on Bluesky
- **Long posts**: Posts longer than 300 characters are automatically split and posted as threads
- **Links**: 
  - t.co links for media (images/videos) are automatically removed
  - t.co links for articles/websites are expanded to their real URLs
  - All links, hashtags, and mentions are properly formatted using AT Protocol facets
- Set up a cron job or task scheduler to run this periodically
- Rate limiting: 1-2 second delays between posts to avoid hitting API limits

## License

ISC
