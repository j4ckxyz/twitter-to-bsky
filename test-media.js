import emusks from 'emusks';
import fs from 'fs/promises';

// Test script to explore tweet media structure and download media

const authToken = process.argv[2];
const username = process.argv[3] || 'elonmusk';

if (!authToken) {
  console.error('Usage: node test-media.js <auth_token> [username]');
  process.exit(1);
}

const client = new emusks({ authToken });

async function downloadFile(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
  return buffer.byteLength;
}

async function main() {
  try {
    await client.login();
    console.log(`✓ Logged in as @${client.user.username}\n`);
    
    // Get user
    const user = await client.getUser(username);
    console.log(`✓ Found user: @${user.username} (ID: ${user.id})\n`);
    
    // Get recent tweets
    const result = await client.getUserTweets(user.id, {
      count: 50,
      includePromotedContent: false,
    });
    
    console.log(`✓ Fetched ${result.tweets.length} tweets\n`);
    console.log('=' .repeat(70));
    
    // Find tweets with media
    let tweetsWithImages = [];
    let tweetsWithVideos = [];
    
    for (const tweet of result.tweets) {
      // Skip retweets and quotes for this test
      if (tweet.text?.startsWith('RT @') || tweet.quoting) continue;
      
      const hasMedia = tweet.media && tweet.media.length > 0;
      
      if (hasMedia) {
        const mediaTypes = tweet.media.map(m => m.type).join(', ');
        console.log(`\nTweet ID: ${tweet.id}`);
        console.log(`Text: ${tweet.text?.substring(0, 60)}...`);
        console.log(`Media count: ${tweet.media.length}`);
        console.log(`Media types: ${mediaTypes}`);
        
        // Check for images
        const images = tweet.media.filter(m => m.type === 'photo');
        if (images.length > 0) {
          tweetsWithImages.push({ tweet, images });
          console.log(`  Images: ${images.length}`);
          images.forEach((img, i) => {
            console.log(`    [${i}] ${img.media_url_https || img.url}`);
          });
        }
        
        // Check for videos
        const videos = tweet.media.filter(m => m.type === 'video' || m.type === 'animated_gif');
        if (videos.length > 0) {
          tweetsWithVideos.push({ tweet, videos });
          console.log(`  Videos: ${videos.length}`);
          videos.forEach((vid, i) => {
            console.log(`    [${i}] Type: ${vid.type}`);
            console.log(`    Duration: ${vid.video_info?.duration_millis}ms`);
            if (vid.video_info?.variants) {
              const mp4Variants = vid.video_info.variants.filter(v => v.content_type === 'video/mp4');
              console.log(`    MP4 variants: ${mp4Variants.length}`);
              mp4Variants.forEach(v => {
                console.log(`      - ${v.bitrate} bps: ${v.url}`);
              });
            }
          });
        }
        
        console.log('---');
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`\nSummary:`);
    console.log(`  Tweets with images: ${tweetsWithImages.length}`);
    console.log(`  Tweets with videos: ${tweetsWithVideos.length}`);
    
    // Test downloading first image
    if (tweetsWithImages.length > 0) {
      console.log(`\n\nTesting image download...`);
      const firstImage = tweetsWithImages[0].images[0];
      const imageUrl = firstImage.media_url_https || firstImage.url;
      console.log(`Downloading: ${imageUrl}`);
      
      try {
        const size = await downloadFile(imageUrl, './test-image.jpg');
        console.log(`✓ Downloaded image: ${(size / 1024).toFixed(2)} KB`);
      } catch (error) {
        console.error(`✗ Error downloading image:`, error.message);
      }
    }
    
    // Test downloading first video
    if (tweetsWithVideos.length > 0) {
      console.log(`\n\nTesting video download...`);
      const firstVideo = tweetsWithVideos[0].videos[0];
      
      if (firstVideo.video_info?.variants) {
        // Get highest quality MP4
        const mp4Variants = firstVideo.video_info.variants
          .filter(v => v.content_type === 'video/mp4')
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        
        if (mp4Variants.length > 0) {
          const videoUrl = mp4Variants[0].url;
          console.log(`Downloading (${mp4Variants[0].bitrate} bps): ${videoUrl}`);
          
          try {
            const size = await downloadFile(videoUrl, './test-video.mp4');
            console.log(`✓ Downloaded video: ${(size / (1024 * 1024)).toFixed(2)} MB`);
            
            // Check size constraint (100MB for Bluesky)
            if (size > 100 * 1024 * 1024) {
              console.log(`⚠️  Warning: Video exceeds 100MB limit for Bluesky`);
            }
          } catch (error) {
            console.error(`✗ Error downloading video:`, error.message);
          }
        }
      }
    }
    
    // Print full media structure for first tweet with media
    if (tweetsWithImages.length > 0) {
      console.log(`\n\n${'='.repeat(70)}`);
      console.log(`Full media structure (first image tweet):`);
      console.log(JSON.stringify(tweetsWithImages[0].tweet.media, null, 2));
    }
    
    if (tweetsWithVideos.length > 0) {
      console.log(`\n\n${'='.repeat(70)}`);
      console.log(`Full media structure (first video tweet):`);
      console.log(JSON.stringify(tweetsWithVideos[0].tweet.media, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
