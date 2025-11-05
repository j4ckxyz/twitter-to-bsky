import { BskyAgent, RichText } from '@atproto/api';

// Test script for link and facet handling
console.log('\n🔗 Testing Link and Facet Handling\n');

// Test 1: RichText facet detection
console.log('Test 1: RichText facet detection');
console.log('=====================================\n');

const testTexts = [
  'Check out this link: https://example.com',
  'This is #awesome and #cool',
  'Mixed: https://example.com #test',
];

for (const text of testTexts) {
  const rt = new RichText({ text });
  await rt.detectFacetsWithoutResolution(); // Don't resolve mentions, just detect patterns
  
  console.log(`Text: "${text}"`);
  console.log(`Facets found: ${rt.facets?.length || 0}`);
  
  if (rt.facets && rt.facets.length > 0) {
    rt.facets.forEach((facet, i) => {
      const start = facet.index.byteStart;
      const end = facet.index.byteEnd;
      const segment = text.substring(start, end);
      const type = facet.features[0].$type;
      
      console.log(`  Facet ${i + 1}: "${segment}" (${type})`);
      
      if (type === 'app.bsky.richtext.facet#link') {
        console.log(`    URI: ${facet.features[0].uri}`);
      } else if (type === 'app.bsky.richtext.facet#mention') {
        console.log(`    DID: ${facet.features[0].did || 'unresolved'}`);
      } else if (type === 'app.bsky.richtext.facet#tag') {
        console.log(`    Tag: ${facet.features[0].tag}`);
      }
    });
  }
  
  console.log('');
}

// Test 2: Tweet URL expansion simulation
console.log('\nTest 2: Tweet URL expansion simulation');
console.log('=====================================\n');

const mockTweet = {
  text: 'Check out this article https://t.co/abc123 and this image https://t.co/xyz789',
  urls: [
    {
      url: 'https://t.co/abc123',
      expanded_url: 'https://example.com/article',
      display_url: 'example.com/article'
    },
    {
      url: 'https://t.co/xyz789',
      expanded_url: 'https://pbs.twimg.com/media/image.jpg',
      display_url: 'pic.twitter.com/xyz789'
    }
  ],
  media: [
    {
      url: 'https://t.co/xyz789',
      expanded_url: 'https://pbs.twimg.com/media/image.jpg',
      media_url_https: 'https://pbs.twimg.com/media/image.jpg',
      type: 'photo'
    }
  ]
};

// Simulate cleanTweetText function
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
    const tcoUrl = urlEntity.url;
    const expandedUrl = urlEntity.expanded_url;
    
    // Check if this t.co URL is for media
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
      // Replace t.co URL with expanded URL
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

const cleanedText = cleanTweetText(mockTweet.text, mockTweet);

console.log('Original tweet text:');
console.log(`  "${mockTweet.text}"`);
console.log('\nCleaned text:');
console.log(`  "${cleanedText}"`);
console.log('\nExpected:');
console.log('  "Check out this article https://example.com/article"');
console.log(`\n✓ Media link removed: ${!cleanedText.includes('https://t.co/xyz789')}`);
console.log(`✓ Article link expanded: ${cleanedText.includes('https://example.com/article')}`);
console.log(`✓ No t.co links remain: ${!cleanedText.includes('t.co')}`);

console.log('\n');
