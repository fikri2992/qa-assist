const apiBaseInput = document.getElementById("apiBase");
const deviceIdInput = document.getElementById("deviceId");
const loadSessionsBtn = document.getElementById("loadSessions");
const sessionList = document.getElementById("sessionList");
const sessionTitle = document.getElementById("sessionTitle");
const sessionMeta = document.getElementById("sessionMeta");
const sessionStatus = document.getElementById("sessionStatus");
const videoPlayer = document.getElementById("videoPlayer");
const chunkList = document.getElementById("chunkList");
const logPane = document.getElementById("logPane");
const eventPane = document.getElementById("eventPane");
const analysisPane = document.getElementById("analysisPane");

const storedApiBase = localStorage.getItem("qa_api_base") || "http://localhost:4000/api";
const storedDeviceId = localStorage.getItem("qa_device_id") || "";

apiBaseInput.value = storedApiBase;
deviceIdInput.value = storedDeviceId;

function setStatus(text) {
  sessionStatus.textContent = text || "";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

async function loadSessions() {
  const apiBase = apiBaseInput.value.trim();
  const deviceId = deviceIdInput.value.trim();

  if (!apiBase || !deviceId) {
    alert("API URL and Device ID are required.");
    return;
  }

  localStorage.setItem("qa_api_base", apiBase);
  localStorage.setItem("qa_device_id", deviceId);

  sessionList.innerHTML = "";
  sessionTitle.textContent = "Loading...";
  sessionMeta.textContent = "";
  setStatus("");

  try {
    const sessions = await fetchJson(`${apiBase}/sessions?device_id=${deviceId}`);
    if (!sessions.length) {
      sessionTitle.textContent = "No sessions found";
      return;
    }
    sessionTitle.textContent = "Select a session";
    sessions.forEach((session) => addSessionItem(session, apiBase));
  } catch (err) {
    sessionTitle.textContent = "Failed to load sessions";
    sessionMeta.textContent = err.message;
  }
}

function addSessionItem(session, apiBase) {
  const item = document.createElement("li");
  item.textContent = `${session.id.slice(0, 8)} · ${session.status}`;
  item.onclick = () => selectSession(session.id, apiBase, item);
  sessionList.appendChild(item);
}

async function selectSession(sessionId, apiBase, selectedItem) {
  [...sessionList.children].forEach((child) => child.classList.remove("active"));
  selectedItem.classList.add("active");

  sessionTitle.textContent = `Session ${sessionId}`;
  setStatus("Loading...");

  try {
    const session = await fetchJson(`${apiBase}/sessions/${sessionId}`);
    const analysis = await fetchJson(`${apiBase}/sessions/${sessionId}/analysis`);
    const events = await fetchJson(`${apiBase}/sessions/${sessionId}/events?limit=200`);

    sessionMeta.textContent = `Started ${formatDate(session.started_at)} · ${session.chunks.length} chunks`;
    setStatus(session.status);

    renderChunks(session.chunks);
    renderVideo(session.chunks);
    renderEvents(events);
    renderLogs(events);
    renderAnalysis(analysis);
  } catch (err) {
    sessionMeta.textContent = err.message;
    setStatus("error");
  }
}

function renderChunks(chunks) {
  chunkList.innerHTML = "";
  chunks.forEach((chunk) => {
    const pill = document.createElement("div");
    pill.className = "chunk-pill";
    pill.textContent = `#${chunk.idx} · ${chunk.status} · ${chunk.analysis_status}`;
    chunkList.appendChild(pill);
  });
}

function renderVideo(chunks) {
  const firstReady = chunks.find((chunk) => chunk.video_url);
  if (firstReady) {
    videoPlayer.src = firstReady.video_url;
  } else {
    videoPlayer.removeAttribute("src");
  }
}

function renderEvents(events) {
  eventPane.textContent = JSON.stringify(events, null, 2);
}

function renderLogs(events) {
  const logs = events.filter((event) => event.type === "console" || event.type === "network");
  logPane.textContent = JSON.stringify(logs, null, 2);
}

function renderAnalysis(analysis) {
  analysisPane.textContent = JSON.stringify(analysis, null, 2);
}

loadSessionsBtn.addEventListener("click", loadSessions);
