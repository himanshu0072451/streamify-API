const express = require("express");
const axios = require("axios");
const Redis = require("ioredis");
const Song = require("../models/Song");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const getApiKey = require("../utils/getYouTubeApiKey");

const extractSpotifyToken = require("../middleware/extractSpotifyToken");

const execPromise = util.promisify(exec);
const router = express.Router();
const redisClient = new Redis(process.env.REDIS_URL);
const {
  getPlayableTracks,
  cachePlaybaleTracks,
} = require("../services/redisService");

// Constants
const REDIS_EXPIRY = 60 * 60 * 6; // 6 hours
const BLACKLIST_KEYWORDS = [
  "trailer",
  "movie",
  "scene",
  "interview",
  "episode",
  "podcast",
  "review",
  "reaction",
  "stand-up",
  "live stream",
];
const WHITELIST_KEYWORDS = [
  "lyrics",
  "official",
  "audio",
  "music",
  "song",
  "video",
];

// GET /api/search?q=song

router.get("/search", extractSpotifyToken, async (req, res) => {
  const token = req.spotifyAccessToken;
  const query = req.query.q?.trim();

  if (!query)
    return res.status(400).json({ error: "Search query is required" });

  const cacheKey = `search:${query}`;

  try {
    // Redis Check
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    // Spotify Search
    const spotifyRes = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const tracks = spotifyRes.data.tracks.items;

    // Enrich Tracks
    const enrichedTracks = await Promise.all(
      tracks.map(async (track) => {
        const artistId = track.artists[0]?.id;
        const artists = track.artists.map((a) => a.name).join(", ");
        let genre = "Unknown";

        try {
          const artistRes = await axios.get(
            `https://api.spotify.com/v1/artists/${artistId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          genre = artistRes.data.genres?.[0] || "Unknown";
        } catch {}

        // YouTube
        let videoId = null;
        try {
          const ytRes = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
              params: {
                q: `${track.name} ${artists}`,
                part: "snippet",
                type: "video",
                maxResults: 1,
                key: await getApiKey(),
              },
            }
          );

          const ytVideo = ytRes.data.items[0];
          const title = ytVideo?.snippet?.title?.toLowerCase() || "";

          const isBlacklisted = BLACKLIST_KEYWORDS.some((word) =>
            title.includes(word)
          );
          const isWhitelisted = WHITELIST_KEYWORDS.some((word) =>
            title.includes(word)
          );

          if (!isBlacklisted && isWhitelisted) {
            videoId = ytVideo.id.videoId;
          }
        } catch {}

        return {
          spotifyId: track.id,
          title: track.name,
          artists: track.artists.map((a) => a.name),
          album: track.album.name,
          albumImage: track.album.images?.[0]?.url,
          durationMs: track.duration_ms,
          popularity: track.popularity,
          previewUrl: track.preview_url,
          genre,
          videoId,
        };
      })
    );

    // Step 4: Filter and de-duplicate enriched songs
    const validSongs = enrichedTracks.filter((song) => song.videoId);

    // Step X: Deduplicate by videoId
    const uniqueMap = new Map();

    validSongs.forEach((song) => {
      if (song.videoId && !uniqueMap.has(song.videoId)) {
        uniqueMap.set(song.videoId, song);
      }
    });

    const finalResults = Array.from(uniqueMap.values());

    // Cache and DB insert
    (async () => {
      try {
        const now = new Date();
        const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000); // mp3 link expiry

        const preparedSongs = finalResults.map((song) => ({
          videoId: song.videoId,
          trackId: song.spotifyId,
          title: song.title,
          artist: song.artists || ["Unknown"],
          genre: song.genre || "Unknown",
          spotifyGenres: [], // fill if you have more genres
          album: song.album || "",
          albumCover: song.albumImage || "",
          duration: Math.floor((song.durationMs || 0) / 1000), // in seconds
          thumbnail: song.albumImage || "", // or actual YT thumb
          mp3Url: "https://placeholder.mp3", // Replace with real MP3 URL
          expiresAt: oneDayLater,
          nextSongId: null,
        }));

        await Song.insertMany(preparedSongs, { ordered: false });

        await redisClient.set(
          cacheKey,
          JSON.stringify(finalResults),
          "EX",
          REDIS_EXPIRY
        );
        if (process.env.NODE_ENV === "development") {
          console.log("Songs inserted!");
        }
      } catch (err) {
        console.error("❌ Cache or DB insert failed:", err.message || err);
      }
    })();

    return res.json(finalResults);
  } catch (err) {
    console.error("❌ Search error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/GetId", async (req, res) => {
  let { title, artist } = req.query;

  if (!title || !artist) {
    return res
      .status(400)
      .json({ success: false, message: "Missing title or artist." });
  }

  // Support both string and array inputs
  const titles = Array.isArray(title) ? title : [title];
  const artists = Array.isArray(artist) ? artist : [artist];

  if (titles.length !== artists.length) {
    return res
      .status(400)
      .json({ success: false, message: "Title and artist count mismatch." });
  }

  try {
    const results = [];

    for (let i = 0; i < titles.length; i++) {
      const currentTitle = titles[i];
      const currentArtist = artists[i];
      const query = `${currentTitle} ${currentArtist}`;

      // Redis Cache
      const redisCache = await redisClient.get(`search:${query}`);
      if (redisCache) {
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Redis cache hit:", query);
        }

        results.push(JSON.parse(redisCache));
        continue;
      }

      // MongoDB Cache
      const existing = await Song.findOne({ query });
      if (existing) {
        if (process.env.NODE_ENV === "development") {
          console.log("✅ MongoDB cache hit:", query);
        }
        await redisClient.set(
          `search:${query}`,
          JSON.stringify(existing),
          "EX",
          3600
        );
        results.push(existing.toObject());
        continue;
      }

      // YouTube Search
      const ytRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            q: query,
            part: "snippet",
            maxResults: 1,
            key: await getApiKey(),
            type: "video",
          },
        }
      );

      const video = ytRes.data.items?.[0];

      if (!video) {
        results.push({ success: false, query, message: "No video found." });
        continue;
      }

      const data = {
        success: true,
        query,
        videoId: video.id.videoId,
        artist: artist,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.high?.url,
      };

      // Cache in Redis
      await redisClient.set(
        `search:${query}`,
        JSON.stringify(data),
        "EX",
        3600
      );

      results.push(data);
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error(
      "YouTube Search Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ success: false, message: "YouTube search failed." });
  }
});

router.post("/GetTrack", async (req, res) => {
  const songs = req.body;

  if (!Array.isArray(songs) || songs.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body must be an array of { title, artist } objects.",
    });
  }

  try {
    const results = await Promise.allSettled(
      songs.map(async ({ title, artist }) => {
        const query = `${title} ${artist}`;

        // 🔹 Redis cache check
        const cached = await getPlayableTracks(query);
        if (cached) {
          if (process.env.NODE_ENV === "development") {
            console.log("✅ Redis hit:", query);
          }
          return cached;
        }

        // 🔹 YouTube API Search
        const ytRes = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              q: query,
              part: "snippet",
              maxResults: 1,
              key: await getApiKey(),
              type: "video",
            },
          }
        );

        const video = ytRes.data.items?.[0];
        if (!video) {
          return {
            success: false,
            query,
            message: "No video found on YouTube.",
          };
        }

        const videoId = video.id.videoId;
        let audioUrl = null;

        // 🔹 yt-dlp to get audio stream URL
        try {
          const { stdout } = await execPromise(
            `yt-dlp -f bestaudio --get-url "https://www.youtube.com/watch?v=${videoId}"`
          );
          audioUrl = stdout.trim();
        } catch (err) {
          console.warn(`❌ yt-dlp failed for ${query}:`, err.message);
        }

        const data = {
          success: true,
          query,
          videoId,
          artist,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails?.high?.url,
          audioUrl: audioUrl || null,
        };

        // 🔹 Cache result
        await cachePlaybaleTracks(query, data, 3600); // 1 hour

        return data;
      })
    );

    const finalResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            success: false,
            message: "Processing failed.",
            error: result.reason?.message || "Unknown error",
          }
    );

    res.json({ success: true, results: finalResults });
  } catch (error) {
    console.error("🔥 Fatal Error:", error.message || error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
