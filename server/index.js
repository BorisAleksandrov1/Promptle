import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors()); // ok for dev; later you can restrict origins
app.use(express.json()); // lets you read JSON bodies

// test route
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "server is running" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
