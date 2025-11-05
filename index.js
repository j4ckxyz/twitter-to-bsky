import emusks from 'emusks';
import { BskyAgent, RichText } from '@atproto/api';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import sizeOf from 'image-size';
import ogs from 'open-graph-scraper';

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

// Load crosspost log (maps tweet IDs to Bluesky URIs and thread info)
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

// Function to fetch OpenGraph metadata and thumbnail for external link embeds
async function fetchOpenGraphData(url, agent) {
  try {
    console.log(`    🔗 Fetching OpenGraph data for: ${url}`);
    
    const { result } = await ogs({ url });
    
    if (!result.success) {
      console.log(`    ⚠️  OpenGraph fetch failed for ${url}`);
      return null;
    }
    
    const ogData = {
      uri: url,
      title: result.ogTitle || result.twitterTitle || 'Link',
      description: result.ogDescription || result.twitterDescription || '',
    };
    
    // Try to get thumbnail image
    const imageUrl = result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url;
    
    if (imageUrl) {
      try {
        // Download the thumbnail
        const thumbBuffer = await downloadFile(imageUrl);
        
        // Upload to Bluesky
        const uploadResponse = await agent.uploadBlob(thumbBuffer, {
          encoding: 'image/jpeg', // Most OG images are JPEG
        });
        
        ogData.thumb = uploadResponse.data.blob;
        console.log(`    ✓ Uploaded OpenGraph thumbnail`);
      } catch (thumbError) {
        console.log(`    ⚠️  Failed to fetch/upload thumbnail: ${thumbError.message}`);
        // Continue without thumbnail
      }
    }
    
    console.log(`    ✓ OpenGraph data: "${ogData.title}"`);
    return ogData;
    
  } catch (error) {
    console.log(`    ⚠️  Error fetching OpenGraph data: ${error.message}`);
    return null;
  }
}

// Function to clean tweet text and expand URLs
function cleanTweetText(text, tweet) {
  if (!text) {
    return text;
  }
  
  let cleanedText = text;
  
  // Get media URLs from the tweet if present
  const mediaUrls = new Set();
  if (tweet.media && tweet.media.length > 0) {
    tweet.media.forEach(m => {
      if (m.url) mediaUrls.add(m.url);
      if (m.expanded_url) mediaUrls.add(m.expanded_url);
    });
  }
  
  // Get all URL entities from the tweet
  const urlEntities = tweet.urls || [];
  
  // Process each URL entity
  for (const urlEntity of urlEntities) {
    const tcoUrl = urlEntity.url; // The t.co shortened URL
    const expandedUrl = urlEntity.expanded_url; // The real URL
    
    // Check if this t.co URL is for media (should be removed)
    const isMediaUrl = mediaUrls.has(tcoUrl) || 
                       mediaUrls.has(expandedUrl) ||
                       (expandedUrl && (
                         expandedUrl.includes('pic.twitter.com') ||
                         expandedUrl.includes('pbs.twimg.com')
                       ));
    
    if (isMediaUrl) {
      // Remove media URLs completely
      cleanedText = cleanedText.replace(tcoUrl, '').trim();
    } else if (expandedUrl) {
      // Replace t.co URL with expanded URL for actual links
      cleanedText = cleanedText.replace(tcoUrl, expandedUrl);
    }
  }
  
  // Clean up extra whitespace and common trailing phrases
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\s+(and this (image|video|gif))?\s*$/i, '')
    .trim();
  
  return cleanedText;
}

