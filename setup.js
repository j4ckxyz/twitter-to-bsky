#!/usr/bin/env node
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const CONFIG_FILE = './config.json';

// Default configuration structure
const DEFAULT_CONFIG = {
  twitter: {
    authToken: ""
  },
  crosspostMappings: [],
  options: {
    dryRun: true,
    maxTweetsPerCheck: 20,
    includeReplies: false,
    includeRetweets: false,
    includeQuoteTweets: false
  }
};

// Load existing config or create new one
async function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  }
  return { ...DEFAULT_CONFIG };
}

// Save config to file
async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(chalk.green('✓ Configuration saved to config.json'));
}

// Display welcome banner
function showBanner() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║     Twitter to Bluesky - Configuration Manager            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));
}

// List all configured mappings
function listMappings(config) {
  console.log(chalk.yellow.bold('\n📋 Current Account Mappings:\n'));
  
  if (config.crosspostMappings.length === 0) {
    console.log(chalk.gray('  No accounts configured yet.\n'));
    return;
  }
  
  config.crosspostMappings.forEach((mapping, index) => {
    console.log(chalk.cyan(`  ${index + 1}. `) + chalk.white(`@${mapping.twitterUsername}`) + 
                chalk.gray(' → ') + chalk.blue(`@${mapping.blueskyHandle}`));
    console.log(chalk.gray(`     PDS: ${mapping.blueskyService || 'https://bsky.social'}`));
  });
  console.log();
}

// Show current global options
function showOptions(config) {
  console.log(chalk.yellow.bold('\n⚙️  Global Options:\n'));
  console.log(chalk.cyan('  Dry Run Mode: ') + (config.options.dryRun ? chalk.red('ON') : chalk.green('OFF')));
  console.log(chalk.cyan('  Max Tweets Per Check: ') + chalk.white(config.options.maxTweetsPerCheck));
  console.log(chalk.cyan('  Include Replies: ') + (config.options.includeReplies ? chalk.green('Yes') : chalk.gray('No')));
  console.log(chalk.cyan('  Include Retweets: ') + (config.options.includeRetweets ? chalk.green('Yes') : chalk.gray('No')));
  console.log(chalk.cyan('  Include Quote Tweets: ') + (config.options.includeQuoteTweets ? chalk.green('Yes') : chalk.gray('No')));
  console.log();
}

// Configure Twitter auth token
async function configureTwitterAuth(config) {
  console.log(chalk.yellow.bold('\n🐦 Twitter Authentication\n'));
  console.log(chalk.gray('You need your Twitter auth_token cookie value.'));
  console.log(chalk.gray('See README.md for instructions on how to get it.\n'));
  
  const response = await prompts({
    type: 'text',
    name: 'authToken',
    message: 'Enter your Twitter auth_token:',
    initial: config.twitter.authToken || '',
    validate: value => value.length > 0 ? true : 'Auth token is required'
  });
  
  if (response.authToken) {
    config.twitter.authToken = response.authToken;
    await saveConfig(config);
  }
}

// Add a new account mapping
async function addMapping(config) {
  console.log(chalk.yellow.bold('\n➕ Add New Account Mapping\n'));
  
  const response = await prompts([
    {
      type: 'text',
      name: 'twitterUsername',
      message: 'Twitter username to crosspost from:',
      validate: value => value.length > 0 ? true : 'Username is required'
    },
    {
      type: 'text',
      name: 'blueskyHandle',
      message: 'Bluesky handle to post to (e.g., user.bsky.social):',
      validate: value => value.length > 0 ? true : 'Handle is required'
    },
    {
      type: 'password',
      name: 'blueskyAppPassword',
      message: 'Bluesky app password:',
      validate: value => value.length > 0 ? true : 'App password is required'
    },
    {
      type: 'text',
      name: 'blueskyService',
      message: 'Bluesky PDS URL:',
      initial: 'https://bsky.social'
    }
  ]);
  
  // Check if user cancelled
  if (!response.twitterUsername || !response.blueskyHandle || !response.blueskyAppPassword) {
    console.log(chalk.red('\n✗ Cancelled\n'));
    return;
  }
  
  // Add the mapping
  config.crosspostMappings.push({
    twitterUsername: response.twitterUsername,
    blueskyHandle: response.blueskyHandle,
    blueskyAppPassword: response.blueskyAppPassword,
    blueskyService: response.blueskyService
  });
  
  await saveConfig(config);
  console.log(chalk.green(`\n✓ Added mapping: @${response.twitterUsername} → @${response.blueskyHandle}\n`));
}

// Remove an account mapping
async function removeMapping(config) {
  if (config.crosspostMappings.length === 0) {
    console.log(chalk.red('\n✗ No accounts configured to remove.\n'));
    return;
  }
  
  console.log(chalk.yellow.bold('\n🗑️  Remove Account Mapping\n'));
  listMappings(config);
  
  const response = await prompts({
    type: 'number',
    name: 'index',
    message: 'Enter the number of the mapping to remove (0 to cancel):',
    validate: value => {
      if (value === 0) return true;
      return value > 0 && value <= config.crosspostMappings.length ? true : 'Invalid number';
    }
  });
  
  if (response.index === undefined || response.index === 0) {
    console.log(chalk.red('\n✗ Cancelled\n'));
    return;
  }
  
  const removed = config.crosspostMappings.splice(response.index - 1, 1)[0];
  await saveConfig(config);
  console.log(chalk.green(`\n✓ Removed mapping: @${removed.twitterUsername} → @${removed.blueskyHandle}\n`));
}

