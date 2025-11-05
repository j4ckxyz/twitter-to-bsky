import { BskyAgent } from '@atproto/api';

// Manual thread test - demonstrates threading functionality
console.log('\n🧵 Manual Thread Test\n');

const blueskyHandle = 'openaibot.bsky.social';
const blueskyAppPassword = 'mnta-uqen-oa6o-gt67';

const agent = new BskyAgent({ service: 'https://bsky.social' });

try {
  await agent.login({
    identifier: blueskyHandle,
    password: blueskyAppPassword,
  });
  
  console.log(`✓ Logged in as @${blueskyHandle}\n`);
  
  // Test 1: Long text auto-threading (>300 chars)
  console.log('Test 1: Auto-threading long text\n');
  
  const longText = 'This is a test of the automatic text splitting feature. ' +
    'When a tweet exceeds 300 characters, the tool automatically splits it into multiple posts ' +
    'and threads them together using proper AT Protocol references. ' +
    'This ensures that long-form content from Twitter is properly preserved on Bluesky. ' +
    'The splitting happens at natural boundaries like sentence endings or word breaks ' +
    'to maintain readability and context across the thread.';
  
  console.log(`Text length: ${longText.length} chars`);
  console.log(`Will split at 300 chars boundary\n`);
  
  // Split the text
  const chunk1 = longText.substring(0, 300);
  const chunk2 = longText.substring(300);
  
  console.log(`Chunk 1 (${chunk1.length} chars): "${chunk1}"`);
  console.log(`Chunk 2 (${chunk2.length} chars): "${chunk2}"\n`);
  
  // Post first chunk (root)
  const post1 = await agent.post({
    text: chunk1,
    createdAt: new Date().toISOString(),
  });
  
  console.log(`✓ Posted root: ${post1.uri}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Post second chunk (reply to first)
  const post2 = await agent.post({
    text: chunk2,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri: post1.uri, cid: post1.cid },
      parent: { uri: post1.uri, cid: post1.cid }
    }
  });
  
  console.log(`✓ Posted reply: ${post2.uri}`);
  console.log(`  └─ Threaded to root\n`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Multi-post thread (simulating Twitter thread)
  console.log('Test 2: Multi-post thread (Twitter thread simulation)\n');
  
  const threadPosts = [
    '1/ Here\'s an interesting thread about AI development and safety.',
    '2/ The key is to build systems that are both powerful and aligned with human values.',
    '3/ This requires careful research, testing, and iteration over time.'
  ];
  
  let rootPost = null;
  let lastPost = null;
  
  for (let i = 0; i < threadPosts.length; i++) {
    const text = threadPosts[i];
    const isFirst = i === 0;
    
    const postRecord = {
      text: text,
      createdAt: new Date().toISOString(),
    };
    
    if (!isFirst) {
      postRecord.reply = {
        root: { uri: rootPost.uri, cid: rootPost.cid },
        parent: { uri: lastPost.uri, cid: lastPost.cid }
      };
    }
    
    const response = await agent.post(postRecord);
    
    if (isFirst) {
      rootPost = response;
      console.log(`✓ Posted thread root: ${response.uri}`);
    } else {
      console.log(`✓ Posted reply ${i}: ${response.uri}`);
      console.log(`  └─ Parent: ${lastPost.uri.split('/').pop()}`);
      console.log(`  └─ Root: ${rootPost.uri.split('/').pop()}`);
    }
    
    lastPost = response;
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ All tests complete!`);
  console.log(`\nView threads at: https://bsky.app/profile/${blueskyHandle}\n`);
  
  console.log('Summary:');
  console.log('- Test 1: Long text split into 2 posts and threaded ✓');
  console.log('- Test 2: 3-post thread with proper root/parent refs ✓');
  console.log('\nThe threading implementation is working correctly! 🎉\n');
  
} catch (error) {
  console.error('✗ Error:', error.message);
  console.error(error);
  process.exit(1);
}
