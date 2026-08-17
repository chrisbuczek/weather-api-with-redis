import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: process.env.PORT ?? "3000",
  weatherApiKey: required("WEATHER_API_KEY"),
  weatherApiBaseUrl: required("WEATHER_API_BASE_URL"),
  redisUrl: required("REDIS_URL"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? "300"),
};