// Edit an account mapping
async function editMapping(config) {
  if (config.crosspostMappings.length === 0) {
    console.log(chalk.red('\n✗ No accounts configured to edit.\n'));
    return;
  }
  
  console.log(chalk.yellow.bold('\n✏️  Edit Account Mapping\n'));
  listMappings(config);
  
  const selectResponse = await prompts({
    type: 'number',
    name: 'index',
    message: 'Enter the number of the mapping to edit (0 to cancel):',
    validate: value => {
      if (value === 0) return true;
      return value > 0 && value <= config.crosspostMappings.length ? true : 'Invalid number';
    }
  });
  
  if (selectResponse.index === undefined || selectResponse.index === 0) {
    console.log(chalk.red('\n✗ Cancelled\n'));
    return;
  }
  
  const mapping = config.crosspostMappings[selectResponse.index - 1];
  
  const response = await prompts([
    {
      type: 'text',
      name: 'twitterUsername',
      message: 'Twitter username:',
      initial: mapping.twitterUsername,
      validate: value => value.length > 0 ? true : 'Username is required'
    },
    {
      type: 'text',
      name: 'blueskyHandle',
      message: 'Bluesky handle:',
      initial: mapping.blueskyHandle,
      validate: value => value.length > 0 ? true : 'Handle is required'
    },
    {
      type: 'password',
      name: 'blueskyAppPassword',
      message: 'Bluesky app password (leave empty to keep current):',
    },
    {
      type: 'text',
      name: 'blueskyService',
      message: 'Bluesky PDS URL:',
      initial: mapping.blueskyService || 'https://bsky.social'
    }
  ]);
  
  if (!response.twitterUsername || !response.blueskyHandle) {
    console.log(chalk.red('\n✗ Cancelled\n'));
    return;
  }
  
  // Update the mapping
  mapping.twitterUsername = response.twitterUsername;
  mapping.blueskyHandle = response.blueskyHandle;
  if (response.blueskyAppPassword) {
    mapping.blueskyAppPassword = response.blueskyAppPassword;
  }
  mapping.blueskyService = response.blueskyService;
  
  await saveConfig(config);
  console.log(chalk.green(`\n✓ Updated mapping: @${response.twitterUsername} → @${response.blueskyHandle}\n`));
}

// Configure global options
async function configureOptions(config) {
  console.log(chalk.yellow.bold('\n⚙️  Configure Global Options\n'));
  
  const response = await prompts([
    {
      type: 'toggle',
      name: 'dryRun',
      message: 'Dry run mode (test without actually posting):',
      initial: config.options.dryRun,
      active: 'ON',
      inactive: 'OFF'
    },
    {
      type: 'number',
      name: 'maxTweetsPerCheck',
      message: 'Maximum tweets to fetch per check:',
      initial: config.options.maxTweetsPerCheck,
      validate: value => value > 0 && value <= 100 ? true : 'Must be between 1 and 100'
    },
    {
      type: 'toggle',
      name: 'includeReplies',
      message: 'Include replies:',
      initial: config.options.includeReplies,
      active: 'Yes',
      inactive: 'No'
    },
    {
      type: 'toggle',
      name: 'includeRetweets',
      message: 'Include retweets:',
      initial: config.options.includeRetweets,
      active: 'Yes',
      inactive: 'No'
    },
    {
      type: 'toggle',
      name: 'includeQuoteTweets',
      message: 'Include quote tweets:',
      initial: config.options.includeQuoteTweets,
      active: 'Yes',
      inactive: 'No'
    }
  ]);
  
  if (response.dryRun !== undefined) {
    config.options = {
      dryRun: response.dryRun,
      maxTweetsPerCheck: response.maxTweetsPerCheck,
      includeReplies: response.includeReplies,
      includeRetweets: response.includeRetweets,
      includeQuoteTweets: response.includeQuoteTweets
    };
    
    await saveConfig(config);
    console.log(chalk.green('\n✓ Options updated\n'));
  }
}

// Main menu
async function mainMenu() {
  showBanner();
  
  const config = await loadConfig();
  
  // Show Twitter auth status
  const hasTwitterAuth = config.twitter.authToken && config.twitter.authToken.length > 0;
  console.log(chalk.cyan('Twitter Auth: ') + (hasTwitterAuth ? chalk.green('✓ Configured') : chalk.red('✗ Not configured')));
  
  listMappings(config);
  showOptions(config);
  
  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: '➕ Add new account mapping', value: 'add' },
      { title: '✏️  Edit account mapping', value: 'edit' },
      { title: '🗑️  Remove account mapping', value: 'remove' },
      { title: '🐦 Configure Twitter authentication', value: 'twitter' },
      { title: '⚙️  Configure global options', value: 'options' },
      { title: '📋 View current configuration', value: 'view' },
      { title: '🚪 Exit', value: 'exit' }
    ]
  });
  
  if (!response.action || response.action === 'exit') {
    console.log(chalk.cyan('\n👋 Goodbye!\n'));
    process.exit(0);
  }
  
  switch (response.action) {
    case 'add':
      await addMapping(config);
      break;
    case 'edit':
      await editMapping(config);
      break;
    case 'remove':
      await removeMapping(config);
      break;
    case 'twitter':
      await configureTwitterAuth(config);
      break;
    case 'options':
      await configureOptions(config);
      break;
    case 'view':
      // Already shown above
      break;
  }
  
  // Return to menu
  await mainMenu();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.cyan('\n\n👋 Goodbye!\n'));
  process.exit(0);
});

// Start the application
mainMenu().catch(error => {
  console.error(chalk.red('\n✗ Error:'), error.message);
  process.exit(1);
});
