const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const getYouTubeMP3 = async (videoId) => {
  const preferredFormats = ["140", "251", "250", "249"];
  const youtubeURL = `https://www.youtube.com/watch?v=${videoId}`;

  const tryFormat = async (format) => {
    try {
      const { stdout } = await execPromise(
        `yt-dlp -f ${format} -g --no-playlist "${youtubeURL}"`
      );
      const url = stdout.trim();
      if (!url.startsWith("http")) throw new Error("Invalid URL");
      if (!url.includes("googlevideo.com")) throw new Error("Invalid CDN URL");
      // console.log(`✅ Success with format ${format}: ${url}`);
      return url;
    } catch (err) {
      // You can uncomment the next line for detailed error logs per format if needed:
      // console.warn(`Format ${format} failed: ${err.message}`);
      return null;
    }
  };

  // 1. Try preferred formats in order
  for (const format of preferredFormats) {
    const url = await tryFormat(format);
    if (url) return { url, format };
  }

  // 2. Try bestaudio fallback
  try {
    const { stdout } = await execPromise(
      `yt-dlp -f bestaudio -g --no-playlist "${youtubeURL}"`
    );
    const url = stdout.trim();
    if (!url.startsWith("http")) throw new Error("Invalid fallback URL");
    if (!url.includes("googlevideo.com"))
      throw new Error("Invalid fallback CDN URL");
    // console.log(`✅ Success with fallback bestaudio: ${url}`);
    return { url, format: "bestaudio" };
  } catch (fallbackError) {
    // Continue to final fallback
  }

  // 3. Final fallback: parse all audio-only formats from format list
  try {
    const { stdout } = await execPromise(`yt-dlp -F "${youtubeURL}"`);
    const lines = stdout.split("\n");
    const audioFormats = lines
      .filter((line) => /^\d+/.test(line) && /audio only/.test(line))
      .map((line) => line.trim().split(/\s+/)[0]);

    for (const format of audioFormats) {
      const url = await tryFormat(format);
      if (url) return { url, format };
    }
  } catch (finalErr) {
    console.error(`❌ MP3 Fetch Failed for videoId ${videoId}`);
    console.error(finalErr.message || finalErr);
    return finalErr.message || finalErr;
  }

  console.error(`❌ All fallback attempts failed for videoId ${videoId}`);
  return console.error(
    `❌ All fallback attempts failed for videoId ${videoId}`
  );
};

module.exports = { getYouTubeMP3 };
