// Mock example of what a video media object looks like from Twitter
// Based on emusks API structure

export const MOCK_VIDEO_MEDIA = {
  "display_url": "pic.x.com/xyz123",
  "expanded_url": "https://x.com/username/status/123/video/1",
  "id_str": "1234567890",
  "type": "video",
  "url": "https://t.co/xyz123",
  "media_url_https": "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/xyz.jpg",
  "video_info": {
    "duration_millis": 30000,  // 30 seconds
    "variants": [
      {
        "bitrate": 2176000,
        "content_type": "video/mp4",
        "url": "https://video.twimg.com/ext_tw_video/123/pu/vid/1280x720/video.mp4"
      },
      {
        "bitrate": 832000,
        "content_type": "video/mp4",
        "url": "https://video.twimg.com/ext_tw_video/123/pu/vid/640x360/video.mp4"
      },
      {
        "bitrate": 288000,
        "content_type": "video/mp4",
        "url": "https://video.twimg.com/ext_tw_video/123/pu/vid/480x270/video.mp4"
      },
      {
        "content_type": "application/x-mpegURL",
        "url": "https://video.twimg.com/ext_tw_video/123/pu/pl/playlist.m3u8"
      }
    ]
  }
};

export const MOCK_ANIMATED_GIF_MEDIA = {
  "type": "animated_gif",
  "video_info": {
    "duration_millis": 5000,
    "variants": [
      {
        "bitrate": 0,
        "content_type": "video/mp4",
        "url": "https://video.twimg.com/tweet_video/xyz.mp4"
      }
    ]
  }
};
