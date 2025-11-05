# Twitter to Bluesky Crosspost Tool

A tool that automatically crossposts Twitter accounts to Bluesky using the emusks package and AT Protocol.

## Features

- Crosspost multiple Twitter accounts to multiple Bluesky accounts
- Filter out replies, retweets, and quote tweets
- Track posted tweets to avoid duplicates
- Read-only Twitter authentication (only reads data, never posts)

## Setup

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
      "blueskyAppPassword": "your-app-password-here"
    }
  ],
  "options": {
    "checkIntervalMinutes": 5,
    "maxTweetsPerCheck": 20,
    "includeReplies": false,
    "includeRetweets": false,
    "includeQuoteTweets": false
  }
}
```

## Usage

### Testing the Setup

First, test that the packages are installed correctly:
```bash
node test.js
```

Then, test fetching tweets from Twitter (optional):
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
3. Post new tweets to the corresponding Bluesky account
4. Track posted tweets in `posted-tweets.json` to avoid duplicates

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

- `index.js`: Main crosspost script
- `test.js`: Tests package installation
- `demo.js`: Demo script to test Twitter API and view tweet structure
- `config.json`: Your configuration file (create this)
- `config.example.json`: Example configuration template
- `posted-tweets.json`: Tracks which tweets have been posted (auto-generated)
- `README.md`: This file

## Notes

- The Twitter auth token is only used for reading data, never for posting
- Each run checks for new tweets and posts them to Bluesky
- Set up a cron job or task scheduler to run this periodically
- Rate limiting: 2 second delay between posts to avoid hitting API limits

## License

ISC
