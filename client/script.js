// DOM references
const gridEl = document.getElementById("grid");
const kbEl = document.getElementById("keyboard");
const statusEl = document.getElementById("status");
const newBtn = document.getElementById("newGameBtn");
const streakEl = document.getElementById("streak");
const winScreen = document.getElementById("winScreen");
const winMessage = document.getElementById("winMessage");
const continueBtn = document.getElementById("continueBtn");
const hintOutput = document.getElementById("hintOutput");
const hintCount = document.getElementById("hintCount");
const hintLettersBtn = document.getElementById("hintLettersBtn");
const hintMeaningBtn = document.getElementById("hintMeaningBtn");

const API_BASE = "https://promptle-6gyj.onrender.com";
const CURRENT_STREAK_KEY = "promptle_current_streak";
const HINT_LIMIT = 3;

// Global state
const state = {
  wordList: [],   // <- will be filled from words.txt
  secret: "",
  maxRows: 6,
  wordLen: 5,
  row: 0,
  col: 0,
  guesses: [],
  results: [],
  keyStates: {},
  locked: false,
  messageTimer: null,
  currentStreak: 0,
  bestStreak: 0
};

const hintState = {
  remaining: HINT_LIMIT
};

// Load words from words.txt
async function loadWordList() {
  try {
    const res = await fetch("./assets/valid-wordle-words.txt");   // file must be next to index.html
    const text = await res.text();

    state.wordList = text
      .split(/\r?\n/)        // split by lines
      .map(w => w.trim())    // remove spaces
      .filter(w => w.length > 0)
      .map(w => w.toUpperCase());

    console.log("Loaded words:", state.wordList.length);
  } catch (err) {
    console.error("Failed to load word list:", err);
    // Fallback if loading fails
    state.wordList = ["APPLE", "BRICK", "CHAIR", "DREAM", "EAGLE"];
  }
}

function initGame() {
  if (!state.wordList.length) {
    setStatus("No words loaded.");
    state.locked = true;
    return;
  }

  // Pick random secret
  state.secret = pickRandom(state.wordList);
  console.log("Word is:", state.secret)
  state.wordLen = state.secret.length;

  state.row = 0;
  state.col = 0;
  state.locked = false;
  state.keyStates = {};
  hideWinScreen();

  state.guesses = Array.from({ length: state.maxRows }, () =>
    Array(state.wordLen).fill("")
  );
  state.results = Array.from({ length: state.maxRows }, () =>
    Array(state.wordLen).fill("")
  );

  setStatus(`Guess the ${state.wordLen}-letter word.`);
  resetHints();

  buildEmptyGrid();
  updateGrid();
  renderKeyboard();
}

function pickRandom(arr) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx].toUpperCase();
}

function setStatus(msg, persist = false) {
  statusEl.textContent = msg || "";
  if (state.messageTimer) {
    clearTimeout(state.messageTimer);
    state.messageTimer = null;
  }
  if (msg && !persist && !state.locked) {
    state.messageTimer = setTimeout(() => {
      if (!state.locked) statusEl.textContent = "";
    }, 1600);
  }
}

function updateStreakDisplay() {
  if (!streakEl) return;
  streakEl.textContent = `Streak: ${state.currentStreak} | Best: ${state.bestStreak}`;
}

function getCurrentStreakKey(userId) {
  return userId ? `${CURRENT_STREAK_KEY}_${userId}` : CURRENT_STREAK_KEY;
}

function loadCurrentStreak(userId) {
  const key = getCurrentStreakKey(userId);
  const raw = localStorage.getItem(key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function saveCurrentStreak(userId, value) {
  const key = getCurrentStreakKey(userId);
  localStorage.setItem(key, String(value));
}

async function loadStreak() {
  const userId = localStorage.getItem("promptle_user_id");
  state.currentStreak = loadCurrentStreak(userId);
  state.bestStreak = 0;

  if (!userId) {
    updateStreakDisplay();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/streak/${userId}`);
    const data = await res.json();
    if (data.ok) {
      state.bestStreak = Number(data.best_streak) || 0;
      if (state.currentStreak > state.bestStreak) {
        state.bestStreak = state.currentStreak;
        await syncBestStreak(state.bestStreak);
      }
    }
  } catch (err) {
    console.error("Failed to load streak:", err);
  } finally {
    updateStreakDisplay();
  }
}

async function syncBestStreak(bestStreak) {
  const userId = localStorage.getItem("promptle_user_id");
  if (!userId) return;

  try {
    const res = await fetch(`${API_BASE}/api/streak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, best_streak: bestStreak }),
    });
    const data = await res.json();
    if (data.ok) {
      state.bestStreak = Number(data.best_streak) || state.bestStreak;
      updateStreakDisplay();
    }
  } catch (err) {
    console.error("Failed to update best streak:", err);
  }
}

