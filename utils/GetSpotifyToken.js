const { default: axios } = require("axios");
const NodeCache = require("node-cache");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour by default

// ✅ Function to Get Spotify Access Token
async function getSpotifyToken() {
  const cachedToken = cache.get("spotify_token");
  const cachedExpiresAt = cache.get("spotify_token_expires_at");

  if (cachedToken && Date.now() < cachedExpiresAt) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: SPOTIFY_REFRESH_TOKEN,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const spotifyToken = response.data.access_token;
    const spotifyTokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    // Cache token with TTL matching expiration time (expires_in is in seconds)
    cache.set("spotify_token", spotifyToken, response.data.expires_in);
    cache.set(
      "spotify_token_expires_at",
      spotifyTokenExpiresAt,
      response.data.expires_in
    );

    return spotifyToken;
  } catch (error) {
    console.error(
      "❌ Failed to Refresh Spotify Token:",
      error.response?.data || error.message
    );
    return null;
  }
}

module.exports = getSpotifyToken;
