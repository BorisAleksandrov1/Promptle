let isLoggedIn = false;

const playBtn = document.getElementById("playBtn");
const howToBtn = document.getElementById("howToBtn");
const navLoginBtn = document.getElementById("navLoginBtn");

const overlay = document.getElementById("modalOverlay");
const loginModal = document.getElementById("loginModal");
const howToModal = document.getElementById("howToModal");
const loginForm = document.getElementById("loginForm");

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
    openModal(loginModal);
  } else {
    window.location.href = "game.html";
  }
});

navLoginBtn.addEventListener("click", () => {
  if (isLoggedIn) {
    isLoggedIn = false;
    navLoginBtn.textContent = "Log in";
  } else {
    openModal(loginModal);
  }
});

howToBtn.addEventListener("click", () => {
  openModal(howToModal);
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

  try {
    const res = await fetch("https://promptle-6gyj.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.ok) {
      isLoggedIn = true;
      localStorage.setItem("promptle_user_id", data.user_id);
      navLoginBtn.textContent = "Log out";
      closeAllModals();
      window.location.href = "game.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to connect to server");
  }
});
