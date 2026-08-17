//weather controller logic here

import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { getWeatherForCity } from "../services/weather.js";

export const getWeatherCity = asyncHandler(
  async (req: Request, res: Response) => {
    const { city } = req.params;
    const data = await getWeatherForCity(city[0]);
    res.json(data);
  },
);
