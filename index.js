import emusks from 'emusks';
import { BskyAgent } from '@atproto/api';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import sizeOf from 'image-size';

// Load configuration
let config;
try {
  config = JSON.parse(await fs.readFile('./config.json', 'utf-8'));
} catch (error) {
  console.error('Error loading config.json. Please create a config.json file.');
  console.error('See config.example.json for reference.');
  process.exit(1);
}

// Validate configuration
if (!config.twitter?.authToken) {
  console.error('Error: Twitter auth token is required in config.json');
  console.error('Please add your Twitter auth_token to config.json');
  process.exit(1);
}

// Load crosspost log (maps tweet IDs to Bluesky URIs)
let crosspostLog = { mappings: {} };
if (existsSync('./crosspost-log.json')) {
  crosspostLog = JSON.parse(await fs.readFile('./crosspost-log.json', 'utf-8'));
}

// Ensure structure exists
if (!crosspostLog.mappings) {
  crosspostLog.mappings = {};
}

// Save crosspost log
async function saveCrosspostLog() {
  await fs.writeFile('./crosspost-log.json', JSON.stringify(crosspostLog, null, 2));
}

// Initialize Twitter client (read-only)
let twitterClient;
try {
  twitterClient = new emusks({
    authToken: config.twitter.authToken,
  });
  
  await twitterClient.login();
  console.log(`✓ Logged in to Twitter as @${twitterClient.user.username}\n`);
} catch (error) {
  console.error('Error logging in to Twitter:', error.message);
  console.error('Please check your auth_token in config.json');
  process.exit(1);
}

// Function to download file from URL
async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Function to get image dimensions
function getImageDimensions(buffer) {
  try {
    const dimensions = sizeOf(buffer);
    return {
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio: {
        width: dimensions.width,
        height: dimensions.height
      }
    };
  } catch (error) {
    console.error(`    ⚠️  Failed to get image dimensions: ${error.message}`);
    // Return default aspect ratio if we can't determine it
    return {
      width: 1000,
      height: 1000,
      aspectRatio: {
        width: 1,
        height: 1
      }
    };
  }
}

// Function to clean tweet text by removing media-only t.co links
function cleanTweetText(text, tweet) {
  if (!text || !tweet.media || tweet.media.length === 0) {
    return text;
  }
  
  // Extract all t.co URLs from the text
  const tcoUrlPattern = /https:\/\/t\.co\/[a-zA-Z0-9]+/g;
  const tcoUrls = text.match(tcoUrlPattern) || [];
  
  // If there are no t.co URLs, return as is
  if (tcoUrls.length === 0) {
    return text;
  }
  
  let cleanedText = text;
  
  // Remove each t.co URL from the text
  for (const url of tcoUrls) {
    cleanedText = cleanedText.replace(url, '').trim();
  }
  
  // Clean up extra whitespace
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  
  // If the text is now empty or only whitespace, and we have media, 
  // it means the tweet was media-only
  if (!cleanedText || cleanedText.length === 0) {
    return ''; // Return empty string for media-only posts
  }
  
  // If removing the URLs left us with actual content, return the cleaned text
  // Otherwise return the original (in case the URL wasn't just for media)
  return cleanedText.length > 0 ? cleanedText : text;
}

