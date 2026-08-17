import data from "../data/temp.json" with { type: "json" };

export async function getWeatherForCity(city: string) {
  // check Redis cache, call weather API on miss, cache result, return
  return data;
}
