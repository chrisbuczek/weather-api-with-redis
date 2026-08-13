import express from "express";

const app = express();
const PORT = 3000;

app.get("/", (_req, res) => {
  res.send("Weather API is running");
});

// app.use("/api/v1", routes);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
