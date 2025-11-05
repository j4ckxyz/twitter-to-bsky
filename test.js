import emusks from 'emusks';
import { BskyAgent } from '@atproto/api';

console.log('=== Testing emusks package ===\n');

// Test 1: Check if emusks is properly installed
console.log('✓ emusks package imported successfully');
console.log('  emusks constructor available:', typeof emusks === 'function');

// Test 2: Check if @atproto/api is properly installed
console.log('\n✓ @atproto/api package imported successfully');
console.log('  BskyAgent constructor available:', typeof BskyAgent === 'function');

// Test 3: Create emusks client (will fail without auth token, which is expected)
console.log('\n--- Testing emusks client creation ---');
try {
  const client = new emusks({ authToken: '' });
  console.log('✓ emusks client created (but needs auth token to login)');
} catch (error) {
  console.error('✗ Error creating emusks client:', error.message);
}

// Test 4: Create Bluesky agent
console.log('\n--- Testing BskyAgent creation ---');
try {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  console.log('✓ BskyAgent created successfully');
} catch (error) {
  console.error('✗ Error creating BskyAgent:', error.message);
}

console.log('\n=== All tests completed ===');
console.log('\nTo use the crosspost tool:');
console.log('1. Add your Twitter auth_token to config.json');
console.log('2. Add your Twitter-to-Bluesky account mappings to config.json');
console.log('3. Run: npm start');
