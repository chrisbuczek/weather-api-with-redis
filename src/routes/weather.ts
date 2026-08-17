import { type Request, type Response } from "express";
import express from "express";
import { getWeatherCity } from "../controllers/index.js";

const router = express.Router();

router.get("/:city", getWeatherCity);

export default router;
