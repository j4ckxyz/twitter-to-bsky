# Threading Feature - Testing Guide

## Quick Start

You mentioned you want to test with OpenAI's Twitter account. Here's how:

### Step 1: Prepare Credentials

You'll need:
1. Your Twitter auth_token (for reading tweets)
2. A test Bluesky account handle (e.g., `test.bsky.social`)
3. A Bluesky app password for that account

### Step 2: Test Thread Detection (No Posting)

This analyzes OpenAI's tweets without posting anything:

```bash
TWITTER_AUTH_TOKEN=your_token_here node test-threading.js OpenAI
```

Expected output:
- Shows recent tweets from @OpenAI
- Identifies which are threads (self-replies)
- Shows which tweets would need splitting (>300 chars)
- Displays thread structure

### Step 3: Test Actual Posting

Once you're ready to test posting to Bluesky:

```bash
TWITTER_AUTH_TOKEN=your_token_here node test-threading.js OpenAI your.test.bsky.social xxxx-xxxx-xxxx-xxxx
```

This will:
1. Do all the analysis from Step 2
2. Post a test thread to your Bluesky account
3. Show you the URIs of the created posts

### Step 4: Full Integration Test

Edit your `config.json` to add OpenAI as a test mapping:

```json
{
  "twitter": {
    "authToken": "your_token_here"
  },
  "crosspostMappings": [
    {
      "twitterUsername": "OpenAI",
      "blueskyHandle": "your.test.bsky.social",
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

Then run:

```bash
# First, dry run to see what would be posted
npm start

# Check the log to see thread structure
cat crosspost-log.json

# If it looks good, disable dry run
# Edit config.json: "dryRun": false

# Run again to actually post
npm start
```

## What to Look For

### Good Signs:
- ✓ Tool detects threads (you'll see "🧵 Found X thread continuation(s)")
- ✓ Long tweets show splitting (you'll see "✂️ Would split into X posts")
- ✓ Posts appear properly threaded on Bluesky
- ✓ Media appears in first post of each thread
- ✓ No duplicate posts

### Potential Issues:
- ⚠️ If tweets are very recent, thread replies might not be in the same batch
- ⚠️ If account posts very frequently, increase `maxTweetsPerCheck`
- ⚠️ Rate limit errors mean you need to slow down (tool has built-in delays)

## Testing Different Scenarios

### Scenario 1: Simple thread
Account that posts occasional threads. Good for first test.
Example: @OpenAI often has 2-3 tweet threads

### Scenario 2: Long tweets
Account that writes longer posts.
The tool will split these automatically.

### Scenario 3: Heavy threading
Account that posts many long threads.
May want to start with smaller `maxTweetsPerCheck`.

## Troubleshooting

### "No threads found"
- The account might not have recent threads
- Try a different account known for threading
- Increase `maxTweetsPerCheck`

### "Already posted"
- Check `crosspost-log.json`
- Delete entries you want to re-test
- Or use a fresh Bluesky test account

### Posts not threading correctly
- Check the console output for URIs
- Verify the `reply` field is being set
- Look at `crosspost-log.json` for `parentTweetId` field

### Rate limit errors
- The tool has 1-2s delays built in
- If still hitting limits, increase delays in code
- Or reduce `maxTweetsPerCheck`

## Next Steps After Testing

1. Clean up test posts from your test account
2. Set up your actual crosspost mappings
3. Run on a schedule (cron/Task Scheduler)
4. Monitor `crosspost-log.json` for issues
5. Adjust `maxTweetsPerCheck` based on account activity

## Ready to Test?

Provide your credentials and I'll help you run the tests!

```bash
# Replace with your actual values:
export TWITTER_AUTH_TOKEN="your_twitter_auth_token"
BSKY_HANDLE="your.test.bsky.social"
BSKY_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# Run the test
node test-threading.js OpenAI $BSKY_HANDLE $BSKY_PASSWORD
```
