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

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  isLoggedIn = true;
  navLoginBtn.textContent = "Log out";
  closeAllModals();

  // To auto-redirect after login, uncomment:
  // window.location.href = "index.html";
});