function handleWinStreak() {
  const userId = localStorage.getItem("promptle_user_id");
  state.currentStreak += 1;
  saveCurrentStreak(userId, state.currentStreak);

  if (state.currentStreak > state.bestStreak) {
    state.bestStreak = state.currentStreak;
    updateStreakDisplay();
    syncBestStreak(state.bestStreak);
    return;
  }

  updateStreakDisplay();
}

function handleLossStreak() {
  const userId = localStorage.getItem("promptle_user_id");
  state.currentStreak = 0;
  saveCurrentStreak(userId, state.currentStreak);
  updateStreakDisplay();
}

function showWinScreen() {
  if (!winScreen) return;
  winMessage.textContent = "Correct!";
  winScreen.classList.add("show");
  winScreen.setAttribute("aria-hidden", "false");
}

function hideWinScreen() {
  if (!winScreen) return;
  winScreen.classList.remove("show");
  winScreen.setAttribute("aria-hidden", "true");
}

function setHintOutputText(text) {
  if (!hintOutput) return;
  hintOutput.textContent = text;
}

function updateHintUI() {
  if (!hintCount) return;
  const remaining = Math.max(0, hintState.remaining);
  hintCount.textContent = `${remaining} hint${remaining === 1 ? "" : "s"} left`;
  const disabled = remaining <= 0 || state.locked;
  if (hintLettersBtn) hintLettersBtn.disabled = disabled;
  if (hintMeaningBtn) hintMeaningBtn.disabled = disabled;
}

function resetHints() {
  hintState.remaining = HINT_LIMIT;
  setHintOutputText("// Ask for a hint to get started.");
  updateHintUI();
}

function buildRevealPattern(word, revealCount) {
  const picks = new Set();
  while (picks.size < Math.min(revealCount, word.length)) {
    picks.add(Math.floor(Math.random() * word.length));
  }
  return word
    .split("")
    .map((ch, idx) => (picks.has(idx) ? ch : "_"))
    .join(" ");
}

function getHelperWord() {
  const sameLength = state.wordList.filter((w) => w.length === state.wordLen && w !== state.secret);
  const targetLetters = new Set(state.secret.split(""));
  const candidates = sameLength.filter((w) => {
    let shared = 0;
    for (const ch of new Set(w.split(""))) {
      if (targetLetters.has(ch)) shared += 1;
    }
    return shared >= 2;
  });
  const pool = candidates.length ? candidates : sameLength;
  if (!pool.length) return state.secret;
  return pickRandom(pool);
}

function buildLocalLetterHint() {
  const helperWord = getHelperWord();
  const revealCount = state.wordLen >= 6 ? 3 : 2;
  const pattern = buildRevealPattern(state.secret, revealCount);
  return `// word + letters hint\nconst helperWord = "${helperWord}";\nconst letters = "${pattern}";`;
}

function buildLocalMeaningHint() {
  const topics = ["nature", "travel", "technology", "home", "music", "food", "sports", "art"];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `// meaning hint\n// Think of a ${state.wordLen}-letter word related to ${topic}.`;
}

async function fetchHintFromServer(type) {
  const res = await fetch(`${API_BASE}/api/hint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: state.secret, type })
  });

  if (!res.ok) throw new Error("Hint request failed");
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Hint request failed");

  if (type === "letters") {
    const helperWord = (data.helper_word || "").toUpperCase();
    const revealLetters = (data.reveal_letters || "").toUpperCase();
    if (!helperWord || !revealLetters) throw new Error("Hint data missing");
    return `// word + letters hint\nconst helperWord = "${helperWord}";\nconst letters = "${revealLetters}";`;
  }

  const meaningHint = data.meaning_hint || "";
  if (!meaningHint) throw new Error("Hint data missing");
  return `// meaning hint\n// ${meaningHint}`;
}

async function requestHint(type) {
  if (hintState.remaining <= 0 || state.locked) return;
  setHintOutputText("// Generating hint...");
  if (hintLettersBtn) hintLettersBtn.disabled = true;
  if (hintMeaningBtn) hintMeaningBtn.disabled = true;

  let hintText = "";

  try {
    hintText = await fetchHintFromServer(type);
  } catch (err) {
    hintText = type === "letters" ? buildLocalLetterHint() : buildLocalMeaningHint();
  }

  hintState.remaining = Math.max(0, hintState.remaining - 1);
  setHintOutputText(hintText);
  updateHintUI();
}

// Build the grid structure once (rows + tiles)
function buildEmptyGrid() {
  gridEl.innerHTML = "";
  for (let r = 0; r < state.maxRows; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.style.gridTemplateColumns = `repeat(${state.wordLen}, 1fr)`;

    for (let c = 0; c < state.wordLen; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      rowEl.appendChild(tile);
    }

    gridEl.appendChild(rowEl);
  }
}

