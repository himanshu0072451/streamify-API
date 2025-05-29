const Song = require("../models/Song");
const { getYouTubeMP3 } = require("../services/ytService");
const getGenresFromSpotify = require("../utils/getGenresFromSpotify");
const {
  getCachedSong,
  cacheSong,
  cacheUpNext,
  getPlayedSongs,
  setPlayedSongs,
  getCachedGenres,
  cacheGenres,
} = require("../services/redisService");
const {
  getPersonalizedRecommendations,
  getTopTracks,
} = require("../services/spotifyService");
const getApiKey = require("../utils/getYouTubeApiKey");
const axios = require("axios");

// 🔊 Main: /getmp3
async function getMP3(req, res) {
  const token = req.spotifyAccessToken;

  const {
    videoId,
    title,
    trackId,
    albumImage,
    thumbnail,
    genre,
    artists,
    album,
    durationMs,
  } = req.query;
  if (!videoId) return res.status(400).json({ error: "Video ID is required" });

  try {
    // 🔁 Step 1: Redis Cache
    const cached = await getCachedSong(videoId);
    if (cached) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Redis cache hit.");
      }
      res.json(cached);
      backgroundNextFetch(videoId, genre, artists, title, album, token);
      return;
    }

    // 📦 Step 2: MongoDB Check
    const existing = await Song.findOne({ videoId });
    if (existing?.mp3Url && existing.expiresAt > new Date()) {
      if (existing?.mp3Url == "https://placeholder.mp3") {
        if (process.env.NODE_ENV === "development") {
          console.log("✅ MongoDB cache hit.");
          console.log("✅ Updating mp3.");
        }
        const mp3 = await getYouTubeMP3(videoId);
        if (!mp3) return res.status(500).json({ error: "Failed to fetch MP3" });

        const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
        await existing.updateOne({ mp3Url: mp3.url, expiresAt });
        existing.mp3Url = mp3.url;
        existing.expiresAt = expiresAt;
        backgroundNextFetch(
          existing.videoId,
          existing.genre,
          existing.artist,
          existing.title,
          existing.album,
          token
        );
        return res.json(existing);
      }
      if (process.env.NODE_ENV === "development") {
        console.log("✅ MongoDB cache hit.");
      }
      await cacheSong(videoId, existing.toObject());
      res.json(existing.toObject());
      backgroundNextFetch(videoId, genre, artists, title, album, token);
      return;
    }

    // 🎶 Step 3: New Download
    if (process.env.NODE_ENV === "development") {
      console.log("📥 Fetching new MP3...");
    }
    const mp3 = await getYouTubeMP3(videoId);
    if (!mp3) return res.status(500).json({ error: "Failed to fetch MP3" });

    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6hr
    const primaryArtist = artists ? artists.split(",")[0].trim() : "Unknown";

    let spotifyGenres = await getCachedGenres(primaryArtist);
    if (!spotifyGenres) {
      spotifyGenres = await getGenresFromSpotify(primaryArtist, token);
      if (spotifyGenres.length > 0) {
        await cacheGenres(primaryArtist, spotifyGenres);
      }
    }

    const songData = {
      videoId,
      title: title || "Unknown Title",
      thumbnail: thumbnail || "",
      genre: genre || "Unknown",
      artist: artists ? artists.split(",") : ["Unknown"],
      spotifyGenres, // add the fetched Spotify genres here
      mp3Url: mp3.url,
      expiresAt,
      trackId: trackId,
      album: album || "",
      albumCover: albumImage || "",
      duration: Math.floor((durationMs || 0) / 1000), // in seconds
      nextSongId: null,
    };

    const updated = await Song.findOneAndUpdate({ videoId }, songData, {
      upsert: true,
      new: true,
    });

    await cacheSong(videoId, updated.toObject());
    res.json(updated.toObject());

    backgroundNextFetch(videoId, genre, artists, title, album, token);
  } catch (err) {
    console.error("❌ getMP3 error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
}

// 🧠 Background call helper
function backgroundNextFetch(videoId, genre, artists, title, album, token) {
  const artist = Array.isArray(artists)
    ? artists[0]
    : (artists || "").split(",")[0] || "Unknown";

  fetchNextSong(videoId, genre, artist, title, album, token).catch((err) =>
    console.warn("⚠️ fetchNextSong error:", err.message)
  );
}

// 🔄 Get Next Song
async function fetchNextSong(videoId, album, token) {
  const historyKey = "song_history_global";
  let history = (await getPlayedSongs(historyKey)) || [];

  let nextSong = null;

  try {
    // const token = await getSpotifyToken();
    if (!token) throw new Error("Missing Spotify token");

    const year = album?.release_date?.slice(0, 4) || null;

    const currentSong = await Song.findOne({ videoId });
    const spotifyGenres = currentSong?.spotifyGenres || [];

    const recs = await getPersonalizedRecommendations(
      spotifyGenres,
      year,
      token
    );
    const candidates = recs.filter((s) => !history.includes(s.title));

    if (candidates.length > 0) {
      nextSong = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("🔁 No fresh recs, using related artist tracks...");
      }
      const artistTracks = await getTopTracks(token);
      const fallback = artistTracks.filter((s) => !history.includes(s.title));
      if (fallback.length > 0) {
        nextSong = fallback[Math.floor(Math.random() * fallback.length)];
      }
    }
  } catch (err) {
    console.warn("❌ Spotify/rec fetch failed:", err.message);
  }

  if (!nextSong) {
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Default fallback song (rickroll)");
    }
    nextSong = {
      title: "No Recommendation Found",
      artist: "Unknown",
      videoId: "dQw4w9WgXcQ",
    };
  }

  try {
    const ytRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          q: `${nextSong.title} ${nextSong.artist} official audio`,
          part: "snippet",
          type: "video",
          maxResults: 1,
          key: await getApiKey(),
        },
      }
    );

    if (!ytRes.data.items.length) return null;
    const nextVideoId = ytRes.data.items[0].id.videoId;
    const mp3 = await getYouTubeMP3(nextVideoId);
    if (!mp3) return null;

    const finalNext = {
      title: nextSong.title,
      videoId: nextVideoId,
      artist: nextSong.artist,
      thumbnail: nextSong.thumbnail || "",
      genre: nextSong.genre || "",
      album: nextSong.album?.name || "",
      mp3Url: mp3,
    };

    history.push(nextSong.title);
    await cacheUpNext(nextVideoId, finalNext);
    await setPlayedSongs(historyKey, nextSong.title);
    await Song.findOneAndUpdate({ videoId }, { nextSongId: nextVideoId });

    if (process.env.NODE_ENV === "development") {
      console.log(`✅ Next song cached: ${nextSong.title}`);
    }
    return finalNext;
  } catch (err) {
    console.error("❌ YouTube fetch failed:", err.message);
    return null;
  }
}

module.exports = { getMP3, fetchNextSong };
