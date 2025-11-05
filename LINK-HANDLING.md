# Link and Facet Handling

## Overview

The tool now intelligently handles links, hashtags, and mentions when crossposting from Twitter to Bluesky. This ensures that posts look native on Bluesky with properly formatted rich text.

## Smart Link Processing

### Problem
Twitter uses t.co shortened links for both:
1. **Media attachments** (images/videos) - should be removed from text
2. **Actual content links** (articles, websites) - should be expanded and preserved

### Solution

The tool now:

1. **Distinguishes between media and content links**:
   - Checks if a t.co URL points to media (using tweet metadata)
   - Identifies pic.twitter.com and pbs.twimg.com URLs as media
   - Removes media links completely from the text
   - Expands content links to their real URLs

2. **Cleans up text artifacts**:
   - Removes trailing phrases like "and this image"
   - Normalizes whitespace
   - Preserves hashtags and mentions in the text

### Examples

#### Tweet with article link + image:
```
Original: "Just published: AI safety research https://t.co/abc123 https://t.co/img456"
URLs:
  - https://t.co/abc123 → https://openai.com/blog/ai-safety (content)
  - https://t.co/img456 → https://pbs.twimg.com/media/xyz.jpg (media)
  
Result: "Just published: AI safety research https://openai.com/blog/ai-safety"
```

#### Tweet with multiple article links:
```
Original: "Read this https://t.co/abc123 and this https://t.co/def456"
URLs:
  - https://t.co/abc123 → https://example.com/article1
  - https://t.co/def456 → https://example.com/article2
  
Result: "Read this https://example.com/article1 and this https://example.com/article2"
```

#### Media-only tweet:
```
Original: "https://t.co/img456"
URLs:
  - https://t.co/img456 → https://pbs.twimg.com/media/xyz.jpg (media)
  
Result: "" (empty text, media will be displayed)
```

## Rich Text Facets

The tool uses AT Protocol's RichText system to automatically detect and format:

### 1. Links
```javascript
"Check this out: https://example.com"

Facet:
{
  "$type": "app.bsky.richtext.facet#link",
  "uri": "https://example.com"
}
```

### 2. Hashtags
```javascript
"This is #awesome and #cool"

Facets:
{
  "$type": "app.bsky.richtext.facet#tag",
  "tag": "awesome"
},
{
  "$type": "app.bsky.richtext.facet#tag",
  "tag": "cool"
}
```

### 3. Mentions
```javascript
"Hey @alice.bsky.social check this out"

Facet:
{
  "$type": "app.bsky.richtext.facet#mention",
  "did": "did:plc:..." // Resolved to DID
}
```

## Implementation Details

### cleanTweetText Function

```javascript
function cleanTweetText(text, tweet) {
  // 1. Collect media URLs from tweet metadata
  const mediaUrls = new Set();
  if (tweet.media) {
    tweet.media.forEach(m => {
      if (m.url) mediaUrls.add(m.url);
      if (m.expanded_url) mediaUrls.add(m.expanded_url);
    });
  }
  
  // 2. Process URL entities
  for (const urlEntity of tweet.urls || []) {
    const tcoUrl = urlEntity.url;
    const expandedUrl = urlEntity.expanded_url;
    
    // Check if media URL
    const isMediaUrl = mediaUrls.has(tcoUrl) || 
                       mediaUrls.has(expandedUrl) ||
                       expandedUrl?.includes('pic.twitter.com') ||
                       expandedUrl?.includes('pbs.twimg.com');
    
    if (isMediaUrl) {
      // Remove media URLs
      cleanedText = cleanedText.replace(tcoUrl, '');
    } else if (expandedUrl) {
      // Expand content URLs
      cleanedText = cleanedText.replace(tcoUrl, expandedUrl);
    }
  }
  
  // 3. Clean up artifacts
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\s+(and this (image|video|gif))?\s*$/i, '')
    .trim();
  
  return cleanedText;
}
```

### postToBluesky Function

```javascript
async function postToBluesky(text, media, ...) {
  const agent = new BskyAgent({ service });
  await agent.login({ identifier, password });
  
  // Upload media (if any)
  // ...
  
  // Detect facets using RichText
  const rt = new RichText({ text });
  await rt.detectFacets(agent); // Resolves mentions to DIDs
  
  // Build post record
  const postRecord = {
    text: rt.text,
    facets: rt.facets, // Includes links, hashtags, mentions
    createdAt: new Date().toISOString(),
  };
  
  if (embed) postRecord.embed = embed;
  if (replyTo) postRecord.reply = replyTo;
  
  return await agent.post(postRecord);
}
```

## Testing

Run the comprehensive test suite to verify link handling:

```bash
node test-link-comprehensive.js
```

This tests:
- Media link removal
- Content link expansion
- Multiple links in one tweet
- Media-only tweets
- Hashtags preservation
- Facet detection

## Benefits

1. **Native Bluesky experience**: Links are clickable, hashtags are tappable
2. **Cleaner posts**: No ugly t.co links or media URL clutter
3. **Preserved functionality**: All original links work correctly
4. **Better readability**: Text flows naturally without shortened URLs
5. **Proper attribution**: Mentions are resolved to actual Bluesky accounts

## Technical Notes

- Uses `@atproto/api` RichText class for facet detection
- Facets use byte offsets (UTF-8 encoding) not character positions
- `detectFacets()` resolves mentions to DIDs via API
- `detectFacetsWithoutResolution()` only detects patterns (for testing)
- Facets are optional - posts work without them but lack rich formatting
