let isLoggedIn = false;
let authMode = "login";

const API_BASE = "https://promptle-6gyj.onrender.com";

// "http://localhost:5501" - local
// "https://promptle-6gyj.onrender.com"; - render deployment

const playBtn = document.getElementById("playBtn");
const howToBtn = document.getElementById("howToBtn");
const navLoginBtn = document.getElementById("navLoginBtn");

const overlay = document.getElementById("modalOverlay");
const loginModal = document.getElementById("loginModal");
const howToModal = document.getElementById("howToModal");
const loginForm = document.getElementById("loginForm");
const authTitle = document.getElementById("authTitle");
const authPrompt = document.getElementById("authPrompt");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const passwordRules = document.getElementById("passwordRules");

function setAuthMode(mode) {
  authMode = mode;
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authMode === mode);
  });

  if (mode === "login") {
    authTitle.textContent = "Log in to play Promptle";
    authPrompt.textContent = "Use your account to start a game.";
    authSubmitBtn.textContent = "Log in";
    passwordRules.classList.add("hidden");
  } else {
    authTitle.textContent = "Create an account";
    authPrompt.textContent = "Sign up to save your progress.";
    authSubmitBtn.textContent = "Create account";
    passwordRules.classList.remove("hidden");
  }
}

function openModal(modal) {
  overlay.classList.add("show");
  loginModal.classList.remove("show");
  howToModal.classList.remove("show");
  modal.classList.add("show");
}

function closeAllModals() {
  overlay.classList.remove("show");
  loginModal.classList.remove("show");
  howToModal.classList.remove("show");
}

playBtn.addEventListener("click", () => {
  if (!isLoggedIn) {
    setAuthMode("login");
    openModal(loginModal);
  } else {
    window.location.href = "game.html";
  }
});

navLoginBtn.addEventListener("click", () => {
  if (isLoggedIn) {
    isLoggedIn = false;
    localStorage.removeItem("promptle_user_id");
    navLoginBtn.textContent = "Log in";
  } else {
    setAuthMode("login");
    openModal(loginModal);
  }
});

howToBtn.addEventListener("click", () => {
  openModal(howToModal);
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setAuthMode(tab.dataset.authMode);
  });
});

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", closeAllModals);
});

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeAllModals();
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const endpoint = authMode === "register" ? "/api/register" : "/api/login";

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.ok) {
      isLoggedIn = true;
      localStorage.setItem("promptle_user_id", data.user_id);
      navLoginBtn.textContent = "Log out";
      closeAllModals();
      window.location.href = "game.html";
    } else {
      alert(data.error || "Authentication failed");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to connect to server");
  }
});
