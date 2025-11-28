# AGENTS.md

## Commands
- `npm start` / `node index.js` - Run crossposting
- `npm run setup` - Interactive configuration
- No test framework; use `dryRun: true` in config.json for safe testing

## Code Style
- **ES Modules**: Use `import`/`export` syntax (`"type": "module"` in package.json)
- **Formatting**: 2-space indentation, single quotes for strings
- **Naming**: camelCase for functions/variables, descriptive names (e.g., `cleanTweetText`, `fetchOpenGraphData`)
- **Error handling**: Try/catch with console.error, graceful degradation (skip failed media, continue processing)
- **Async**: Use async/await throughout, not callbacks or raw promises
- **Console output**: Use emoji prefixes for status (checkmark for success, warning for issues, x for failures)

## Architecture
- `index.js` - Main crossposting logic (entry point)
- `setup.js` - Interactive CLI configuration tool
- `config.json` - User config (gitignored); see `config.example.json`
- `crosspost-log.json` - Tracks posted tweets to prevent duplicates (gitignored)

## Key Dependencies
- `@atproto/api` - Bluesky AT Protocol client
- `emusks` - Twitter API wrapper
- `image-size`, `open-graph-scraper`, `chalk`, `prompts` - Utilities
