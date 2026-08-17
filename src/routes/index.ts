import express from "express";
import weatherRoutes from "./weather.js";

const router = express.Router();

router.use("/weather", weatherRoutes);

export default router;
