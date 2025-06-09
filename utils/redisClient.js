const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

(async () => {
  await redisClient.connect();
  console.log("✅ Redis connected.");
})();

module.exports = redisClient;
