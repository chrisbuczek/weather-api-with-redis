import { type Request, type Response } from "express";
import express from "express";

const router = express.Router();

router.get("/:city", (req: Request, res: Response) => {
  const { city } = req.params;
  res.send("Welcome to " + city);
});

export default router;
