// Keep the entry module dependency-free so failed imports can be shown to the user.
const root = document.getElementById("app");

function showBootError(error) {
  if (!root) return;
  root.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "error-state";
  panel.setAttribute("role", "alert");
  const title = document.createElement("h2");
  title.textContent = "NexGuard could not start";
  const message = document.createElement("p");
  message.className = "error";
  message.textContent = "The Mini App could not load its files. Check your connection and try again.";
  const detail = document.createElement("p");
  detail.className = "muted";
  detail.textContent = error?.message ? String(error.message).slice(0, 240) : "Module loading failed.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => window.location.reload());
  panel.append(title, message, detail, retry);
  root.append(panel);
}

async function start() {
  try {
    await import("./bootstrap.js?v=2026.11.16-dashboard1");
  } catch (error) {
    showBootError(error);
  }
}

start();
