// Understanding Tweet Types and Filtering
// This file explains how the tool filters tweets

console.log('=== Tweet Filtering Guide ===\n');

console.log('The tool can filter three types of tweets:\n');

console.log('1. REPLIES:');
console.log('   - Tweets that respond to another tweet');
console.log('   - Detected by: tweet.inReplyToStatusId field');
console.log('   - Config: "includeReplies": false (default)\n');

console.log('2. RETWEETS:');
console.log('   - Tweets that share another user\'s tweet without adding text');
console.log('   - Detected by: tweet.retweetedStatus field');
console.log('   - Config: "includeRetweets": false (default)\n');

console.log('3. QUOTE TWEETS:');
console.log('   - Tweets that share another tweet with added commentary');
console.log('   - Detected by: tweet.quotedStatus field');
console.log('   - Config: "includeQuoteTweets": false (default)\n');

console.log('DEFAULT BEHAVIOR:');
console.log('By default, the tool only crossposts original tweets.');
console.log('This means replies, retweets, and quote tweets are filtered out.\n');

console.log('TO INCLUDE FILTERED TWEETS:');
console.log('Edit config.json and set the corresponding option to true:');
console.log('');
console.log('{');
console.log('  "options": {');
console.log('    "includeReplies": true,      // Include replies');
console.log('    "includeRetweets": true,     // Include retweets');
console.log('    "includeQuoteTweets": true   // Include quote tweets');
console.log('  }');
console.log('}');
console.log('');

console.log('RECOMMENDATION:');
console.log('For most users, keeping the defaults (all false) is recommended.');
console.log('This ensures only the original content is crossposted to Bluesky.');
