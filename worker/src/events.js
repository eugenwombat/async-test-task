import IORedis from "ioredis";
import { config, redisConnection } from "./config.js";

export const publisher = new IORedis(redisConnection);

export async function publishJobEvent(payload) {
  await publisher.publish(config.eventsChannel, JSON.stringify(payload));
}

export async function closeEvents() {
  await publisher.quit();
}
