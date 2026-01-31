const apiBaseInput = document.getElementById("apiBase");
const deviceIdInput = document.getElementById("deviceId");
const loadSessionsBtn = document.getElementById("loadSessions");
const sessionList = document.getElementById("sessionList");
const sessionTitle = document.getElementById("sessionTitle");
const sessionMeta = document.getElementById("sessionMeta");
const sessionStatus = document.getElementById("sessionStatus");
const videoPlayer = document.getElementById("videoPlayer");
const chunkList = document.getElementById("chunkList");
const timelineTrack = document.getElementById("timelineTrack");
const timelinePins = document.getElementById("timelinePins");
const annotationOverlay = document.getElementById("annotationOverlay");
const logPane = document.getElementById("logPane");
const eventPane = document.getElementById("eventPane");
const analysisPane = document.getElementById("analysisPane");
const annotationList = document.getElementById("annotationList");
const markerList = document.getElementById("markerList");
const annotationCount = document.getElementById("annotationCount");
const markerCount = document.getElementById("markerCount");
const artifactList = document.getElementById("artifactList");
const chatList = document.getElementById("chatList");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatStop = document.getElementById("chatStop");
const chatMode = document.getElementById("chatMode");
const chatModel = document.getElementById("chatModel");

const storedApiBase = localStorage.getItem("qa_api_base") || "http://localhost:4000/api";
const storedDeviceId = localStorage.getItem("qa_device_id") || "";

apiBaseInput.value = storedApiBase;
deviceIdInput.value = storedDeviceId;

let currentChunks = [];
let currentChunkIndex = 0;
let currentEvents = [];
let currentSession = null;
let currentApiBase = storedApiBase;
let chatAbort = null;

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
  currentApiBase = apiBase;
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
    const events = await fetchJson(`${apiBase}/sessions/${sessionId}/events?limit=1000`);
    const artifacts = await fetchJson(`${apiBase}/sessions/${sessionId}/artifacts`);

    sessionMeta.textContent = `Started ${formatDate(session.started_at)} · ${session.chunks.length} chunks`;
    setStatus(session.status);

    const orderedEvents = events.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));

    currentSession = session;
    currentApiBase = apiBase;
    currentChunks = session.chunks.slice().sort((a, b) => a.idx - b.idx);
    currentChunkIndex = 0;
    currentEvents = orderedEvents;

    renderChunks(currentChunks);
    setCurrentChunk(0);
    renderTimeline(session, currentChunks, orderedEvents);
    renderEvents(orderedEvents);
    renderLogs(orderedEvents);
    renderMarkers(orderedEvents);
    renderAnnotations(orderedEvents);
    renderAnalysis(analysis);
    renderArtifacts(artifacts, apiBase);
    renderChatIntro();
  } catch (err) {
    sessionMeta.textContent = err.message;
    setStatus("error");
  }
}

function renderChunks(chunks) {
  chunkList.innerHTML = "";
  chunks.forEach((chunk, index) => {
    const pill = document.createElement("div");
    pill.className = "chunk-pill";
    pill.textContent = `#${chunk.idx} · ${chunk.status} · ${chunk.analysis_status}`;
    pill.addEventListener("click", () => setCurrentChunk(index));
    chunkList.appendChild(pill);
  });
}

function setCurrentChunk(index) {
  if (!currentChunks.length) {
    videoPlayer.removeAttribute("src");
    return;
  }
  currentChunkIndex = Math.max(0, Math.min(index, currentChunks.length - 1));
  const chunk = currentChunks[currentChunkIndex];
  if (chunk?.video_url) {
    videoPlayer.src = chunk.video_url;
  }

  highlightTimeline();
  highlightChunks();
  renderOverlay();
}

function highlightTimeline() {
  const segments = timelineTrack.querySelectorAll(".timeline-segment");
  segments.forEach((segment, index) => {
    segment.classList.toggle("active", index === currentChunkIndex);
  });
}

function highlightChunks() {
  const pills = chunkList.querySelectorAll(".chunk-pill");
  pills.forEach((pill, index) => {
    pill.classList.toggle("active", index === currentChunkIndex);
  });
}

function renderTimeline(session, chunks, events) {
  timelineTrack.innerHTML = "";
  timelinePins.innerHTML = "";

  if (!chunks.length) return;

  const { start, end } = getSessionWindow(session, chunks, events);
  const total = Math.max(end - start, 1);

  chunks.forEach((chunk, index) => {
    const duration = getDuration(chunk, 1);
    const widthPercent = (duration / total) * 100;
    const segment = document.createElement("div");
    segment.className = "timeline-segment";
    segment.style.width = `${widthPercent}%`;
    segment.title = `Chunk ${chunk.idx}`;
    segment.addEventListener("click", () => setCurrentChunk(index));
    timelineTrack.appendChild(segment);
  });

  highlightTimeline();

  events.forEach((event) => {
    if (!event.ts) return;
    const time = new Date(event.ts).getTime();
    const left = ((time - start) / total) * 100;
    if (left < 0 || left > 100) return;

    if (event.type === "marker" || event.type === "annotation") {
      const pin = document.createElement("div");
      pin.className = `timeline-pin ${event.type === "annotation" ? "annotation" : ""}`;
      pin.style.left = `calc(${left}% - 5px)`;
      pin.title = event.type === "annotation" ? event.payload?.text || "Annotation" : "Marker";
      pin.dataset.label = pin.title;
      timelinePins.appendChild(pin);
    }
  });
}

