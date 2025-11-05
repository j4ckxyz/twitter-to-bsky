import { BskyAgent } from '@atproto/api';
import fs from 'fs/promises';

// Test script to upload media to Bluesky

const handle = process.argv[2];
const password = process.argv[3];
const imagePath = process.argv[4];

if (!handle || !password) {
  console.error('Usage: node test-bsky-media.js <handle> <app-password> [image-path]');
  console.error('\nExample:');
  console.error('  node test-bsky-media.js user.bsky.social xxxx-xxxx-xxxx-xxxx ./test-image.jpg');
  process.exit(1);
}

async function testImageUpload() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  
  try {
    console.log(`\nLogging in to Bluesky as ${handle}...`);
    await agent.login({
      identifier: handle,
      password: password,
    });
    console.log(`✓ Logged in successfully\n`);
    
    // Test 1: Check upload limits for videos
    console.log('Checking video upload limits...');
    try {
      const limits = await agent.com.atproto.repo.getUploadLimits?.();
      console.log('Upload limits:', JSON.stringify(limits, null, 2));
    } catch (error) {
      console.log('Could not get upload limits:', error.message);
    }
    
    // Test 2: Upload an image if provided
    if (imagePath) {
      console.log(`\nTesting image upload from: ${imagePath}`);
      
      const imageBuffer = await fs.readFile(imagePath);
      console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      
      // Upload the blob
      console.log('Uploading blob...');
      const uploadResponse = await agent.uploadBlob(imageBuffer, {
        encoding: 'image/jpeg',
      });
      
      console.log('✓ Blob uploaded successfully');
      console.log('Blob response:', JSON.stringify(uploadResponse, null, 2));
      
      // Create a post with the image
      console.log('\nCreating test post with image...');
      const postResponse = await agent.post({
        text: 'Test post with image from twitter-to-bsky tool',
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            {
              alt: 'Test image',
              image: uploadResponse.data.blob,
            },
          ],
        },
      });
      
      console.log('✓ Post created successfully!');
      console.log('Post URI:', postResponse.uri);
      console.log('\nFull response:', JSON.stringify(postResponse, null, 2));
      
    } else {
      console.log('\nNo image provided. Skipping image upload test.');
      console.log('To test image upload, provide an image path as the third argument.');
    }
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.status) {
      console.error('Status:', error.status);
    }
    console.error('\nFull error:', error);
  }
}

testImageUpload();
