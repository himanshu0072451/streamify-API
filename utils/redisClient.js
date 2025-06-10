const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Try reconnecting after increasing delays
      const delay = Math.min(retries * 100, 3000);
      console.log(`🔄 Redis reconnect attempt #${retries} in ${delay}ms`);
      return delay;
    },
    tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined // enable TLS only if needed
  }
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redisClient.on("connect", () => {
  console.log("🔌 Redis socket connected.");
});

redisClient.on("ready", () => {
  console.log("✅ Redis client is ready.");
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("❌ Failed to connect to Redis:", err);
  }
})();

module.exports = redisClient;