// Function to process media from tweet
async function processMediaFromTweet(tweet) {
  if (!tweet.media || tweet.media.length === 0) {
    return null;
  }
  
  const images = tweet.media.filter(m => m.type === 'photo');
  const videos = tweet.media.filter(m => m.type === 'video' || m.type === 'animated_gif');
  
  // Bluesky supports either up to 4 images OR 1 video
  if (images.length > 0 && images.length <= 4) {
    // Download images
    const imageData = [];
    for (const img of images.slice(0, 4)) {
      try {
        const imageUrl = img.media_url_https || img.url;
        const buffer = await downloadFile(imageUrl);
        const dimensions = getImageDimensions(buffer);
        
        imageData.push({
          buffer,
          alt: '', // Could extract from tweet text if available
          aspectRatio: dimensions.aspectRatio,
        });
      } catch (error) {
        console.error(`    ⚠️  Failed to download image: ${error.message}`);
      }
    }
    
    if (imageData.length > 0) {
      return { type: 'images', data: imageData };
    }
  } else if (videos.length > 0) {
    // Get the first video
    const video = videos[0];
    
    if (video.video_info?.variants) {
      // Get highest quality MP4 variant
      const mp4Variants = video.video_info.variants
        .filter(v => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (mp4Variants.length > 0) {
        try {
          const videoUrl = mp4Variants[0].url;
          const buffer = await downloadFile(videoUrl);
          const sizeMB = buffer.length / (1024 * 1024);
          const durationMs = video.video_info.duration_millis || 0;
          const durationMin = durationMs / (1000 * 60);
          
          // Check Bluesky constraints: 100MB max, ~3 minutes max
          if (sizeMB > 100) {
            console.error(`    ⚠️  Video too large: ${sizeMB.toFixed(2)}MB (max 100MB)`);
            return null;
          }
          
          if (durationMin > 3) {
            console.error(`    ⚠️  Video too long: ${durationMin.toFixed(2)}min (max ~3min)`);
            return null;
          }
          
          return {
            type: 'video',
            data: {
              buffer,
              duration: durationMs,
            },
          };
        } catch (error) {
          console.error(`    ⚠️  Failed to download video: ${error.message}`);
        }
      }
    }
  } else if (images.length > 4) {
    console.log(`    ⚠️  Tweet has ${images.length} images (max 4), will link to tweet instead`);
  }
  
  return null;
}

// Function to get skip reason
function getSkipReason(tweet) {
  // Check for replies - tweet has in_reply_to_status_id field
  if (!config.options.includeReplies && tweet.in_reply_to_status_id) {
    return 'reply';
  }
  
  // Check for retweets - text starts with "RT @username:"
  // The emusks package doesn't provide retweetedStatus, so we detect by text pattern
  if (!config.options.includeRetweets && tweet.text?.startsWith('RT @')) {
    return 'retweet';
  }
  
  // Check for quote tweets - has quoting field
  if (!config.options.includeQuoteTweets && tweet.quoting) {
    return 'quote';
  }
  
  return null;
}

// Function to post to Bluesky
async function postToBluesky(text, media, blueskyHandle, blueskyAppPassword, blueskyService = 'https://bsky.social') {
  const agent = new BskyAgent({ service: blueskyService });
  
  try {
    await agent.login({
      identifier: blueskyHandle,
      password: blueskyAppPassword,
    });
    
    let embed = undefined;
    
    // Upload media if present
    if (media) {
      if (media.type === 'images') {
        // Upload images and create embed
        const uploadedImages = [];
        
        for (const img of media.data) {
          const uploadResponse = await agent.uploadBlob(img.buffer, {
            encoding: 'image/jpeg',
          });
          
          uploadedImages.push({
            alt: img.alt,
            image: uploadResponse.data.blob,
            aspectRatio: img.aspectRatio,
          });
        }
        
        embed = {
          $type: 'app.bsky.embed.images',
          images: uploadedImages,
        };
        
      } else if (media.type === 'video') {
        // Upload video
        const uploadResponse = await agent.uploadBlob(media.data.buffer, {
          encoding: 'video/mp4',
        });
        
        embed = {
          $type: 'app.bsky.embed.video',
          video: uploadResponse.data.blob,
        };
      }
    }
    
    const response = await agent.post({
      text: text,
      embed: embed,
      createdAt: new Date().toISOString(),
    });
    
    return response;
  } catch (error) {
    console.error(`  ✗ Error posting to Bluesky @${blueskyHandle}:`, error.message);
    throw error;
  }
}

// Function to process tweets for a specific Twitter account
async function processTweetsForAccount(mapping) {
  const { 
    twitterUsername, 
    blueskyHandle, 
    blueskyAppPassword,
    blueskyService = 'https://bsky.social' 
  } = mapping;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: @${twitterUsername} → @${blueskyHandle}`);
  console.log(`PDS: ${blueskyService}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Get user info
    const user = await twitterClient.getUser(twitterUsername);
    if (!user) {
      console.error(`  ✗ Could not find Twitter user @${twitterUsername}`);
      return;
    }
    
    console.log(`✓ Found Twitter user: @${user.username} (ID: ${user.id})`);
    
    // Get user's tweets
    const result = await twitterClient.getUserTweets(user.id, {
      count: config.options.maxTweetsPerCheck,
      includePromotedContent: false,
    });
    
    if (!result.tweets || result.tweets.length === 0) {
      console.log(`  No tweets found for @${twitterUsername}`);
      return;
    }
    
    console.log(`✓ Fetched ${result.tweets.length} recent tweets\n`);
    
    // Initialize crosspost log for this user if needed
    if (!crosspostLog.mappings[twitterUsername]) {
      crosspostLog.mappings[twitterUsername] = {};
    }
    
    // Process tweets (newest first, but we'll reverse to post oldest first)
    const tweetsToPost = [];
    let skippedCount = { already_posted: 0, reply: 0, retweet: 0, quote: 0 };
    
    for (const tweet of result.tweets.reverse()) {
      const tweetId = tweet.id;
      
      // Skip if already posted
      if (crosspostLog.mappings[twitterUsername][tweetId]) {
        skippedCount.already_posted++;
        continue;
      }
      
      // Check if should skip based on type
      const skipReason = getSkipReason(tweet);
      if (skipReason) {
        console.log(`⊘ Skipping tweet ${tweetId} (${skipReason})`);
        skippedCount[skipReason]++;
        
        // Mark as skipped so we don't process it again
        crosspostLog.mappings[twitterUsername][tweetId] = {
          skipped: true,
          reason: skipReason,
          timestamp: new Date().toISOString()
        };
        await saveCrosspostLog();
        continue;
      }
      
      tweetsToPost.push(tweet);
    }
    
    console.log(`\n--- Summary ---`);
    console.log(`Total fetched: ${result.tweets.length}`);
    console.log(`Already posted: ${skippedCount.already_posted}`);
    console.log(`Skipped (replies): ${skippedCount.reply}`);
    console.log(`Skipped (retweets): ${skippedCount.retweet}`);
    console.log(`Skipped (quotes): ${skippedCount.quote}`);
    console.log(`Ready to post: ${tweetsToPost.length}\n`);
    
    // Post to Bluesky (or simulate in dry-run mode)
    const isDryRun = config.options.dryRun === true;
    
    if (isDryRun) {
      console.log(`🔍 DRY RUN MODE - Not actually posting to Bluesky\n`);
    }
    
    for (const tweet of tweetsToPost) {
      const tweetId = tweet.id;
      const tweetText = tweet.text || '';
      
      // Process media first to determine if we should clean the text
      let media = null;
      let mediaInfo = '';
      try {
        media = await processMediaFromTweet(tweet);
        if (media) {
          if (media.type === 'images') {
            mediaInfo = ` [${media.data.length} image(s)]`;
            console.log(`   📷 Downloading ${media.data.length} image(s)...`);
          } else if (media.type === 'video') {
            const sizeMB = media.data.buffer.length / (1024 * 1024);
            mediaInfo = ` [video: ${sizeMB.toFixed(2)}MB]`;
            console.log(`   🎥 Downloading video (${sizeMB.toFixed(2)}MB)...`);
          }
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to process media: ${error.message}`);
      }
      
      // Clean the tweet text (remove t.co links if they're only for media)
      const cleanedText = cleanTweetText(tweetText, tweet);
      const preview = cleanedText.length > 80 
        ? cleanedText.substring(0, 80) + '...' 
        : cleanedText;
      
      console.log(`\n📝 Tweet ID: ${tweetId}`);
      console.log(`   Text: "${preview}"`);
      
      if (isDryRun) {
        console.log(`   ⚠️  DRY RUN: Would post to @${blueskyHandle}${mediaInfo}`);
        
        // In dry run, mark as "would be posted"
        crosspostLog.mappings[twitterUsername][tweetId] = {
          dryRun: true,
          text: cleanedText,
          hasMedia: media !== null,
          mediaType: media?.type,
          timestamp: new Date().toISOString()
        };
        await saveCrosspostLog();
      } else {
        try {
          const response = await postToBluesky(
            cleanedText,
            media,
            blueskyHandle, 
            blueskyAppPassword,
            blueskyService
          );
          
          const blueskyUri = response.uri;
          console.log(`   ✓ Posted to Bluesky!${mediaInfo}`);
          console.log(`   Bluesky URI: ${blueskyUri}`);
          
          // Log the mapping
          crosspostLog.mappings[twitterUsername][tweetId] = {
            blueskyUri: blueskyUri,
            blueskyHandle: blueskyHandle,
            text: cleanedText,
            hasMedia: media !== null,
            mediaType: media?.type,
            timestamp: new Date().toISOString()
          };
          await saveCrosspostLog();
          
          // Rate limiting - wait a bit between posts
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`   ✗ Failed to post: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`\n✗ Error processing @${twitterUsername}:`, error.message);
    console.error(error.stack);
  }
}

// Main execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        Twitter to Bluesky Crosspost Tool                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (config.options.dryRun) {
    console.log('⚠️  DRY RUN MODE ENABLED - No posts will be made to Bluesky');
    console.log('   Set "dryRun": false in config.json to actually post\n');
  }
  
  if (config.crosspostMappings.length === 0) {
    console.log('No crosspost mappings configured.');
    console.log('Please add mappings to config.json');
    console.log('See config.example.json for reference.');
    return;
  }
  
  console.log(`Processing ${config.crosspostMappings.length} mapping(s)...\n`);
  
  // Process each mapping
  for (const mapping of config.crosspostMappings) {
    await processTweetsForAccount(mapping);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Completed                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (config.options.dryRun) {
    console.log('Check crosspost-log.json to see what would have been posted.');
  } else {
    console.log('Check crosspost-log.json for the mapping of tweets to Bluesky posts.');
  }
}

main().catch(console.error);
