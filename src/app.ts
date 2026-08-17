import express, { type Express, type Request, type Response } from "express";
import routes from "./routes/index.js";
import { config } from "./config/env.js";

const app: Express = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Weather API is running");
  console.log(config.weatherApiKey);
});

app.use("/api/v1", routes);

// On Vercel the app is invoked per request, so it must not open a port itself.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