// Only update text + classes; don't recreate DOM
function updateGrid(revealRow = null) {
  const rows = gridEl.querySelectorAll(".row");

  for (let r = 0; r < state.maxRows; r++) {
    const tiles = rows[r].querySelectorAll(".tile");

    for (let c = 0; c < state.wordLen; c++) {
      const tile = tiles[c];
      const letter = state.guesses[r][c] || "";

      // Reset base state
      tile.className = "tile";
      tile.style.animationDelay = "0ms";
      tile.textContent = letter;

      if (letter) tile.classList.add("filled");

      const res = state.results[r][c];
      if (res) {
        tile.classList.add(res);
        // Only the row just submitted gets the flip animation
        if (revealRow === r) {
          tile.classList.add("reveal");
          tile.style.animationDelay = `${c * 90}ms`;
        }
      }
    }
  }
}

function renderKeyboard() {
  kbEl.innerHTML = "";

  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
  ];

  rows.forEach((keys) => {
    const rowEl = document.createElement("div");
    rowEl.className = "krow";

    keys.forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.textContent = k === "BACK" ? "⌫" : k;
      btn.dataset.key = k;

      if (k === "ENTER" || k === "BACK") btn.classList.add("wide");

      if (k.length === 1) {
        const ks = state.keyStates[k];
        if (ks) btn.classList.add(ks);
      }

      btn.addEventListener("click", () => handleKey(k));
      rowEl.appendChild(btn);
    });

    kbEl.appendChild(rowEl);
  });
}

function handleKey(key) {
  if (state.locked) return;

  if (key === "ENTER") {
    submitGuess();
    return;
  }
  if (key === "BACK") {
    backspace();
    return;
  }

  if (/^[A-Z]$/.test(key)) {
    addLetter(key);
  }
}

function addLetter(letter) {
  if (state.col >= state.wordLen) return;
  state.guesses[state.row][state.col] = letter;
  state.col++;
  updateGrid(); // just repaint, no animations
}

function backspace() {
  if (state.col <= 0) return;
  state.col--;
  state.guesses[state.row][state.col] = "";
  updateGrid();
}

function submitGuess() {
  const guessArr = state.guesses[state.row];
  const guess = guessArr.join("");

  if (guess.length !== state.wordLen || guessArr.includes("")) {
    setStatus("Not enough letters.");
    return;
  }

  // Only allow words from the list (all caps)
  if (!state.wordList.includes(guess)) {
    setStatus("Not in word list.");
    return;
  }

  const score = scoreGuess(guess, state.secret);
  state.results[state.row] = score;

  updateKeyStates(guess, score);

  // Save used word to DB
  const userId = localStorage.getItem("promptle_user_id");
  if (userId) {
    fetch(`${API_BASE}/api/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, word: guess })
    }).catch(err => console.error("Failed to save word:", err));
  }

  // Reveal animation for this row only
  updateGrid(state.row);
  renderKeyboard();

  if (guess === state.secret) {
    state.locked = true;
    setStatus("Correct!", true);
    showWinScreen();
    handleWinStreak();
    updateHintUI();
    return;
  }

  if (state.row === state.maxRows - 1) {
    state.locked = true;
    setStatus(`Game over. Word was ${state.secret}.`, true);
    handleLossStreak();
    updateHintUI();
    return;
  }

  state.row++;
  state.col = 0;
}

function updateKeyStates(guess, score) {
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const s = score[i]; // correct/present/absent

    const prev = state.keyStates[ch];
    if (prev === "correct") continue;
    if (prev === "present" && s === "absent") continue;

    state.keyStates[ch] = s;
  }
}

// Wordle-like scoring with duplicates handled properly
function scoreGuess(guess, secret) {
  const result = Array(secret.length).fill("absent");

  const counts = {};
  for (let i = 0; i < secret.length; i++) {
    const ch = secret[i];
    counts[ch] = (counts[ch] || 0) + 1;
  }

  // First pass: exact matches
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "correct";
      counts[guess[i]]--;
    }
  }

  // Second pass: present matches
  for (let i = 0; i < secret.length; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if ((counts[ch] || 0) > 0) {
      result[i] = "present";
      counts[ch]--;
    } else {
      result[i] = "absent";
    }
  }

  return result;
}

function resetGame() {
  initGame();
}

// Physical keyboard support
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") return handleKey("ENTER");
  if (e.key === "Backspace") return handleKey("BACK");

  const k = e.key.toUpperCase();
  if (/^[A-Z]$/.test(k)) handleKey(k);
});

newBtn.addEventListener("click", resetGame);
continueBtn.addEventListener("click", resetGame);
if (hintLettersBtn) hintLettersBtn.addEventListener("click", () => requestHint("letters"));
if (hintMeaningBtn) hintMeaningBtn.addEventListener("click", () => requestHint("meaning"));

// Start first game after loading words
window.addEventListener("load", async () => {
  await loadWordList();
  await loadStreak();
  initGame();
});
