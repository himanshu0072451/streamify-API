const express = require("express");
const router = express.Router();

const { getMP3, fetchNextSong } = require("../controllers/musicController");
const { getCacheUpNext } = require("../services/redisService");
const extractSpotifyToken = require("../middleware/extractSpotifyToken");

// 🔉 GET: /api/getmp3?q=songTitleOrVideoId
router.get("/getmp3", extractSpotifyToken, getMP3);

// 🔁 GET: /api/next
router.get("/next", extractSpotifyToken, async (req, res) => {
  const token = req.spotifyAccessToken;
  const { userId, videoId, genre, artist, title, album } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing required field: videoId" });
  }

  try {
    const nextSong = await fetchNextSong(
      videoId,
      userId,
      genre || "pop",
      artist || "Unknown",
      title,
      album,
      token
    );

    if (!nextSong) {
      return res.status(404).json({ error: "Next song not found" });
    }

    res.json(nextSong);
  } catch (error) {
    console.error("❌ /next route error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🎵 GET: /api/upnext?videoId=abc123
router.get("/upnext", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing required field: videoId" });
  }

  try {
    const nextSongData = await getCacheUpNext(videoId);

    if (!nextSongData) {
      return res.json({
        status: "pending",
        message: "Up Next song not ready yet.",
      });
    }

    res.json({ status: "ready", nextSong: nextSongData });
  } catch (err) {
    console.error("❌ /upnext route error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
