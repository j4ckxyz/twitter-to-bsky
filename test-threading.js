import emusks from 'emusks';
import { BskyAgent } from '@atproto/api';
import fs from 'fs/promises';

// Simple test script for threading functionality
// This script lets you test against any Twitter account to see thread detection

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║        Thread Detection Test Tool                         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Get credentials from command line or prompt
const twitterAuthToken = process.env.TWITTER_AUTH_TOKEN;
const twitterUsername = process.argv[2] || 'OpenAI';
const blueskyHandle = process.argv[3];
const blueskyAppPassword = process.argv[4];

if (!twitterAuthToken) {
  console.error('Error: TWITTER_AUTH_TOKEN environment variable required');
  console.error('Usage: TWITTER_AUTH_TOKEN=xxx node test-threading.js <twitter_username> [bsky_handle] [bsky_password]');
  console.error('Example: TWITTER_AUTH_TOKEN=xxx node test-threading.js OpenAI test.bsky.social xxxx-xxxx-xxxx-xxxx');
  process.exit(1);
}

console.log(`Testing thread detection for @${twitterUsername}\n`);

// Initialize Twitter client
const twitterClient = new emusks({
  authToken: twitterAuthToken,
});

try {
  await twitterClient.login();
  console.log(`✓ Logged in to Twitter\n`);
  
  // Get user info
  const user = await twitterClient.getUser(twitterUsername);
  if (!user) {
    console.error(`✗ Could not find Twitter user @${twitterUsername}`);
    process.exit(1);
  }
  
  console.log(`✓ Found user: @${user.username} (ID: ${user.id})`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Followers: ${user.followers_count?.toLocaleString() || 'N/A'}\n`);
  
  // Get recent tweets
  console.log('Fetching recent tweets...\n');
  const result = await twitterClient.getUserTweets(user.id, {
    count: 20,
    includePromotedContent: false,
  });
  
  if (!result.tweets || result.tweets.length === 0) {
    console.log('No tweets found.');
    process.exit(0);
  }
  
  console.log(`✓ Fetched ${result.tweets.length} tweets\n`);
  console.log('='.repeat(60));
  
  // Analyze each tweet for threading
  for (const tweet of result.tweets) {
    const isReply = tweet.in_reply_to_status_id !== null;
    const isSelfReply = isReply && tweet.in_reply_to_user_id === user.id;
    const textPreview = (tweet.text || '').substring(0, 100).replace(/\n/g, ' ');
    
    console.log(`\nTweet ID: ${tweet.id}`);
    console.log(`Text: "${textPreview}${tweet.text?.length > 100 ? '...' : ''}"`);
    console.log(`Length: ${tweet.text?.length || 0} chars`);
    
    if (isReply) {
      console.log(`📌 Reply to: ${tweet.in_reply_to_status_id}`);
      if (isSelfReply) {
        console.log(`🧵 THREAD CONTINUATION (self-reply)`);
      } else {
        console.log(`💬 Reply to another user`);
      }
    }
    
    if (tweet.media && tweet.media.length > 0) {
      console.log(`📷 Media: ${tweet.media.length} item(s)`);
    }
    
    // Check if text would need splitting
    if (tweet.text && tweet.text.length > 300) {
      const chunks = Math.ceil(tweet.text.length / 300);
      console.log(`✂️  Would split into ~${chunks} posts (${tweet.text.length} > 300 chars)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Find threads
  console.log('\n🧵 Thread Analysis:\n');
  
  const rootTweets = result.tweets.filter(t => !t.in_reply_to_status_id || t.in_reply_to_user_id !== user.id);
  const selfReplies = result.tweets.filter(t => t.in_reply_to_user_id === user.id);
  
  console.log(`Root tweets (not self-replies): ${rootTweets.length}`);
  console.log(`Self-replies (thread continuations): ${selfReplies.length}\n`);
  
  // Group by thread
  const threads = new Map();
  
  for (const tweet of result.tweets) {
    if (!tweet.in_reply_to_status_id || tweet.in_reply_to_user_id !== user.id) {
      // This is a root tweet
      if (!threads.has(tweet.id)) {
        threads.set(tweet.id, []);
      }
    }
  }
  
  // Add replies to their threads
  for (const tweet of selfReplies) {
    const parentId = tweet.in_reply_to_status_id;
    if (threads.has(parentId)) {
      threads.get(parentId).push(tweet);
    }
  }
  
  // Show threads
  let threadCount = 0;
  for (const [rootId, replies] of threads.entries()) {
    if (replies.length > 0) {
      threadCount++;
      const rootTweet = result.tweets.find(t => t.id === rootId);
      console.log(`Thread ${threadCount}:`);
      console.log(`  Root: ${rootId} - "${(rootTweet?.text || '').substring(0, 60)}..."`);
      console.log(`  Replies: ${replies.length}`);
      for (const reply of replies) {
        console.log(`    └─ ${reply.id} - "${(reply.text || '').substring(0, 50)}..."`);
      }
      console.log();
    }
  }
  
  if (threadCount === 0) {
    console.log('No threads found in recent tweets.\n');
  }
  
  // Test actual posting if credentials provided
  if (blueskyHandle && blueskyAppPassword) {
    console.log('='.repeat(60));
    console.log('\n🧪 Testing Bluesky posting...\n');
    
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    
    try {
      await agent.login({
        identifier: blueskyHandle,
        password: blueskyAppPassword,
      });
      
      console.log(`✓ Logged in to Bluesky as @${blueskyHandle}`);
      
      // Test a simple threaded post
      console.log('\nCreating test thread...');
      
      const testText = 'This is a test of thread functionality from twitter-to-bsky tool. Testing automatic threading... ' + 
                       'This text is intentionally long to test the automatic splitting feature that should split posts ' +
                       'longer than 300 characters into multiple threaded posts. Let me add more text here to make sure ' +
                       'we exceed the limit and trigger the splitting logic properly.';
      
      console.log(`\nTest text length: ${testText.length} chars`);
      
      // Split into chunks
      const chunks = [];
      let remaining = testText;
      const maxLength = 300;
      
      while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
          chunks.push(remaining);
          break;
        }
        
        const lastSpace = remaining.substring(0, maxLength).lastIndexOf(' ');
        const splitIndex = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;
        
        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
      }
      
      console.log(`Split into ${chunks.length} chunks\n`);
      
      let rootPost = null;
      let lastPost = null;
      
      for (let i = 0; i < chunks.length; i++) {
        const postRecord = {
          text: chunks[i],
          createdAt: new Date().toISOString(),
        };
        
        if (i > 0 && lastPost) {
          postRecord.reply = {
            root: { uri: rootPost.uri, cid: rootPost.cid },
            parent: { uri: lastPost.uri, cid: lastPost.cid }
          };
        }
        
        const response = await agent.post(postRecord);
        
        if (i === 0) {
          rootPost = response;
          console.log(`✓ Posted root: ${response.uri}`);
        } else {
          console.log(`✓ Posted reply ${i}: ${response.uri}`);
        }
        
        lastPost = response;
        
        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n✓ Successfully created thread!`);
      console.log(`  View at: https://bsky.app/profile/${blueskyHandle}`);
      
    } catch (error) {
      console.error(`\n✗ Bluesky test failed: ${error.message}`);
    }
  } else {
    console.log('\n💡 To test actual Bluesky posting, provide credentials:');
    console.log('   node test-threading.js OpenAI your.handle.bsky.social xxxx-xxxx-xxxx-xxxx');
  }
  
} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n✓ Test complete!\n');
