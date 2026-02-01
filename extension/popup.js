const mainBtn = document.getElementById("mainBtn");
const recordingControl = document.getElementById("recordingControl");
const quickActions = document.getElementById("quickActions");
const statusText = document.getElementById("statusText");
const durationEl = document.getElementById("duration");
const sessionList = document.getElementById("sessionList");
const openDashboard = document.getElementById("openDashboard");
const markerBtn = document.getElementById("markerBtn");
const annotateBtn = document.getElementById("annotateBtn");
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const loginPanel = document.getElementById("loginPanel");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");
const demoBtn = document.getElementById("demoBtn");
const debugToggle = document.getElementById("debugToggle");

const DEFAULT_API_BASE = "http://localhost:4000/api";
const DASHBOARD_URL = "http://localhost:5173";

let isRecording = false;
let recordingStartTime = null;
let durationInterval = null;
let authToken = null;
let apiBase = DEFAULT_API_BASE;
let lastError = "";
let lastState = "";
let lastStateReason = "";
let lastStateTs = "";

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    document.getElementById(`${targetTab}Tab`).classList.add("active");
  });
});

// Initialize state
chrome.storage.local.get(
  [
    "qa_recording",
    "qa_status",
    "qa_recording_start",
    "qa_auth_token",
    "qa_auth_email",
    "qa_api_base",
    "qa_debug",
    "qa_last_error",
    "qa_last_state",
    "qa_last_state_reason",
    "qa_last_state_ts"
  ],
  (state) => {
    authToken = state.qa_auth_token || null;
    apiBase = state.qa_api_base || DEFAULT_API_BASE;
    if (state.qa_auth_email) {
      loginEmail.value = state.qa_auth_email;
    }
    debugToggle.checked = state.qa_debug === true;
    lastError = state.qa_last_error || "";
    lastState = state.qa_last_state || "";
    lastStateReason = state.qa_last_state_reason || "";
    lastStateTs = state.qa_last_state_ts || "";
    updateAuthUI();

    isRecording = state.qa_recording || false;
    recordingStartTime = state.qa_recording_start ? new Date(state.qa_recording_start) : null;
    const initialStatus = (state.qa_status || (isRecording ? "recording" : "idle")).toLowerCase();
    updateUI(initialStatus);
  }
);

debugToggle.addEventListener("change", () => {
  chrome.storage.local.set({ qa_debug: debugToggle.checked });
});

syncSessions().finally(loadRecentSessions);

function updateUI(status) {
  if (!authToken) {
    recordingControl.dataset.state = "idle";
    mainBtn.querySelector(".btn-label").textContent = "Start Recording";
    statusText.textContent = "Login required to record";
    statusText.classList.remove("status-error");
    quickActions.classList.add("hidden");
    stopDurationTimer();
    durationEl.textContent = "";
    return;
  }

  const normalized = (status || "").toLowerCase();
  const state = normalized === "recording" ? "recording" : "idle";
  recordingControl.dataset.state = state;
  
  if (state === "recording") {
    mainBtn.querySelector(".btn-label").textContent = "Stop Recording";
    statusText.textContent = "";
    statusText.classList.remove("status-error");
    lastError = "";
    quickActions.classList.remove("hidden");
    startDurationTimer();
  } else {
    mainBtn.querySelector(".btn-label").textContent = "Start Recording";
    if (lastError) {
      statusText.textContent = lastError;
      statusText.classList.add("status-error");
    } else if (lastState) {
      const reasonText = lastStateReason ? ` (${lastStateReason})` : "";
      statusText.textContent = `Last state: ${lastState}${reasonText}`;
      statusText.classList.remove("status-error");
    } else {
      statusText.textContent = "Record your test session for AI analysis";
      statusText.classList.remove("status-error");
    }
    quickActions.classList.add("hidden");
    stopDurationTimer();
    durationEl.textContent = "";
  }
}

function setLastError(message) {
  lastError = message || "";
  chrome.storage.local.set({ qa_last_error: lastError });
}

function refreshLastState(callback) {
  chrome.storage.local.get(
    ["qa_last_state", "qa_last_state_reason", "qa_last_state_ts"],
    (state) => {
      lastState = state.qa_last_state || "";
      lastStateReason = state.qa_last_state_reason || "";
      lastStateTs = state.qa_last_state_ts || "";
      if (callback) callback();
    }
  );
}

