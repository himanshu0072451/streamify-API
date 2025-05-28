const express = require("express");
const Redis = require("ioredis");
const { exec } = require("child_process");
const util = require("util");
const axios = require("axios");

const execPromise = util.promisify(exec);
const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// 🔥 Trending Songs via External Source + yt-dlp Search
router.get("/trending", async (req, res) => {
  try {
    // 1. Check cache first
    const cached = await redis.get("trending_audio_links");
    if (cached) return res.json(JSON.parse(cached));

    // 2. Fetch trending songs (you can replace this with a real music API)
    const { data } = await axios.get(
      "https://rss.applemarketingtools.com/api/v2/in/music/most-played/10/songs.json"
    );
    const songs = data.feed.results.map(
      (song) => `${song.name} ${song.artistName}`
    );

    const results = [];

    for (const query of songs) {
      try {
        const safeQuery = query.replace(/"/g, "");
        const { stdout } = await execPromise(
          `yt-dlp "ytsearch1:${safeQuery}" --print "%(id)s|%(title)s" --no-playlist`
        );
        const [videoId, title] = stdout.trim().split("|");
        results.push({
          query,
          title,
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      } catch (ytError) {
        console.warn(`❌ Failed for ${query}:`, ytError.message);
      }
    }

    // 3. Cache for 10 minutes
    await redis.set("trending_audio_links", JSON.stringify(results), "EX", 600);

    res.json(results);
  } catch (error) {
    console.error("❌ Trending Songs Fetch Error:", error.message || error);
    res.status(500).json({ error: "Failed to fetch trending songs" });
  }
});

module.exports = router;
