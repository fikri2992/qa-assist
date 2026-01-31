const apiBaseInput = document.getElementById("apiBase");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["qa_api_base", "qa_recording"], (state) => {
  apiBaseInput.value = state.qa_api_base || "http://localhost:4000/api";
  updateStatus(state.qa_recording ? "Recording" : "Idle");
});

function updateStatus(text) {
  statusEl.textContent = text;
  statusEl.dataset.status = String(text || "").toLowerCase();
}

startBtn.addEventListener("click", () => {
  const apiBase = apiBaseInput.value.trim();
  chrome.storage.local.set({ qa_api_base: apiBase });
  chrome.runtime.sendMessage({ type: "START", apiBase }, () => {
    updateStatus("Recording");
  });
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP" }, () => {
    updateStatus("Stopped");
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATUS") {
    updateStatus(message.value);
  }
});
