````markdown
# emusks

**Version:** 0.0.3 • Public • Published a month ago  
**License:** Apache-2.0  
**Downloads (weekly):** 3  
**Collaborators:** tiagozip  
**Unpacked size:** 66.2 kB  
**Total files:** 15  

> **emusks** — reverse-engineered Twitter API wrapper that just works.  
> Currently in beta.

---

## Installation

```bash
# npm
npm install emusks

# bun
bun add emusks

# yarn
yarn add emusks

# pnpm
pnpm add emusks
````

---

## Example Usage

```js
import emusks from "emusks";

const client = new emusks({
  authToken: "your_auth_token_here",
});

await client.login();
console.log(`logged in as ${client.user.username}`);

const timeline = await client.getTimeline({
  count: 20,
  type: "foryou", // or "following"
});

console.log(`timeline has ${timeline.tweets.length} tweets`);
```

---

## Features

* **Timeline:** Get “For You” and “Following” timelines with full parsing
* **Tweets:** Create, delete, and fetch tweets with polls and media
* **Interactions:** Like, retweet, follow, bookmark functionality
* **Search:** Search for tweets and users
* **User data:** Get detailed profiles and statistics
* **Conversations:** Handle threaded conversations and replies
* **Pagination:** Cursor-based pagination for all timeline endpoints

---

## API Reference

### Timeline

Get tweets from your timeline:

```js
const timeline = await client.getTimeline({
  count: 20,
  type: "foryou", // "foryou" or "following"
  cursor: undefined,
  includeAds: false,
  seenTweetIds: [],
});
```

**Response:**

```js
{
  tweets: [...],
  conversations: [...],
  users: [...],
  cursors: {
    top: "...",
    bottom: "..."
  },
  metadata: {
    scribeConfig: {...}
  }
}
```

---

### Tweets

```js
// Create a tweet
const result = await client.tweet({
  text: "Hello world!",
  reply: "1234567890", // optional
  poll: {
    choices: ["Option 1", "Option 2"],
    duration_minutes: 1440,
  },
});

// Delete a tweet
await client.deleteTweet("1234567890");

// Get tweets
const tweet = await client.getTweet("1234567890");
const fullTweet = await client.getFullTweet("1234567890");
```

---

### Interactions

```js
// Like/unlike
await client.likeTweet("1234567890");
await client.unlikeTweet("1234567890");

// Retweet/unretweet
await client.retweet("1234567890");
await client.unretweet("1234567890");

// Follow/unfollow
await client.followUser("username");
await client.unfollowUser("username");

// Bookmark/unbookmark
await client.bookmarkTweet("1234567890");
await client.unbookmarkTweet("1234567890");
```

---

### Notifications

```js
const notifications = await client.getNotifications({
  type: "All", // "All", "Verified", "Mentions"
  limit: 20,
  cursor: undefined,
});
```

**Response:**

```js
{
  entries: [...],
  cursors: {
    top: "...",
    bottom: "..."
  }
}
```

Paginate:

```js
const nextPage = await client.getNotifications({
  type: "All",
  limit: 20,
  cursor: notifications.cursors.bottom
});
```

---

### User Tweets

```js
const userTweets = await client.getUserTweets("1234567890", {
  count: 20,
  includePromotedContent: false,
  cursor: undefined
});

// or
const user = await client.getUser("username");
const tweets = await user.getTweets({
  count: 20,
  cursor: undefined
});
```

**Response:**

```js
{
  tweets: [...],
  cursors: {
    top: "...",
    bottom: "..."
  }
}
```

---

### Tweet Replies

```js
const fullTweet = await client.getFullTweet("1234567890", {
  rankingMode: "Relevance", // or "Recency"
  includeAds: false,
  cursor: undefined
});
```

**Response:**

```js
{
  mainTweet: {...},
  replies: [...],
  cursors: {
    top: "...",
    bottom: "..."
  }
}
```

Or just replies:

```js
const replies = await client.getTweetReplies("1234567890", {
  rankingMode: "Relevance",
  cursor: undefined
});
```

---

### Search

```js
const searchResults = await client.search("bun javascript", {
  resultsCount: 20,
  product: "Latest",
  cursor: undefined
});
```

**Response:**

```js
{
  entries: [...],
  cursors: {
    top: "...",
    bottom: "..."
  }
}
```

Paginate:

```js
const nextResults = await client.search("bun javascript", {
  resultsCount: 20,
  cursor: searchResults.cursors.bottom
});
```

---

## Requirements

* Twitter account `auth_token` cookie (not required for some endpoints)

---

## Getting the Auth Cookie

1. Log in to [https://x.com](https://x.com)
2. Open DevTools (`F12`)
3. Go to the **Application** tab
4. Find **Cookies** → **x.com**
5. Copy the value of the `auth_token` cookie

---

## Limitations

* Twitter API may change at any time
* Login **without** an auth token is not supported (due to CAPTCHAs and login flows)
* Not all endpoints are implemented

---

## FAQ

### Why?

Current APIs are outdated, hard to use, and badly documented.

### Why the name "emusks"?

Because Elon Musk is responsible for the poor state of Twitter's API and platform.

### How?

Endpoints are reverse-engineered from TweetDeck Web (X Pro), which uses less protected APIs.
Unlike the real X Pro, these endpoints are **not restricted** to premium users.
Other read-only endpoints are reverse-engineered from embeds and similar sources.

### Why not use the official API?

It’s heavily rate-limited, hard to use, and poorly documented.

---

## Keywords

`twitter`

---

**Try on RunKit**
**Report malware**

---

### Support

* Help
* Advisories
* Status
* Contact npm

### Company

* About
* Blog
* Press

### Terms & Policies

* Policies
* Terms of Use
* Code of Conduct
* Privacy

```
```
