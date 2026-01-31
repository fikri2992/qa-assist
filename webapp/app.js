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
const annotationList = document.getElementById("annotationList");
const markerList = document.getElementById("markerList");
const annotationCount = document.getElementById("annotationCount");
const markerCount = document.getElementById("markerCount");

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
    const events = await fetchJson(`${apiBase}/sessions/${sessionId}/events?limit=500`);

    sessionMeta.textContent = `Started ${formatDate(session.started_at)} · ${session.chunks.length} chunks`;
    setStatus(session.status);

    renderChunks(session.chunks);
    renderVideo(session.chunks);
    renderEvents(events);
    renderLogs(events);
    renderMarkers(events);
    renderAnnotations(events);
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

function renderMarkers(events) {
  const markers = events.filter((event) => event.type === "marker");
  markerCount.textContent = markers.length;
  markerList.innerHTML = "";

  if (!markers.length) {
    markerList.innerHTML = "<div class=\"marker-card\">No markers yet.</div>";
    return;
  }

  markers.forEach((marker) => {
    const card = document.createElement("div");
    card.className = "marker-card";
    const label = marker.payload?.label || "Marker";
    card.innerHTML = `
      <h4>${label}</h4>
      <div>${formatDate(marker.ts)}</div>
    `;
    markerList.appendChild(card);
  });
}

function renderAnnotations(events) {
  const annotations = events.filter((event) => event.type === "annotation");
  annotationCount.textContent = annotations.length;
  annotationList.innerHTML = "";

  if (!annotations.length) {
    annotationList.innerHTML = "<div class=\"annotation-card\">No annotations yet.</div>";
    return;
  }

  annotations.forEach((annotation) => {
    const card = document.createElement("div");
    card.className = "annotation-card";
    const text = annotation.payload?.text || "(empty)";
    card.innerHTML = `
      <h4>${formatDate(annotation.ts)}</h4>
      <p>${escapeHtml(text)}</p>
    `;
    annotationList.appendChild(card);
  });
}

function renderAnalysis(analysis) {
  analysisPane.textContent = JSON.stringify(analysis, null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

loadSessionsBtn.addEventListener("click", loadSessions);
