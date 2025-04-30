import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Initialize Redis with the full connection URL from the environment variable
// export const redis = new Redis("redis://default:AV22AAIjcDEzNTdlZTYzZTllNzA0ZTJhOTdhZGM2NmYyZWFhMTliOHAxMA@suitable-panda-23990.upstash.io:6379");
export const redis = new Redis("rediss://default:AV22AAIjcDEzNTdlZTYzZTllNzA0ZTJhOTdhZGM2NmYyZWFhMTliOHAxMA@suitable-panda-23990.upstash.io:6379");

// Test the connection and set a key
try {
  await redis.set('foo', 'bar');
  console.log('Successfully set key in Redis');
} catch (err) {
  console.error('Redis error:', err);
}
