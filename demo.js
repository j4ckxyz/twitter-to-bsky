import emusks from 'emusks';

// This script demonstrates how to use emusks to fetch tweets
// You need to provide a valid Twitter auth_token to run this

console.log('=== emusks Tweet Fetching Demo ===\n');

const authToken = process.argv[2];

if (!authToken) {
  console.log('Usage: node demo.js <your_twitter_auth_token> <twitter_username>');
  console.log('\nExample: node demo.js "abc123..." "elonmusk"');
  console.log('\nHow to get your auth token:');
  console.log('1. Log in to https://x.com');
  console.log('2. Open DevTools (F12)');
  console.log('3. Go to Application tab → Cookies → x.com');
  console.log('4. Copy the value of the auth_token cookie');
  process.exit(0);
}

const username = process.argv[3] || 'elonmusk';

try {
  // Create and login to Twitter
  const client = new emusks({ authToken });
  await client.login();
  console.log(`✓ Logged in to Twitter as @${client.user.username}\n`);
  
  // Get user info
  console.log(`Fetching tweets from @${username}...`);
  const user = await client.getUser(username);
  
  if (!user) {
    console.error(`Could not find user @${username}`);
    process.exit(1);
  }
  
  console.log(`✓ Found user: @${user.username} (ID: ${user.id})\n`);
  
  // Get user's tweets
  const result = await client.getUserTweets(user.id, {
    count: 10,
    includePromotedContent: false,
  });
  
  console.log(`Found ${result.tweets.length} tweets:\n`);
  
  // Display tweets with their properties
  for (let i = 0; i < result.tweets.length; i++) {
    const tweet = result.tweets[i];
    console.log(`--- Tweet ${i + 1} ---`);
    console.log(`ID: ${tweet.id}`);
    console.log(`Text: ${tweet.text?.substring(0, 100)}${tweet.text?.length > 100 ? '...' : ''}`);
    console.log(`Is Reply: ${!!tweet.inReplyToStatusId}`);
    console.log(`Is Retweet: ${!!tweet.retweetedStatus}`);
    console.log(`Is Quote: ${!!tweet.quotedStatus}`);
    
    // Show what fields exist
    const fields = Object.keys(tweet);
    console.log(`Available fields: ${fields.join(', ')}`);
    console.log('');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  if (error.message.includes('auth token')) {
    console.error('\nPlease provide a valid Twitter auth_token');
  }
}