function getDuration(chunk, fallback) {
  if (chunk.start_ts && chunk.end_ts) {
    const start = new Date(chunk.start_ts).getTime();
    const end = new Date(chunk.end_ts).getTime();
    const duration = end - start;
    return duration > 0 ? duration : fallback;
  }
  return fallback;
}

function getSessionWindow(session, chunks, events) {
  const timestamps = [];
  if (session.started_at) timestamps.push(new Date(session.started_at).getTime());
  if (session.ended_at) timestamps.push(new Date(session.ended_at).getTime());
  chunks.forEach((chunk) => {
    if (chunk.start_ts) timestamps.push(new Date(chunk.start_ts).getTime());
    if (chunk.end_ts) timestamps.push(new Date(chunk.end_ts).getTime());
  });
  events.forEach((event) => {
    if (event.ts) timestamps.push(new Date(event.ts).getTime());
  });

  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);
  return {
    start: Number.isFinite(start) ? start : Date.now(),
    end: Number.isFinite(end) ? end : Date.now() + 1
  };
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
    const label = marker.payload?.label || marker.payload?.message || "Marker";
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

function renderOverlay() {
  annotationOverlay.innerHTML = "";
  if (!currentSession || !currentChunks.length) return;

  const chunk = currentChunks[currentChunkIndex];
  if (!chunk?.start_ts || !chunk?.end_ts) return;
  const start = new Date(chunk.start_ts).getTime();
  const end = new Date(chunk.end_ts).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;

  const relevant = currentEvents.filter((event) => {
    if (!event.ts) return false;
    if (event.type !== "annotation" && event.type !== "marker") return false;
    const ts = new Date(event.ts).getTime();
    return ts >= start && ts <= end;
  });

  const rect = videoPlayer.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  relevant.forEach((event) => {
    const payload = event.payload || {};
    const viewport = payload.viewport || currentSession?.metadata?.viewport;
    const x = payload.x;
    const y = payload.y;
    if (!viewport || typeof x !== "number" || typeof y !== "number") return;

    const left = (x / viewport.width) * 100;
    const top = (y / viewport.height) * 100;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;

    const pin = document.createElement("div");
    pin.className = `overlay-pin ${event.type === "marker" ? "marker" : ""}`;
    pin.style.left = `${left}%`;
    pin.style.top = `${top}%`;
    pin.dataset.label =
      event.type === "annotation"
        ? payload.text || "Annotation"
        : payload.label || payload.message || "Marker";
    annotationOverlay.appendChild(pin);
  });
}

function renderArtifacts(artifacts, apiBase) {
  artifactList.innerHTML = "";
  if (!artifacts.length) {
    artifactList.innerHTML = "<div class=\"artifact-card\">No artifacts yet.</div>";
    return;
  }

  artifacts.forEach((artifact) => {
    const card = document.createElement("div");
    card.className = "artifact-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(artifact.name)}</strong>
        <div>${escapeHtml(artifact.description || "")}</div>
      </div>
      <a href="${apiBase}/artifacts/${artifact.id}" target="_blank" rel="noreferrer">Download</a>
    `;
    artifactList.appendChild(card);
  });
}

function renderAnalysis(analysis) {
  analysisPane.textContent = JSON.stringify(analysis, null, 2);
}

function renderChatIntro() {
  chatList.innerHTML = "";
  if (!currentSession) return;
  addChatMessage("assistant", "Ask me about this session's logs, UI issues, or repro steps.");
}

function addChatMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  chatList.appendChild(bubble);
  chatList.scrollTop = chatList.scrollHeight;
}

function setChatBusy(isBusy) {
  chatSend.disabled = isBusy;
  chatStop.disabled = !isBusy;
  chatSend.textContent = isBusy ? "..." : "Send";
}

async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  if (!currentSession) {
    addChatMessage("assistant", "Select a session first.");
    return;
  }

  addChatMessage("user", message);
  chatInput.value = "";
  setChatBusy(true);

  chatAbort = new AbortController();
  try {
    const res = await fetch(`${currentApiBase}/sessions/${currentSession.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        mode: chatMode.value,
        model: chatModel.value
      }),
      signal: chatAbort.signal
    });
    if (!res.ok) {
      throw new Error(`Chat failed: ${res.status}`);
    }
    const data = await res.json();
    addChatMessage("assistant", data.reply || "No reply.");
  } catch (err) {
    if (err.name !== "AbortError") {
      addChatMessage("assistant", err.message || "Chat failed.");
    }
  } finally {
    setChatBusy(false);
    chatAbort = null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

videoPlayer.addEventListener("ended", () => {
  if (currentChunkIndex < currentChunks.length - 1) {
    setCurrentChunk(currentChunkIndex + 1);
  }
});

videoPlayer.addEventListener("loadedmetadata", renderOverlay);
window.addEventListener("resize", renderOverlay);

loadSessionsBtn.addEventListener("click", loadSessions);

chatSend.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage();
  }
});
chatStop.addEventListener("click", () => {
  if (chatAbort) {
    chatAbort.abort();
  }
});
setChatBusy(false);
