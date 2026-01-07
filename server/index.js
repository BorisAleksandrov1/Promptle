import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  if (typeof password != "string") return false;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

app.post("/api/register", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password required" });
    }

    email = normalizeEmail(email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        ok: false,
        error: "Password must be 8-72 chars with at least one letter and one number",
      });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ ok: false, error: "Account already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [email, hashedPassword]
    );

    return res.json({ ok: true, user_id: newUser.rows[0].id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password required" });
    }

    email = normalizeEmail(email);

    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userCheck.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const user = userCheck.rows[0];
    const matches = await bcrypt.compare(password, user.password);

    if (!matches) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    return res.json({ ok: true, user_id: user.id });
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

    await pool.query("INSERT INTO used_words (user_id, word) VALUES ($1, $2)", [
      user_id,
      word,
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.get("/api/streak/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "user_id required" });
    }

    const result = await pool.query("SELECT streak FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, streak: result.rows[0].streak });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/streak", async (req, res) => {
  try {
    const { user_id, outcome } = req.body;

    if (!user_id || !outcome) {
      return res.status(400).json({ ok: false, error: "user_id and outcome required" });
    }

    if (outcome !== "win" && outcome !== "lose") {
      return res.status(400).json({ ok: false, error: "outcome must be win or lose" });
    }

    const result = await pool.query(
      "UPDATE users SET streak = CASE WHEN $2 = 'win' THEN streak + 1 ELSE 0 END WHERE id = $1 RETURNING streak",
      [user_id, outcome]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, streak: result.rows[0].streak });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