// Function to extract the first external link from text
function extractExternalLink(text, tweet) {
  // Get all URL entities from the tweet
  const urlEntities = tweet.urls || [];
  
  // Get media URLs to exclude
  const mediaUrls = new Set();
  if (tweet.media && tweet.media.length > 0) {
    tweet.media.forEach(m => {
      if (m.url) mediaUrls.add(m.url);
      if (m.expanded_url) mediaUrls.add(m.expanded_url);
    });
  }
  
  // Find first non-media URL
  for (const urlEntity of urlEntities) {
    const expandedUrl = urlEntity.expanded_url;
    
    // Skip media URLs
    const isMediaUrl = mediaUrls.has(urlEntity.url) || 
                       mediaUrls.has(expandedUrl) ||
                       (expandedUrl && (
                         expandedUrl.includes('pic.twitter.com') ||
                         expandedUrl.includes('pbs.twimg.com')
                       ));
    
    if (!isMediaUrl && expandedUrl) {
      return expandedUrl;
    }
  }
  
  return null;
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
          
          // Extract dimensions from video URL (format: /vid/WIDTHxHEIGHT/)
          // or use metadata if available
          let width = 1280;
          let height = 720;
          
          const dimensionsMatch = videoUrl.match(/\/vid\/(\d+)x(\d+)\//);
          if (dimensionsMatch) {
            width = parseInt(dimensionsMatch[1], 10);
            height = parseInt(dimensionsMatch[2], 10);
          } else if (video.sizes?.large) {
            width = video.sizes.large.w;
            height = video.sizes.large.h;
          } else if (video.original_info) {
            width = video.original_info.width;
            height = video.original_info.height;
          }
          
          return {
            type: 'video',
            data: {
              buffer,
              duration: durationMs,
              width,
              height,
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

// Function to get thread tweets (replies from the same author to their own tweets)
async function getThreadTweets(userId, rootTweetId) {
  try {
    // Search for replies from the user to the specific tweet
    const result = await twitterClient.getUserTweets(userId, {
      count: 100, // Get more tweets to find replies
      includePromotedContent: false,
    });
    
    if (!result.tweets) {
      return [];
    }
    
    // Find all tweets that are replies to the root tweet by the same user
    const threadTweets = result.tweets.filter(tweet => 
      tweet.in_reply_to_status_id === rootTweetId
    );
    
    return threadTweets;
  } catch (error) {
    console.error(`  ⚠️  Failed to fetch thread tweets: ${error.message}`);
    return [];
  }
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

// Function to split text into chunks for threading
function splitTextForThreading(text, maxLength = 300) {
  // If text fits in one post, return as is
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // Try to split at a natural boundary (sentence, then word)
    let splitIndex = maxLength;
    
    // Look for sentence ending within the limit
    const sentenceEnd = remaining.substring(0, maxLength).lastIndexOf('. ');
    if (sentenceEnd > maxLength * 0.5) {
      splitIndex = sentenceEnd + 1;
    } else {
      // Look for word boundary
      const lastSpace = remaining.substring(0, maxLength).lastIndexOf(' ');
      if (lastSpace > maxLength * 0.5) {
        splitIndex = lastSpace;
      }
    }
    
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  
  return chunks;
}

// Function to post to Bluesky with optional threading support
async function postToBluesky(text, media, blueskyHandle, blueskyAppPassword, blueskyService = 'https://bsky.social', replyTo = null, externalLink = null) {
  const agent = new BskyAgent({ service: blueskyService });
  
  try {
    await agent.login({
      identifier: blueskyHandle,
      password: blueskyAppPassword,
    });
    
    let embed = undefined;
    
    // Upload media if present (media takes priority over external links)
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
          aspectRatio: {
            width: media.data.width,
            height: media.data.height,
          },
          alt: '',
        };
      }
    } else if (externalLink) {
      // No media, but we have an external link - create OpenGraph card embed
      const ogData = await fetchOpenGraphData(externalLink, agent);
      
      if (ogData) {
        embed = {
          $type: 'app.bsky.embed.external',
          external: ogData,
        };
      }
    }
    
    // Use RichText to detect facets (links, mentions, hashtags)
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    
    // Build post record
    const postRecord = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };
    
    if (embed) {
      postRecord.embed = embed;
    }
    
    // Add reply reference if this is part of a thread
    if (replyTo) {
      postRecord.reply = {
        root: replyTo.root,
        parent: replyTo.parent,
      };
    }
    
    const response = await agent.post(postRecord);
    
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
      
      // Extract external link for OpenGraph card embed (if no media present)
      const externalLink = !media ? extractExternalLink(cleanedText, tweet) : null;
      if (externalLink) {
        console.log(`   🔗 Found external link: ${externalLink}`);
      }
      
      // Check if we need to split into multiple posts
      const textChunks = splitTextForThreading(cleanedText);
      const needsThreading = textChunks.length > 1;
      
      if (needsThreading) {
        console.log(`   🧵 Text is long (${cleanedText.length} chars), splitting into ${textChunks.length} posts`);
      }
      
      // Check for Twitter thread continuation (replies from same author)
      let threadReplies = [];
      try {
        threadReplies = await getThreadTweets(user.id, tweetId);
        if (threadReplies.length > 0) {
          console.log(`   🧵 Found ${threadReplies.length} thread continuation(s) from author`);
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to check for thread: ${error.message}`);
      }
      
      const preview = cleanedText.length > 80 
        ? cleanedText.substring(0, 80) + '...' 
        : cleanedText;
      
      console.log(`\n📝 Tweet ID: ${tweetId}`);
      console.log(`   Text: "${preview}"`);
      
      if (isDryRun) {
        console.log(`   ⚠️  DRY RUN: Would post to @${blueskyHandle}${mediaInfo}`);
        if (needsThreading) {
          console.log(`   ⚠️  DRY RUN: Would create ${textChunks.length} threaded posts`);
        }
        if (threadReplies.length > 0) {
          console.log(`   ⚠️  DRY RUN: Would post ${threadReplies.length} thread continuation(s)`);
        }
        
        // In dry run, mark as "would be posted"
        crosspostLog.mappings[twitterUsername][tweetId] = {
          dryRun: true,
          text: cleanedText,
          hasMedia: media !== null,
          mediaType: media?.type,
          chunks: textChunks.length,
          threadReplies: threadReplies.length,
          timestamp: new Date().toISOString()
        };
        await saveCrosspostLog();
      } else {
        try {
          let rootPost = null;
          let lastPost = null;
          
          // Post all text chunks (if split due to length)
          for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            const isFirstChunk = i === 0;
            const chunkMedia = isFirstChunk ? media : null; // Only attach media to first post
            const chunkExternalLink = isFirstChunk ? externalLink : null; // Only attach external link to first post
            
            let replyTo = null;
            if (!isFirstChunk && lastPost) {
              // This chunk is a reply to the previous chunk
              replyTo = {
                root: { uri: rootPost.uri, cid: rootPost.cid },
                parent: { uri: lastPost.uri, cid: lastPost.cid }
              };
            }
            
            const response = await postToBluesky(
              chunk,
              chunkMedia,
              blueskyHandle, 
              blueskyAppPassword,
              blueskyService,
              replyTo,
              chunkExternalLink
            );
            
            if (isFirstChunk) {
              rootPost = response;
              console.log(`   ✓ Posted to Bluesky!${mediaInfo}`);
              console.log(`   Bluesky URI: ${response.uri}`);
            } else {
              console.log(`   ✓ Posted chunk ${i + 1}/${textChunks.length} as thread`);
            }
            
            lastPost = response;
            
            // Rate limiting between chunks
            if (i < textChunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // Now post any Twitter thread continuations
          for (let i = 0; i < threadReplies.length; i++) {
            const replyTweet = threadReplies[i];
            const replyTweetId = replyTweet.id;
            
            // Skip if already posted
            if (crosspostLog.mappings[twitterUsername][replyTweetId]) {
              console.log(`   ⊘ Thread reply ${replyTweetId} already posted, skipping`);
              continue;
            }
            
            const replyText = cleanTweetText(replyTweet.text || '', replyTweet);
            const replyChunks = splitTextForThreading(replyText);
            
            // Process media for reply
            let replyMedia = null;
            try {
              replyMedia = await processMediaFromTweet(replyTweet);
            } catch (error) {
              console.error(`   ⚠️  Failed to process reply media: ${error.message}`);
            }
            
            // Extract external link for reply (if no media present)
            const replyExternalLink = !replyMedia ? extractExternalLink(replyText, replyTweet) : null;
            
            // Post all chunks of this reply
            for (let j = 0; j < replyChunks.length; j++) {
              const replyChunk = replyChunks[j];
              const isFirstReplyChunk = j === 0;
              const replyChunkMedia = isFirstReplyChunk ? replyMedia : null;
              const replyChunkExternalLink = isFirstReplyChunk ? replyExternalLink : null;
              
              const replyTo = {
                root: { uri: rootPost.uri, cid: rootPost.cid },
                parent: { uri: lastPost.uri, cid: lastPost.cid }
              };
              
              const replyResponse = await postToBluesky(
                replyChunk,
                replyChunkMedia,
                blueskyHandle,
                blueskyAppPassword,
                blueskyService,
                replyTo,
                replyChunkExternalLink
              );
              
              if (isFirstReplyChunk && replyChunks.length === 1) {
                console.log(`   ✓ Posted thread reply ${i + 1}/${threadReplies.length}`);
              } else if (isFirstReplyChunk) {
                console.log(`   ✓ Posted thread reply ${i + 1}/${threadReplies.length} (chunk ${j + 1}/${replyChunks.length})`);
              } else {
                console.log(`   ✓ Posted chunk ${j + 1}/${replyChunks.length} of thread reply`);
              }
              
              lastPost = replyResponse;
              
              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Log the thread reply
            crosspostLog.mappings[twitterUsername][replyTweetId] = {
              blueskyUri: lastPost.uri,
              blueskyHandle: blueskyHandle,
              text: replyText,
              hasMedia: replyMedia !== null,
              mediaType: replyMedia?.type,
              parentTweetId: tweetId,
              chunks: replyChunks.length,
              timestamp: new Date().toISOString()
            };
            await saveCrosspostLog();
          }
          
          // Log the root tweet mapping
          crosspostLog.mappings[twitterUsername][tweetId] = {
            blueskyUri: rootPost.uri,
            blueskyHandle: blueskyHandle,
            text: cleanedText,
            hasMedia: media !== null,
            mediaType: media?.type,
            chunks: textChunks.length,
            threadReplies: threadReplies.length,
            timestamp: new Date().toISOString()
          };
          await saveCrosspostLog();
          
          // Rate limiting - wait a bit between root tweets
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
