# AGENTS.md - Technical Documentation for LLMs

This document provides comprehensive technical context for AI agents working on this codebase.

## Project Overview

**twitter-to-bsky** is a Node.js tool that automatically crossposts Twitter accounts to Bluesky using the AT Protocol. It monitors Twitter accounts via the emusks package and posts to Bluesky with full media, threading, and rich text support.

## Core Architecture

### Main Components

1. **index.js** - Main crosspost script (550+ lines)
   - Entry point for crossposting
   - Handles Twitter → Bluesky mapping
   - Coordinates all features

2. **setup.js** - Interactive configuration tool
   - CLI prompts for user setup
   - Creates and manages config.json
   - User-friendly account management

### Key Files

- **config.json** - User configuration (gitignored, sensitive)
- **config.example.json** - Template for users
- **crosspost-log.json** - Tracks posted tweets and threads (gitignored)
- **package.json** - Dependencies and scripts
- **.gitignore** - Excludes config, logs, test files

## Feature Implementation

### 1. Thread Support (index.js:305-370)

**Twitter Thread Detection**:
- Identifies self-replies (author replying to their own tweets)
- Uses `getThreadTweets()` to find thread continuations
- Posts threads in correct order (oldest first)

**Auto-splitting Long Posts**:
- Splits text >300 chars at sentence/word boundaries
- Uses `splitTextIntoChunks()` function
- Creates Bluesky threads with proper reply references

**AT Protocol Threading**:
```javascript
reply: {
  root: { uri, cid },    // First post in thread
  parent: { uri, cid }   // Immediate parent
}
```

**Location**: `getThreadTweets()` (line 305), `splitTextIntoChunks()` (line 365)

### 2. Link Handling (index.js:140-224)

**Smart t.co Link Processing**:
- `cleanTweetText()` - Removes media links, expands content links
- Distinguishes between media URLs (pic.twitter.com, pbs.twimg.com) and article links
- Cleans trailing artifacts like "and this image"

**External Link Card Embeds (OpenGraph)**:
- `extractExternalLink()` - Finds first non-media URL
- `fetchOpenGraphData()` - Scrapes OG metadata (title, description, thumbnail)
- Creates `app.bsky.embed.external` embed with preview card
- Priority: Media embeds override link cards (one embed per post)

**Rich Text Facets**:
- Uses `@atproto/api` RichText class
- Auto-detects links, hashtags, mentions
- `detectFacets()` resolves mentions to DIDs

**Location**: 
- `cleanTweetText()` (line 140)
- `extractExternalLink()` (line 191) 
- `fetchOpenGraphData()` (line 92)

### 3. Media Support (index.js:226-320, 410-458)

**Image Processing**:
- Downloads up to 4 images per post
- Extracts dimensions using `image-size` package
- Calculates aspect ratios for proper display
- Creates `app.bsky.embed.images` embed

**Video Processing**:
- Downloads highest quality MP4 variant from Twitter
- Checks size (<100MB) and duration (<3min) constraints
- Extracts dimensions from URL (format: `/vid/WIDTHxHEIGHT/`)
- Creates `app.bsky.embed.video` embed with required `aspectRatio` field
- Includes `alt` field for accessibility

**Location**:
- `processMediaFromTweet()` (line 226)
- Image upload (line 410-442)
- Video upload (line 443-458)

### 4. Filtering (index.js:485-520)

**Tweet Type Detection**:
- **Replies**: `tweet.inReplyToStatusId` exists
- **Retweets**: `tweet.retweetedStatus` exists
- **Quote tweets**: `tweet.quotedStatus` exists

**Config Options**:
```javascript
options: {
  includeReplies: false,      // Default: exclude
  includeRetweets: false,     // Default: exclude
  includeQuoteTweets: false   // Default: exclude
}
```

**Location**: Main processing loop (line 485-520)

### 5. Duplicate Prevention (index.js:55-90)

**Crosspost Log Structure**:
```javascript
{
  "mappings": {
    "twitterUsername": {
      "tweetId": {
        "blueskyUri": "at://...",
        "timestamp": "...",
        "chunks": 2,              // If split
        "threadReplies": 3,       // If thread
        "parentTweetId": "..."    // For replies
      }
    }
  }
}
```

**Functions**:
- `loadCrosspostLog()` - Loads tracking data
- `saveCrosspostLog()` - Persists after each post
- `hasBeenPosted()` - Checks if tweet already crossposted

**Location**: Lines 55-90

## Dependencies

**Core**:
- `@atproto/api` (^0.17.7) - Bluesky AT Protocol client
- `emusks` (^0.0.3) - Twitter API wrapper (read-only)

