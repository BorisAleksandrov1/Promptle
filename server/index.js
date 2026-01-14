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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

async function requestHintFromOpenAI(word, type) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY not configured");
  }

  const system = "You are a word game assistant. Never reveal the secret word. Respond with JSON only.";
  const user =
    type === "letters"
      ? `Secret word: ${word}. Return JSON with keys helper_word and reveal_letters. helper_word must be a real word of the same length and not equal to the secret. reveal_letters must be a string of the same length using _ for hidden positions and uppercase letters for 2-3 revealed positions.`
      : `Secret word: ${word}. Return JSON with key meaning_hint as a single sentence hint that describes the meaning without using the word, obvious rhymes, or spelling clues.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      max_tokens: 120,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty hint response");
  }

  return content;
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

app.post("/api/hint", async (req, res) => {
  try {
    const { word, type } = req.body;

    if (!word || !type) {
      return res.status(400).json({ ok: false, error: "word and type required" });
    }

    if (type !== "letters" && type !== "meaning") {
      return res.status(400).json({ ok: false, error: "type must be letters or meaning" });
    }

    const raw = await requestHintFromOpenAI(String(word).toUpperCase(), type);
    const parsed = JSON.parse(raw);

    if (type === "letters") {
      const helperWord = String(parsed.helper_word || "").toUpperCase();
      const revealLetters = String(parsed.reveal_letters || "").toUpperCase();
      if (!helperWord || !revealLetters) {
        return res.status(500).json({ ok: false, error: "Invalid hint response" });
      }
      return res.json({ ok: true, helper_word: helperWord, reveal_letters: revealLetters });
    }

    const meaningHint = String(parsed.meaning_hint || "").trim();
    if (!meaningHint) {
      return res.status(500).json({ ok: false, error: "Invalid hint response" });
    }
    return res.json({ ok: true, meaning_hint: meaningHint });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Hint generation failed" });
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

    return res.json({ ok: true, best_streak: result.rows[0].streak });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/streak", async (req, res) => {
  try {
    const { user_id, best_streak } = req.body;

    if (!user_id || typeof best_streak !== "number") {
      return res.status(400).json({ ok: false, error: "user_id and best_streak required" });
    }

    const result = await pool.query(
      "UPDATE users SET streak = GREATEST(streak, $2) WHERE id = $1 RETURNING streak",
      [user_id, best_streak]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, best_streak: result.rows[0].streak });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
