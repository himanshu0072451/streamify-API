const mongoose = require("mongoose");

const SongSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true, // Prevent duplicate entries
      index: true, // Speeds up queries by videoId
    },
    trackId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: [String],
      required: true,
      default: ["Unknown"], // Ensure fallback
    },
    genre: {
      type: String,
      default: "Unknown",
    },
    spotifyGenres: { type: [String], default: [] },
    album: {
      type: String,
      default: "",
    },
    albumCover: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      required: true, // in seconds
    },
    thumbnail: {
      type: String,
      default: "",
    },
    mp3Url: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    nextSongId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Optional: TTL Index for automatic expiry (if using expiresAt)
SongSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Song = mongoose.model("Song", SongSchema);
module.exports = Song;