function startDurationTimer() {
  if (durationInterval) return;
  if (!recordingStartTime) recordingStartTime = new Date();
  
  const updateDuration = () => {
    const elapsed = Math.floor((Date.now() - recordingStartTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    durationEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  updateDuration();
  durationInterval = setInterval(updateDuration, 1000);
}

function stopDurationTimer() {
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
  recordingStartTime = null;
}

function updateAuthUI() {
  const loggedIn = !!authToken;
  loginPanel.classList.toggle("hidden", loggedIn);
  recordingControl.classList.toggle("hidden", !loggedIn);
}

async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginStatus.textContent = "Email and password required.";
    return;
  }

  loginStatus.textContent = "Signing in...";
  try {
    const authUrl = (apiBase || DEFAULT_API_BASE).replace(/\/api\/?$/, "") + "/api/auth/login";
    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    authToken = data.token;
    await chrome.storage.local.set({ qa_auth_token: authToken, qa_auth_email: email });
    loginPassword.value = "";
    loginStatus.textContent = "Signed in.";
    updateAuthUI();
    updateUI(isRecording ? "recording" : "idle");
    syncSessions().finally(loadRecentSessions);
  } catch (err) {
    loginStatus.textContent = err.message || "Login failed.";
  }
}

loginBtn.addEventListener("click", handleLogin);

demoBtn.addEventListener("click", () => {
  loginEmail.value = "demo@qaassist.local";
  loginPassword.value = "demo123";
  handleLogin();
});

mainBtn.addEventListener("click", async () => {
  if (!authToken) {
    loginStatus.textContent = "Login required.";
    return;
  }

  if (isRecording) {
    chrome.runtime.sendMessage({ type: "STOP" }, () => {
      if (chrome.runtime?.lastError) {
        setLastError(chrome.runtime.lastError.message || "Failed to stop recording.");
      }
      isRecording = false;
      chrome.storage.local.remove("qa_recording_start");
      updateUI("idle");
      syncSessions().finally(loadRecentSessions);
    });
  } else {
    let streamInfo = null;
    try {
      streamInfo = await getActiveStream();
    } catch (err) {
      setLastError(err?.message || "Unable to capture the active tab.");
      updateUI("idle");
      return;
    }
    const startTime = new Date().toISOString();
    chrome.storage.local.set({ qa_recording_start: startTime, qa_last_error: "" });
    recordingStartTime = new Date(startTime);
    lastError = "";
    statusText.textContent = "Starting...";
    statusText.classList.remove("status-error");
    chrome.runtime.sendMessage(
      {
        type: "START",
        apiBase: apiBase || DEFAULT_API_BASE,
        debug: debugToggle.checked,
        streamId: streamInfo?.streamId,
        captureTabId: streamInfo?.tabId
      },
      (response) => {
        if (chrome.runtime?.lastError) {
          setLastError(chrome.runtime.lastError.message || "Failed to start recording.");
          chrome.storage.local.remove("qa_recording_start");
          isRecording = false;
          updateUI("idle");
          return;
        }
        if (!response?.ok) {
          setLastError(response?.error || "Failed to start recording.");
          chrome.storage.local.remove("qa_recording_start");
          isRecording = false;
          updateUI("idle");
          return;
        }
        isRecording = true;
        setLastError("");
        updateUI("recording");
      }
    );
  }
});

markerBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "MARKER" });
  markerBtn.classList.add("pressed");
  setTimeout(() => markerBtn.classList.remove("pressed"), 150);
});

annotateBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "ANNOTATE" });
  annotateBtn.classList.add("pressed");
  setTimeout(() => annotateBtn.classList.remove("pressed"), 150);
});

openDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATUS") {
    const normalized = (message.value || "").toLowerCase();
    isRecording = normalized === "recording";
    refreshLastState(() => updateUI(normalized));
    if (!isRecording) {
      syncSessions().finally(loadRecentSessions);
    }
  }
  if (message.type === "ERROR") {
    setLastError(message.message || "Recording error.");
    isRecording = false;
    chrome.storage.local.remove("qa_recording_start");
    refreshLastState(() => updateUI("idle"));
  }
});

function loadRecentSessions() {
  chrome.storage.local.get(["qa_sessions"], (state) => {
    renderSessions(state.qa_sessions || []);
  });
}

async function syncSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["qa_device_id", "qa_auth_token"], async (state) => {
      const deviceId = state.qa_device_id;
      const token = state.qa_auth_token;
      if (!deviceId || !token) {
        resolve();
        return;
      }
      try {
        const res = await fetch(`${apiBase || DEFAULT_API_BASE}/sessions?device_id=${deviceId}`, {
          headers: {
            "x-device-id": deviceId,
            "Authorization": `Bearer ${token}`,
          },
        });
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

function getActiveStream() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab?.id) {
        reject(new Error("No active tab found."));
        return;
      }

      chrome.tabCapture.getMediaStreamId(
        { consumerTabId: tab.id, targetTabId: tab.id },
        (streamId) => {
          const err = chrome.runtime?.lastError;
          if (err) {
            reject(new Error(err.message || "Failed to capture tab."));
            return;
          }
          if (!streamId) {
            reject(new Error("Failed to capture tab."));
            return;
          }
          resolve({ streamId, tabId: tab.id });
        }
      );
    });
  });
}

function renderSessions(sessions) {
  sessionList.innerHTML = "";
  
  if (!sessions.length) {
    sessionList.innerHTML = `
      <div class="session-empty">
        <span class="empty-icon">📋</span>
        <span>No sessions yet</span>
        <span class="empty-hint">Start recording to create your first session</span>
      </div>
    `;
    return;
  }

  sessions.slice(0, 8).forEach((session) => {
    const row = document.createElement("button");
    row.className = "session-row";
    row.onclick = () => {
      chrome.tabs.create({ url: `${DASHBOARD_URL}/sessions/${session.id}` });
    };
    
    const id = session.id ? session.id.slice(0, 8) : "session";
    const started = session.started_at ? formatRelativeTime(new Date(session.started_at)) : "";
    const statusClass = session.status || "unknown";
    
    row.innerHTML = `
      <div class="session-info">
        <span class="session-id">${id}</span>
        <span class="session-time">${started}</span>
      </div>
      <div class="session-right">
        <span class="session-status" data-status="${statusClass}">${session.status || "?"}</span>
        <span class="session-arrow">→</span>
      </div>
    `;
    sessionList.appendChild(row);
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
