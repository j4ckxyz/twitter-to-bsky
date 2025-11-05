import { BskyAgent, RichText } from '@atproto/api';

// Comprehensive test for link handling with real Twitter data scenarios
console.log('\n🔗 Comprehensive Link & Facet Test\n');

// Simulate cleanTweetText function
function cleanTweetText(text, tweet) {
  if (!text) {
    return text;
  }
  
  let cleanedText = text;
  
  const mediaUrls = new Set();
  if (tweet.media && tweet.media.length > 0) {
    tweet.media.forEach(m => {
      if (m.url) mediaUrls.add(m.url);
      if (m.expanded_url) mediaUrls.add(m.expanded_url);
    });
  }
  
  const urlEntities = tweet.urls || [];
  
  for (const urlEntity of urlEntities) {
    const tcoUrl = urlEntity.url;
    const expandedUrl = urlEntity.expanded_url;
    
    const isMediaUrl = mediaUrls.has(tcoUrl) || 
                       mediaUrls.has(expandedUrl) ||
                       (expandedUrl && (
                         expandedUrl.includes('pic.twitter.com') ||
                         expandedUrl.includes('pbs.twimg.com')
                       ));
    
    if (isMediaUrl) {
      cleanedText = cleanedText.replace(tcoUrl, '').trim();
    } else if (expandedUrl) {
      cleanedText = cleanedText.replace(tcoUrl, expandedUrl);
    }
  }
  
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\s+(and this (image|video|gif))?\s*$/i, '')
    .trim();
  
  return cleanedText;
}

// Test cases simulating real Twitter scenarios
const testCases = [
  {
    name: 'Tweet with article link + image',
    tweet: {
      text: 'Just published: AI safety research https://t.co/abc123 https://t.co/img456',
      urls: [
        { url: 'https://t.co/abc123', expanded_url: 'https://openai.com/blog/ai-safety' },
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg' }
      ],
      media: [
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg', type: 'photo' }
      ]
    },
    expected: 'Just published: AI safety research https://openai.com/blog/ai-safety'
  },
  {
    name: 'Tweet with two article links',
    tweet: {
      text: 'Read this https://t.co/abc123 and this https://t.co/def456',
      urls: [
        { url: 'https://t.co/abc123', expanded_url: 'https://example.com/article1' },
        { url: 'https://t.co/def456', expanded_url: 'https://example.com/article2' }
      ],
      media: []
    },
    expected: 'Read this https://example.com/article1 and this https://example.com/article2'
  },
  {
    name: 'Media-only tweet',
    tweet: {
      text: 'https://t.co/img456',
      urls: [
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg' }
      ],
      media: [
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg', type: 'photo' }
      ]
    },
    expected: ''
  },
  {
    name: 'Tweet with link containing hashtags',
    tweet: {
      text: 'Check out #AI development at https://t.co/abc123 #MachineLearning',
      urls: [
        { url: 'https://t.co/abc123', expanded_url: 'https://openai.com' }
      ],
      media: []
    },
    expected: 'Check out #AI development at https://openai.com #MachineLearning'
  },
  {
    name: 'Tweet with trailing "and this image"',
    tweet: {
      text: 'Amazing discovery and this image https://t.co/img456',
      urls: [
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg' }
      ],
      media: [
        { url: 'https://t.co/img456', expanded_url: 'https://pbs.twimg.com/media/xyz.jpg', type: 'photo' }
      ]
    },
    expected: 'Amazing discovery'
  }
];

console.log('Test Cases:');
console.log('='.repeat(70) + '\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = cleanTweetText(testCase.tweet.text, testCase.tweet);
  const success = result === testCase.expected;
  
  console.log(`${success ? '✓' : '✗'} ${testCase.name}`);
  console.log(`  Original: "${testCase.tweet.text}"`);
  console.log(`  Expected: "${testCase.expected}"`);
  console.log(`  Got:      "${result}"`);
  
  if (success) {
    passed++;
  } else {
    failed++;
    console.log(`  ❌ FAILED!`);
  }
  
  console.log('');
}

console.log('='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed\n`);

// Test facet detection on cleaned text
console.log('\nFacet Detection Test:');
console.log('='.repeat(70) + '\n');

const facetTestText = 'Check out #AI development at https://openai.com #MachineLearning';
const rt = new RichText({ text: facetTestText });
await rt.detectFacetsWithoutResolution();

console.log(`Text: "${facetTestText}"`);
console.log(`Facets detected: ${rt.facets?.length || 0}\n`);

if (rt.facets) {
  rt.facets.forEach((facet, i) => {
    const start = facet.index.byteStart;
    const end = facet.index.byteEnd;
    const segment = facetTestText.substring(start, end);
    const feature = facet.features[0];
    
    console.log(`  ${i + 1}. "${segment}"`);
    console.log(`     Type: ${feature.$type}`);
    
    if (feature.$type === 'app.bsky.richtext.facet#link') {
      console.log(`     URI: ${feature.uri}`);
    } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
      console.log(`     Tag: ${feature.tag}`);
    }
    console.log('');
  });
}

console.log('='.repeat(70));
console.log('✓ All tests complete!\n');
