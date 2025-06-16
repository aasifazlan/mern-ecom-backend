import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();
 
export const redis = new Redis(process.env.REDIS_KEY);

// Test the connection and set a key
try {
  await redis.set('foo', 'bar'); 
  console.log('Successfully set key in Redis');
} catch (err) {
  console.error('Redis error:', err);
}
