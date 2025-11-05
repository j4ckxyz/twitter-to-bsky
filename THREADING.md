# Thread Support Documentation

## Overview

The tool now supports automatic thread detection and crossposting from Twitter to Bluesky. This includes:

1. **Twitter thread detection**: Detects when tweets are replies to the author's own tweets (thread continuations)
2. **Automatic text splitting**: Splits posts longer than 300 characters into threaded posts
3. **Proper AT Protocol threading**: Uses correct `reply` references with `root` and `parent` strong refs

## How It Works

### Twitter Thread Detection

When processing tweets, the tool:

1. Identifies "root" tweets (not replies, or replies to other users)
2. For each root tweet, searches for any replies from the same author
3. Crosspost the root tweet to Bluesky
4. Crosspost each thread continuation as a reply to maintain the thread structure

Example Twitter thread:
```
Tweet 1: "Here's an interesting finding..." (root)
  └─ Tweet 2: "And here's more detail..." (self-reply)
     └─ Tweet 3: "Finally, here's the conclusion" (self-reply to Tweet 2)
```

Becomes on Bluesky:
```
Post 1: "Here's an interesting finding..."
  └─ Post 2: "And here's more detail..."
     └─ Post 3: "Finally, here's the conclusion"
```

### Automatic Text Splitting

Bluesky has a 300-character limit (vs Twitter's 280). When a tweet's text exceeds 300 characters after cleaning:

1. Text is split at natural boundaries (sentence endings, then word boundaries)
2. Each chunk becomes a separate post
3. Chunks are threaded together using AT Protocol reply references

Example:
```
Tweet: "This is a very long tweet that exceeds 300 characters... [continued text]... and this is the end."
```

Becomes:
```
Post 1: "This is a very long tweet that exceeds 300 characters... [first part]"
  └─ Post 2: "...and this is the end."
```

### AT Protocol Threading

Threads on Bluesky use the `reply` field in post records:

```javascript
{
  text: "Reply text",
  reply: {
    root: {
      uri: "at://did:plc:xxx/app.bsky.feed.post/xxx",  // First post in thread
      cid: "bafyxxx..."  // CID of root post
    },
    parent: {
      uri: "at://did:plc:xxx/app.bsky.feed.post/yyy",  // Immediate parent
      cid: "bafyyyy..."  // CID of parent post
    }
  }
}
```

- **Root**: Always points to the first post in the entire thread
- **Parent**: Points to the immediate parent post
- For direct replies to root, both root and parent point to the same post
- For nested replies, parent points to the previous post, root stays the same

## Crosspost Log Changes

The `crosspost-log.json` now tracks additional thread information:

```json
{
  "mappings": {
    "twitterUsername": {
      "tweetId": {
        "blueskyUri": "at://...",
        "blueskyHandle": "user.bsky.social",
        "text": "Tweet text",
        "hasMedia": false,
        "mediaType": null,
        "chunks": 2,              // Number of chunks if split
        "threadReplies": 3,        // Number of thread continuations
        "parentTweetId": "...",    // For thread replies
        "timestamp": "2024-11-05T..."
      }
    }
  }
}
```

## Testing

### Test Thread Detection

Use the `test-threading.js` tool to analyze any Twitter account:

```bash
# Just analyze thread structure (no posting)
TWITTER_AUTH_TOKEN=xxx node test-threading.js OpenAI
```

This will:
- Fetch recent tweets
- Identify threads and self-replies
- Show which tweets would be split due to length
- Display thread structure

### Test Actual Posting

To test with a real Bluesky account:

```bash
TWITTER_AUTH_TOKEN=xxx node test-threading.js OpenAI your.handle.bsky.social xxxx-xxxx-xxxx-xxxx
```

This will:
- Do everything above
- Create a test thread on Bluesky to verify threading works
- Show the URIs of created posts

### Full Integration Test

1. Set up a test mapping in `config.json`:
   ```json
   {
     "twitterUsername": "OpenAI",
     "blueskyHandle": "test.bsky.social",
     "blueskyAppPassword": "xxxx-xxxx-xxxx-xxxx",
     "blueskyService": "https://bsky.social"
   }
   ```

2. Enable dry run first:
   ```json
   {
     "options": {
       "dryRun": true
     }
   }
   ```

3. Run the tool:
   ```bash
   npm start
   ```

4. Check `crosspost-log.json` to see what would be posted

5. Disable dry run and run again to actually post:
   ```json
   {
     "options": {
       "dryRun": false
     }
   }
   ```

## Limitations

1. **Thread depth**: The tool currently detects direct self-replies only (depth 1). It doesn't follow multi-level thread chains yet.

2. **Timing**: Threads are detected based on tweets available in the current fetch. If thread tweets are spread across multiple runs, they may be posted as separate root posts.

3. **Tweet order**: Twitter API returns tweets in reverse chronological order. The tool reverses this to post oldest first, but very old threads may not be detected if they're outside the fetch window.

4. **Rate limiting**: Posting threads increases the number of API calls. The tool includes delays (1-2 seconds) between posts to respect rate limits.

## Recommendations

1. **Initial run**: Do a dry run first to see what would be posted
2. **Small batches**: Start with `maxTweetsPerCheck: 20` or less
3. **Monitor logs**: Watch `crosspost-log.json` to see what's being tracked
4. **Test accounts**: Test with a less active account first before doing high-volume accounts
5. **Thread-heavy accounts**: For accounts that post many threads, consider increasing `maxTweetsPerCheck` to catch full threads

## Examples

### Example 1: Simple Thread

Twitter:
```
@OpenAI: "Introducing GPT-5..." (Tweet A)
└─ @OpenAI: "It features..." (Tweet B, reply to A)
```

Bluesky:
```
Post 1: "Introducing GPT-5..." [uri: at://xxx/1]
└─ Post 2: "It features..." [uri: at://xxx/2, reply to 1]
```

### Example 2: Long Tweet Split

Twitter:
```
@User: "This is a very long tweet that goes on and on for more than 300 characters when you consider all the words and punctuation and everything else that makes up the content of this particular message which needs to be split..."
```

Bluesky:
```
Post 1: "This is a very long tweet that goes on and on for more than 300 characters when you consider all the words and punctuation and everything else that makes up the content of this particular message which needs to..."
└─ Post 2: "...be split..."
```

### Example 3: Thread + Long Tweets

Twitter:
```
@User: "[Long tweet 350 chars...]" (Tweet A)
└─ @User: "[Long tweet 400 chars...]" (Tweet B, reply to A)
```

Bluesky:
```
Post 1a: "[First 300 chars of A...]"
└─ Post 1b: "[Rest of A...]"
   └─ Post 2a: "[First 300 chars of B...]"
      └─ Post 2b: "[Rest of B...]"
```

All properly threaded with correct root/parent references!
