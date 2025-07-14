//WORKING CODE!
const axios = require("axios");
const getSpotifyToken = require("../utils/GetSpotifyToken");
const getGenresFromSpotify = require("../utils/getGenresFromSpotify");
const {
  getCachedGenres,
  cacheGenres,
  cacheFallback,
  getCachedFallback,
  cachePlaylistId,
  getCachedPlaylistId,
} = require("../services/redisService");
const pLimit = require("p-limit").default;

require("dotenv").config();

// Get User's Recently Played Tracks
async function getRecentlyPlayedTracks(token) {
  // const accessToken = await getSpotifyToken();
  if (!token) return [];

  try {
    const response = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.items.map((item) => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      album: item.track.album.name,
      thumbnail: item.track.album.images[0]?.url || "",
      preview_url: item.track.preview_url || "",
      popularity: item.track.popularity,
    }));
  } catch (err) {
    console.error(
      "❌ Failed to fetch recently played tracks:",
      err.response?.data || err.message || err
    );
    return [];
  }
}

// Get User's Top Tracks by time range
async function getTopTracks(timeRange = "medium_term", token) {
  // const accessToken = await getSpotifyToken();
  if (!token) return [];

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.items.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      thumbnail: track.album.images[0]?.url || "",
      preview_url: track.preview_url || "",
      popularity: track.popularity,
    }));
  } catch (err) {
    console.error(
      "❌ Failed to fetch top tracks:",
      err.response?.data || err.message
    );
    return [];
  }
}

// Generate Personalized Recommendations
async function getPersonalizedRecommendations(genres = [], year = null, token) {
  try {
    const recentlyPlayed = await getRecentlyPlayedTracks(token);
    const topTracksShort = await getTopTracks("short_term", token);
    const topTracksMedium = await getTopTracks("medium_term", token);
    const topTracksLong = await getTopTracks("long_term", token);

    const allTracks = [
      ...recentlyPlayed,
      ...topTracksShort,
      ...topTracksMedium,
      ...topTracksLong,
    ];

    // If user has no history → use fallback
    if (allTracks.length === 0) {
      const fallbackTracks = await getFallbackTracks(); // new helper
      return fallbackTracks;
    }

    if (genres.length === 0) {
      return allTracks.sort((a, b) => b.popularity - a.popularity).slice(0, 50);
    }

    const matchedTracks = [];
    const limit = pLimit(5);

    const tasks = allTracks.map((track) =>
      limit(async () => {
        const artistName = track.artist.split(",")[0].trim().toLowerCase();

        let artistGenres = await getCachedGenres(artistName);
        if (!artistGenres) {
          artistGenres = await getGenresFromSpotify(artistName, token);
          if (artistGenres.length > 0) {
            await cacheGenres(artistName, artistGenres);
          }
        }

        const matches = genres.some((genre) =>
          artistGenres.some((g) =>
            g.toLowerCase().includes(genre.toLowerCase())
          )
        );

        if (matches) {
          matchedTracks.push(track);
        }
      })
    );

    await Promise.allSettled(tasks);

    const uniqueTracks = Array.from(
      new Map(matchedTracks.map((track) => [track.id, track])).values()
    );

    return uniqueTracks
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 50);
  } catch (err) {
    console.error("❌ Failed to generate personalized recommendations:", err);
    return [];
  }
}

const getFallbackTracks = async () => {
  const searchQuery = "Top 50 - India";
  const playlistIdKey = "spotify:top50_india:playlistId";
  const tracksKey = "spotify:top50_india:tracks";

  try {
    // 1. Try to get cached tracks
    let cachedTracks = await getCachedFallback(tracksKey);
    if (cachedTracks) return cachedTracks;

    // 2. Try to get cached playlist ID
    let cachedPlaylistId = await getCachedPlaylistId(playlistIdKey);

    // 3. If playlist ID not cached, search it
    if (!cachedPlaylistId) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Searching playlist on Spotify...");
      }

      const searchRes = await axios.get(
        `https://spotify23.p.rapidapi.com/search/?q=${encodeURIComponent(
          searchQuery
        )}&type=playlists&offset=0&limit=10&numberOfTopResults=5`,
        {
          headers: {
            "x-rapidapi-host": "spotify23.p.rapidapi.com",
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          },
        }
      );

      const playlists = searchRes.data.playlists.items;

      const exactMatch = playlists.find(
        (p) =>
          p.data.name.trim().toLowerCase() === searchQuery.toLowerCase() &&
          p.data.owner.name.toLowerCase() === "spotify"
      );

      if (!exactMatch) throw new Error("Playlist not found!");

      cachedPlaylistId = exactMatch.data.uri.split(":").pop();

      // Cache playlist ID for 1 week
      await cachePlaylistId(playlistIdKey, cachedPlaylistId, 604800);
    }

    // 4. Fetch playlist tracks
    const tracksRes = await axios.get(
      `https://spotify23.p.rapidapi.com/playlist_tracks/?id=${cachedPlaylistId}&offset=0&limit=100`,
      {
        headers: {
          "x-rapidapi-host": "spotify23.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const tracks = tracksRes.data.items.map((item) => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      url: item.track.external_urls.spotify,
      album: item.track.album.name,
      thumbnail:
        item.track.album.images[0]?.url || item.track.album.images[1]?.url,
      preview_url: item?.track?.preview_url || "",
      duration_ms: item.track.duration_ms,
    }));

    // 5. Cache tracks for 1 day or more if desired
    await cacheFallback(tracksKey, tracks, 86400); // 1 day2
    if (process.env.NODE_ENV === development) {
      console.log(`✅ Fetched and cached ${tracks.length} tracks.`);
    }

    return tracks;
  } catch (err) {
    console.error("❌ Error in getFallbackTracks:", err.message);
    return null;
  }
};

module.exports = {
  getSpotifyToken,
  getRecentlyPlayedTracks,
  getTopTracks,
  getPersonalizedRecommendations,
  getFallbackTracks,
};
