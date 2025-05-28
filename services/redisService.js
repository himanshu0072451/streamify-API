const redisClient = require("../utils/redisClient");

async function getCachedSong(videoId) {
  const cachedSong = await redisClient.get(`song:${videoId}`);
  return cachedSong ? JSON.parse(cachedSong) : null;
}

async function cacheSong(videoId, songData, expiresIn = 21600) {
  await redisClient.set(
    `song:${videoId}`,
    JSON.stringify(songData),
    "EX",
    expiresIn
  );
}

async function cacheUpNext(videoId, nextSongData, expiresIn = 3600) {
  await redisClient.set(
    `upnext:${videoId}`,
    JSON.stringify(nextSongData),
    "EX",
    expiresIn
  );
}

async function getCacheUpNext(videoId) {
  const cachedUpNext = await redisClient.get(`upnext:${videoId}`);

  return cachedUpNext ? JSON.parse(cachedUpNext) : null;
}

async function getPlayedSongs(historyKey) {
  let history = await redisClient.lRange(historyKey, 0, -1);
  return history || []; // Ensure it's an array
}
async function setPlayedSongs(historyKey, title) {
  if (!redisClient || !redisClient.lPush) {
    console.log("❌ Redis client is not initialized properly.");
    return;
  }
  // console.log("Title: " + title);
  await redisClient.lPush(historyKey, title);
  await redisClient.lTrim(historyKey, 0, 4);
}
async function getCachedGenres(artistName) {
  const cached = await redisClient.get(`genres:${artistName.toLowerCase()}`);
  return cached ? JSON.parse(cached) : null;
}

async function cacheGenres(artistName, genres, expiresIn = 86400) {
  await redisClient.set(
    `genres:${artistName.toLowerCase()}`,
    JSON.stringify(genres),
    "EX",
    expiresIn
  );
}

module.exports = {
  getCachedSong,
  cacheSong,
  cacheUpNext,
  getCacheUpNext,
  getPlayedSongs,
  setPlayedSongs,
  getCachedGenres,
  cacheGenres,
};
