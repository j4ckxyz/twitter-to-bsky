# Media Testing Guide

This guide helps you test media downloading from Twitter and uploading to Bluesky.

## Step 1: Test Twitter Media Download

Add your Twitter auth token to `config.json`, then run:

```bash
node test-media.js YOUR_AUTH_TOKEN elonmusk
```

This will:
- Fetch recent tweets from the specified user
- Find tweets with images and videos
- Show media URLs and structure
- Download a test image to `./test-image.jpg`
- Download a test video to `./test-video.mp4`
- Print full media structure for inspection

## Step 2: Test Bluesky Image Upload

Use your Bluesky credentials to test uploading:

```bash
node test-bsky-media.js your.bsky.social your-app-password ./test-image.jpg
```

This will:
- Login to Bluesky
- Check video upload limits (if available)
- Upload the image as a blob
- Create a test post with the image
- Print the post URI and full response

## What to Look For

### Twitter Media Structure
- **Images**: `tweet.media` array with `type: 'photo'`
  - URL field: `media_url_https` or `url`
- **Videos**: `tweet.media` array with `type: 'video'` or `'animated_gif'`
  - Contains `video_info.variants` array with different quality options
  - Filter for `content_type: 'video/mp4'`
  - Choose variant by bitrate (higher = better quality)

### Bluesky Constraints
- **Images**: Up to 4 images per post
- **Videos**: 1 video per post, max 100MB, max ~3 minutes
- **Embed structure**:
  - Images: `app.bsky.embed.images`
  - Video: `app.bsky.embed.video`

## Next Steps

Once both tests work:
1. Verify image downloads correctly from Twitter
2. Verify image uploads correctly to Bluesky
3. Check video download/upload flow
4. Implement media logic in main `index.js`