**Utilities**:
- `image-size` (^2.0.2) - Extract image dimensions
- `open-graph-scraper` (^6.10.0) - Fetch OG metadata for link cards
- `chalk` (^5.6.2) - Colored console output
- `prompts` (^2.4.2) - Interactive CLI for setup.js

## Data Flow

1. **Fetch Tweets** (Twitter API via emusks)
   - Get recent tweets for each configured account
   - Filter by type (replies, retweets, quotes)

2. **Process Each Tweet**
   - Check if already posted (duplicate prevention)
   - Clean text (remove media links, expand URLs)
   - Download media if present
   - Detect threads (self-replies)
   - Extract external link for card embed

3. **Post to Bluesky** (AT Protocol)
   - Login with app password
   - Upload media (images/videos)
   - Create OpenGraph card if applicable
   - Detect facets (links, hashtags, mentions)
   - Split long text if needed
   - Post with proper threading

4. **Track Posted**
   - Save to crosspost-log.json
   - Record URIs, timestamps, thread info

## Important Functions

### Main Processing
- `main()` (line 470) - Entry point, orchestrates crossposting
- `crosspostAccount()` (line 485) - Processes one Twitter account

### Text Processing
- `cleanTweetText()` (line 140) - Smart link handling
- `splitTextIntoChunks()` (line 365) - Auto-split long text

### Media
- `processMediaFromTweet()` (line 226) - Download and process media
- `downloadFile()` (line 117) - Fetch remote files

### Threading
- `getThreadTweets()` (line 305) - Find thread continuations
- `postToBluesky()` (line 385) - Posts with reply references

### Links
- `extractExternalLink()` (line 191) - Find first content URL
- `fetchOpenGraphData()` (line 92) - Scrape OG metadata

### Tracking
- `loadCrosspostLog()` (line 55) - Load tracking data
- `saveCrosspostLog()` (line 62) - Persist tracking data
- `hasBeenPosted()` (line 68) - Check duplicates

## Configuration

### config.json Structure
```json
{
  "twitter": {
    "authToken": "string"
  },
  "crosspostMappings": [
    {
      "twitterUsername": "string",
      "blueskyHandle": "string",
      "blueskyAppPassword": "string",
      "blueskyService": "string (optional, default: https://bsky.social)"
    }
  ],
  "options": {
    "dryRun": boolean,
    "maxTweetsPerCheck": number,
    "includeReplies": boolean,
    "includeRetweets": boolean,
    "includeQuoteTweets": boolean
  }
}
```

## Testing

The project includes test files (should be excluded from public release):
- `test.js` - Basic package test
- `demo.js` - Twitter API demo
- `test-threading.js` - Thread detection test
- `test-external-embed.js` - OpenGraph card test
- `test-media.js` - Media download test
- Various other test-*.js files

## Key Technical Details

### AT Protocol Specifics

**Video Embed Requirements**:
```javascript
{
  $type: 'app.bsky.embed.video',
  video: blob,
  aspectRatio: { width: number, height: number },  // REQUIRED
  alt: string  // Optional but recommended
}
```

**Image Embed Requirements**:
```javascript
{
  $type: 'app.bsky.embed.images',
  images: [
    {
      image: blob,
      alt: string,
      aspectRatio: { width: number, height: number }
    }
  ]
}
```

**External Link Embed**:
```javascript
{
  $type: 'app.bsky.embed.external',
  external: {
    uri: string,
    title: string,
    description: string,
    thumb: blob  // Optional
  }
}
```

### Character Limits

- **Twitter**: 280 characters (original tweet length)
- **Bluesky**: 300 characters (after cleaning, may trigger auto-split)
- **OG Title**: Truncated to reasonable length
- **OG Description**: Truncated if too long

### Rate Limiting

- 1-2 second delays between posts
- Configurable via `maxTweetsPerCheck`
- Respects both Twitter and Bluesky rate limits

## Common Modifications

### Adding New Features

1. **New media type**: Extend `processMediaFromTweet()` to handle new format
2. **New filter**: Add condition to filtering logic (line 500-520)
3. **New embed type**: Update `postToBluesky()` embed creation

### Debugging

- Set `dryRun: true` to test without posting
- Check `crosspost-log.json` for tracking info
- Console logs show progress and errors
- Use chalk colors for visual feedback

## Error Handling

- Media download failures: Skip media, post text only
- OpenGraph fetch failures: Post with clickable link (facets), no card
- Bluesky API errors: Logged to console, continue processing
- Twitter API errors: Entire run fails (auth issues)

## Best Practices

1. Always test with `dryRun: true` first
2. Start with small `maxTweetsPerCheck` values
3. Monitor `crosspost-log.json` for issues
4. Use setup.js for user-friendly config management
5. Keep dependencies updated for security
6. Validate config.json structure before running

## License

MIT License - Permissionless, free to use, modify, and distribute
