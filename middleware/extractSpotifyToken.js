const { getSpotifyToken } = require("../services/spotifyService");

async function extractSpotifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    req.spotifyAccessToken = authHeader.split(" ")[1];
  } else {
    // fallback: use server-side token
    try {
      const token = await getSpotifyToken();
      req.spotifyAccessToken = token;
    } catch (err) {
      return res.status(500).json({ error: "Failed to get Spotify token" });
    }
  }

  next();
}

module.exports = extractSpotifyToken;
