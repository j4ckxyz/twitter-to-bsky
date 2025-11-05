import emusks from 'emusks';
import { BskyAgent } from '@atproto/api';
import fs from 'fs/promises';
import { existsSync } from 'fs';

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
async function postToBluesky(text, blueskyHandle, blueskyAppPassword, blueskyService = 'https://bsky.social') {
  const agent = new BskyAgent({ service: blueskyService });
  
  try {
    await agent.login({
      identifier: blueskyHandle,
      password: blueskyAppPassword,
    });
    
    const response = await agent.post({
      text: text,
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
      const preview = tweetText.length > 80 
        ? tweetText.substring(0, 80) + '...' 
        : tweetText;
      
      console.log(`\n📝 Tweet ID: ${tweetId}`);
      console.log(`   Text: "${preview}"`);
      
      if (isDryRun) {
        console.log(`   ⚠️  DRY RUN: Would post to @${blueskyHandle}`);
        
        // In dry run, mark as "would be posted"
        crosspostLog.mappings[twitterUsername][tweetId] = {
          dryRun: true,
          text: tweetText,
          timestamp: new Date().toISOString()
        };
        await saveCrosspostLog();
      } else {
        try {
          const response = await postToBluesky(
            tweetText, 
            blueskyHandle, 
            blueskyAppPassword,
            blueskyService
          );
          
          const blueskyUri = response.uri;
          console.log(`   ✓ Posted to Bluesky!`);
          console.log(`   Bluesky URI: ${blueskyUri}`);
          
          // Log the mapping
          crosspostLog.mappings[twitterUsername][tweetId] = {
            blueskyUri: blueskyUri,
            blueskyHandle: blueskyHandle,
            text: tweetText,
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
