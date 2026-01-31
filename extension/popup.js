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

const DEFAULT_API_BASE = "http://localhost:4000/api";
const DASHBOARD_URL = "http://localhost:5173";

let isRecording = false;
let recordingStartTime = null;
let durationInterval = null;

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
chrome.storage.local.get(["qa_recording", "qa_status", "qa_recording_start"], (state) => {
  isRecording = state.qa_recording || false;
  recordingStartTime = state.qa_recording_start ? new Date(state.qa_recording_start) : null;
  updateUI(state.qa_status || (isRecording ? "recording" : "idle"));
});

syncSessions().finally(loadRecentSessions);

function updateUI(status) {
  const state = status === "recording" ? "recording" : "idle";
  recordingControl.dataset.state = state;
  
  if (state === "recording") {
    mainBtn.querySelector(".btn-label").textContent = "Stop Recording";
    statusText.textContent = "";
    quickActions.classList.remove("hidden");
    startDurationTimer();
  } else {
    mainBtn.querySelector(".btn-label").textContent = "Start Recording";
    statusText.textContent = "Record your test session for AI analysis";
    quickActions.classList.add("hidden");
    stopDurationTimer();
    durationEl.textContent = "";
  }
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

mainBtn.addEventListener("click", () => {
  if (isRecording) {
    chrome.runtime.sendMessage({ type: "STOP" }, () => {
      isRecording = false;
      chrome.storage.local.remove("qa_recording_start");
      updateUI("idle");
      syncSessions().finally(loadRecentSessions);
    });
  } else {
    const startTime = new Date().toISOString();
    chrome.storage.local.set({ qa_recording_start: startTime });
    recordingStartTime = new Date(startTime);
    chrome.runtime.sendMessage({ type: "START", apiBase: DEFAULT_API_BASE }, () => {
      isRecording = true;
      updateUI("recording");
    });
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
    isRecording = message.value === "recording";
    updateUI(message.value);
    if (!isRecording) {
      syncSessions().finally(loadRecentSessions);
    }
  }
});

function loadRecentSessions() {
  chrome.storage.local.get(["qa_sessions"], (state) => {
    renderSessions(state.qa_sessions || []);
  });
}

async function syncSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["qa_device_id", "qa_device_secret"], async (state) => {
      const deviceId = state.qa_device_id;
      const deviceSecret = state.qa_device_secret;
      if (!deviceId) {
        resolve();
        return;
      }
      try {
        const res = await fetch(`${DEFAULT_API_BASE}/sessions?device_id=${deviceId}`, {
          headers: {
            "x-device-id": deviceId,
            "x-device-secret": deviceSecret || "",
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
