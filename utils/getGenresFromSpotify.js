// utils/getGenresFromSpotify.js
const axios = require("axios");

async function getGenresFromSpotify(artistName, token) {
  try {
    if (!token || !artistName) return [];

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        artistName
      )}&type=artist&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const artist = response.data.artists.items[0];
    return artist?.genres || [];
  } catch (err) {
    console.error("❌ Failed to fetch genres from Spotify:", err.message);
    return [];
  }
}

module.exports = getGenresFromSpotify;
