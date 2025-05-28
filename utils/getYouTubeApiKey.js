const axios = require("axios");

let apiKeys = process.env.YOUTUBE_API_KEY.split(",").map((key) => key.trim());
let currentKeyIndex = 0;
let usedKeys = new Set();

async function checkQuota(apiKey) {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: { part: "id", id: "Ks-_Mh1QhMc", key: apiKey },
      }
    );
    return response.status === 200; // ✅ Valid API Key
  } catch (error) {
    if (error.response?.status === 403) {
      console.log(`⚠️ YouTube API Key Exhausted: ${apiKey}`);
      usedKeys.add(apiKey);
      return false;
    }
    if (error.response?.status === 400) {
      console.log(`❌ Invalid YouTube API Key: ${apiKey}`);
      usedKeys.add(apiKey);
      return false;
    }
    return true; // Assume valid if no known errors
  }
}

async function getYouTubeApiKey() {
  if (usedKeys.size >= apiKeys.length) {
    throw new Error("❌ All YouTube API keys are exhausted or invalid!");
  }

  let apiKey = apiKeys[currentKeyIndex];

  // 🔄 Find a valid API key
  while (usedKeys.has(apiKey)) {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    apiKey = apiKeys[currentKeyIndex];
  }

  const isValid = await checkQuota(apiKey);
  if (!isValid) {
    return getYouTubeApiKey(); // Try the next key recursively
  }

  // console.log(`✅ Using YouTube API Key: ${apiKey}`);
  // console.log("ApiKey: ", apiKey);
  return apiKey;
}

module.exports = getYouTubeApiKey;
