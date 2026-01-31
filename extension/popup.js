const apiBaseInput = document.getElementById("apiBase");
const webUrlInput = document.getElementById("webUrl");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const sessionList = document.getElementById("sessionList");
const openWebBtn = document.getElementById("openWeb");

const defaultWebUrl = "http://localhost:5173";

chrome.storage.local.get(["qa_api_base", "qa_recording", "qa_status", "qa_web_url"], (state) => {
  apiBaseInput.value = state.qa_api_base || "http://localhost:4000/api";
  webUrlInput.value = state.qa_web_url || defaultWebUrl;
  if (state.qa_status) {
    updateStatus(capitalize(state.qa_status));
  } else {
    updateStatus(state.qa_recording ? "Recording" : "Idle");
  }
});

syncSessions().finally(loadRecentSessions);

function updateStatus(text) {
  statusEl.textContent = text;
  statusEl.dataset.status = String(text || "").toLowerCase();
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeUrl(value) {
  if (!value) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return `http://${value}`;
  }
  return value;
}

startBtn.addEventListener("click", () => {
  const apiBase = apiBaseInput.value.trim();
  chrome.storage.local.set({ qa_api_base: apiBase });
  chrome.runtime.sendMessage({ type: "START", apiBase }, () => {
    updateStatus("Recording");
    syncSessions().finally(loadRecentSessions);
  });
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP" }, () => {
    updateStatus("Stopped");
    syncSessions().finally(loadRecentSessions);
  });
});

openWebBtn.addEventListener("click", () => {
  const raw = webUrlInput.value.trim();
  const url = normalizeUrl(raw || defaultWebUrl);
  chrome.storage.local.set({ qa_web_url: url });
  chrome.tabs.create({ url });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATUS") {
    updateStatus(message.value);
    syncSessions().finally(loadRecentSessions);
  }
});

function loadRecentSessions() {
  chrome.storage.local.get(["qa_sessions"], (state) => {
    renderSessions(state.qa_sessions || []);
  });
}

async function syncSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["qa_device_id", "qa_api_base"], async (state) => {
      const deviceId = state.qa_device_id;
      const apiBase = state.qa_api_base || "http://localhost:4000/api";
      if (!deviceId) {
        resolve();
        return;
      }
      try {
        const res = await fetch(`${apiBase}/sessions?device_id=${deviceId}`);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const sessions = await res.json();
        chrome.storage.local.set({ qa_sessions: sessions });
      } catch {
        // ignore network failures
      }
      resolve();
    });
  });
}

function renderSessions(sessions) {
  sessionList.innerHTML = "";
  if (!sessions.length) {
    sessionList.innerHTML = "<div class=\"session-empty\">No sessions yet.</div>";
    return;
  }

  sessions.slice(0, 6).forEach((session) => {
    const row = document.createElement("div");
    row.className = "session-row";
    const id = session.id ? session.id.slice(0, 8) : "session";
    const started = session.started_at ? new Date(session.started_at).toLocaleString() : "";
    row.innerHTML = `
      <div>
        <div class="session-id">${id}</div>
        <div class="session-meta">${started}</div>
      </div>
      <div class="session-status">${session.status || "unknown"}</div>
    `;
    sessionList.appendChild(row);
  });
}
