import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Login or Register
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password required" });
    }

    // Check if user exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userCheck.rows.length > 0) {
      // User exists, check password (simple text comparison for now)
      const user = userCheck.rows[0];
      if (user.password === password) {
        return res.json({ ok: true, user_id: user.id });
      } else {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }
    } else {
      // Create new user
      const newUser = await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
        [email, password]
      );
      return res.json({ ok: true, user_id: newUser.rows[0].id });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Save used word
app.post("/api/words", async (req, res) => {
  try {
    const { user_id, word } = req.body;

    if (!user_id || !word) {
      return res.status(400).json({ ok: false, error: "user_id and word required" });
    }

    await pool.query(
      "INSERT INTO used_words (user_id, word) VALUES ($1, $2)",
      [user_id, word]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
