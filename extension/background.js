const DEFAULT_API_BASE = "http://localhost:4000/api";
const CHUNK_DURATION_MS = 10 * 60 * 1000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const state = {
  deviceId: null,
  sessionId: null,
  recording: false,
  status: "idle",
  apiBase: DEFAULT_API_BASE,
  chunkIndex: 0,
  currentTabId: null,
  lastActivity: Date.now(),
  lastUrl: null,
  autoPaused: false,
  flushTimer: null,
  idleTimer: null,
  eventQueue: []
};

async function loadState() {
  const stored = await chrome.storage.local.get([
    "qa_device_id",
    "qa_session_id",
    "qa_recording",
    "qa_status",
    "qa_chunk_index",
    "qa_api_base",
    "qa_auto_paused"
  ]);
  state.deviceId = stored.qa_device_id || null;
  state.sessionId = stored.qa_session_id || null;
  state.recording = stored.qa_recording || false;
  state.status = stored.qa_status || (state.recording ? "recording" : "idle");
  state.chunkIndex = stored.qa_chunk_index || 0;
  state.apiBase = stored.qa_api_base || DEFAULT_API_BASE;
  state.autoPaused = stored.qa_auto_paused || false;
}

async function persistState() {
  await chrome.storage.local.set({
    qa_device_id: state.deviceId,
    qa_session_id: state.sessionId,
    qa_recording: state.recording,
    qa_status: state.status,
    qa_chunk_index: state.chunkIndex,
    qa_api_base: state.apiBase,
    qa_auto_paused: state.autoPaused
  });
}

async function apiFetch(path, options = {}) {
  const url = `${state.apiBase.replace(/\/$/, "")}${path}`;
  const headers = options.headers || {};

  if (state.deviceId) {
    headers["x-device-id"] = state.deviceId;
  }

  const body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function ensureDevice() {
  if (state.deviceId) {
    return state.deviceId;
  }

  const response = await apiFetch("/devices", {
    method: "POST",
    body: JSON.stringify({ metadata: { userAgent: navigator.userAgent } })
  });

  state.deviceId = response.device_id;
  await persistState();
  return state.deviceId;
}

async function createSession(tab, env) {
  const response = await apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({
      metadata: {
        url: tab.url,
        title: tab.title,
        userAgent: env?.userAgent || navigator.userAgent,
        viewport: env?.viewport,
        screen: env?.screen,
        platform: env?.platform,
        language: env?.language,
        userAgentData: env?.userAgentData
      }
    })
  });

  state.sessionId = response.session.id;
  state.chunkIndex = 0;
  await persistState();

  await addSessionEntry({
    id: response.session.id,
    url: tab.url,
    title: tab.title,
    started_at: response.session.started_at,
    status: response.session.status,
    metadata: response.session.metadata
  });
}

async function startSession() {
  await apiFetch(`/sessions/${state.sessionId}/start`, { method: "POST" });
}

async function pauseSession() {
  if (!state.sessionId) return;
  await apiFetch(`/sessions/${state.sessionId}/pause`, { method: "POST" });
}

async function resumeSession() {
  if (!state.sessionId) return;
  await apiFetch(`/sessions/${state.sessionId}/resume`, { method: "POST" });
}

async function stopSession() {
  if (!state.sessionId) return;
  await apiFetch(`/sessions/${state.sessionId}/stop`, { method: "POST" });
}

async function attachDebugger(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Log.enable");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
  } catch (err) {
    console.warn("Debugger attach failed", err);
  }
}

async function detachDebugger(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    console.warn("Debugger detach failed", err);
  }
}

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record active tab video"
    });
  }
}

async function startCapture(tabId) {
  await ensureOffscreen();

  const streamId = await chrome.tabCapture.getMediaStreamId({
    consumerTabId: tabId,
    targetTabId: tabId
  });

  chrome.runtime.sendMessage({
    type: "OFFSCREEN_START",
    streamId,
    sessionId: state.sessionId,
    chunkDurationMs: CHUNK_DURATION_MS,
    chunkStartIndex: state.chunkIndex
  });
}

async function stopCapture() {
  chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
}

function scheduleFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setInterval(flushEvents, 3000);
}

function scheduleIdleCheck() {
  if (state.idleTimer) return;
  state.idleTimer = setInterval(() => {
    if (!state.recording) return;
    if (Date.now() - state.lastActivity > IDLE_TIMEOUT_MS) {
      handleAutoPause("Idle timeout");
    }
  }, 15000);
}

async function flushEvents() {
  if (!state.sessionId || state.eventQueue.length === 0) return;
  const batch = state.eventQueue.splice(0, state.eventQueue.length);
  try {
    await apiFetch(`/sessions/${state.sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events: batch })
    });
  } catch (err) {
    console.warn("Failed to flush events", err);
    state.eventQueue.unshift(...batch);
  }
}

function enqueueEvent(event) {
  state.eventQueue.push(event);
  scheduleFlush();
}

async function startRecording(apiBaseOverride) {
  await loadState();
  if (apiBaseOverride) state.apiBase = apiBaseOverride;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const env = await getTabEnvironment(tab.id);

  await ensureDevice();
  if (state.sessionId && state.status === "paused") {
    await resumeSession();
    const details = await apiFetch(`/sessions/${state.sessionId}`);
    state.chunkIndex = details?.chunks?.length || state.chunkIndex;
    await updateSessionEntry(state.sessionId, { status: "recording" });
  } else {
    await createSession(tab, env);
    await startSession();
  }

  state.recording = true;
  state.status = "recording";
  state.autoPaused = false;
  state.currentTabId = tab.id;
  state.lastUrl = tab.url || null;
  state.lastActivity = Date.now();
  await persistState();

  await attachDebugger(tab.id);
  await startCapture(tab.id);

  chrome.tabs.sendMessage(tab.id, { type: "HIDE_RESUME_PROMPT" });

  enqueueEvent({
    ts: new Date().toISOString(),
    type: "env",
    payload: {
      url: tab.url,
      title: tab.title,
      viewport: env?.viewport,
      screen: env?.screen,
      platform: env?.platform,
      language: env?.language,
      userAgent: env?.userAgent || navigator.userAgent,
      userAgentData: env?.userAgentData
    }
  });

  scheduleIdleCheck();
  scheduleFlush();
  notifyStatus("Recording");
}

async function stopRecording() {
  await loadState();
  if (!state.sessionId) return;

  const sessionId = state.sessionId;
  const wasRecording = state.recording;
  state.recording = false;
  state.status = "ended";
  state.autoPaused = false;
  state.sessionId = null;
  await persistState();

  if (wasRecording && state.currentTabId) {
    await detachDebugger(state.currentTabId);
  }

  if (wasRecording) {
    await stopCapture();
  }
  await flushEvents();
  await stopSession();
  await updateSessionEntry(sessionId, { status: "ended", ended_at: new Date().toISOString() });

  notifyStatus("Stopped");
}

async function pauseRecording(autoPaused = false) {
  await loadState();
  if (!state.recording) return;

  state.recording = false;
  state.status = "paused";
  state.autoPaused = autoPaused;
  await persistState();

  if (state.currentTabId) {
    await detachDebugger(state.currentTabId);
  }

  await stopCapture();
  await flushEvents();
  await pauseSession();
  await updateSessionEntry(state.sessionId, { status: "paused" });

  notifyStatus("Paused");
}

async function handleAutoPause(reason, promptTabId = null) {
  enqueueEvent({
    ts: new Date().toISOString(),
    type: "marker",
    payload: { message: `Auto-paused: ${reason}` }
  });
  await pauseRecording(true);

  let tab = null;
  if (promptTabId && Number.isFinite(promptTabId)) {
    try {
      tab = await chrome.tabs.get(promptTabId);
    } catch {
      tab = null;
    }
  }
  if (!tab) {
    tab = await getActiveTab();
  }

  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESUME_PROMPT", reason });
  }
}

function notifyStatus(value) {
  chrome.runtime.sendMessage({ type: "STATUS", value });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "START") {
    startRecording(message.apiBase).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "STOP") {
    stopRecording().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "INTERACTION") {
    state.lastActivity = Date.now();
    enqueueEvent(message.event);
  }
  if (message.type === "ACTIVITY") {
    state.lastActivity = Date.now();
  }
  if (message.type === "CHUNK_DATA") {
    handleChunkData(message).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "ANNOTATION_SUBMIT") {
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "annotation",
      payload: message.payload
    });
  }
  if (message.type === "MARKER_SUBMIT") {
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "marker",
      payload: message.payload
    });
  }
  if (message.type === "RESUME_REQUEST") {
    startRecording(state.apiBase).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!state.recording || source.tabId !== state.currentTabId) return;

  if (method === "Log.entryAdded") {
    const entry = params.entry || {};
    enqueueEvent({
      ts: new Date(entry.timestamp || Date.now()).toISOString(),
      type: "console",
      payload: { message: entry.text, level: entry.level }
    });
  }

  if (method === "Network.responseReceived") {
    const response = params.response || {};
    enqueueEvent({
      ts: new Date(response.responseTime || Date.now()).toISOString(),
      type: "network",
      payload: {
        url: response.url,
        status: response.status,
        statusText: response.statusText
      }
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!state.recording) return;
  if (activeInfo.tabId !== state.currentTabId) {
    await handleAutoPause("Tab switched", activeInfo.tabId);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (!state.recording) return;
  if (command === "add_marker") {
    await addMarker();
  }
  if (command === "add_annotation") {
    await openAnnotation();
  }
});

async function handleChunkData(message) {
  if (!state.sessionId) return;

  const chunkResponse = await apiFetch(`/sessions/${state.sessionId}/chunks`, {
    method: "POST",
    body: JSON.stringify({
      idx: message.chunkIndex,
      start_ts: new Date(message.startTs).toISOString(),
      end_ts: new Date(message.endTs).toISOString(),
      content_type: message.mimeType
    })
  });

  state.chunkIndex = message.chunkIndex + 1;
  await persistState();

  const uploadUrl = chunkResponse.upload_url;
  const uploadMethod = chunkResponse.upload_method || "POST";
  const uploadHeaders = chunkResponse.upload_headers || {};
  const resumable = chunkResponse.resumable;
  const storage = chunkResponse.storage;
  const gcsUri = chunkResponse.gcs_uri;

  const blob = new Blob([message.data], { type: message.mimeType || "video/webm" });

  if (resumable && resumable.start_url) {
    const startHeaders = resumable.start_headers || {};
    const startResponse = await fetch(resumable.start_url, {
      method: resumable.start_method || "POST",
      headers: startHeaders
    });

    const sessionUrl = startResponse.headers.get("Location");
    if (sessionUrl) {
      await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": blob.type,
          "Content-Range": `bytes 0-${blob.size - 1}/${blob.size}`
        },
        body: blob
      });
    } else {
      await directUpload(uploadUrl, uploadMethod, uploadHeaders, blob);
    }
  } else {
    await directUpload(uploadUrl, uploadMethod, uploadHeaders, blob);
  }

  if (storage === "gcs" && gcsUri) {
    await apiFetch(`/chunks/${chunkResponse.chunk.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ready",
        analysis_status: "pending",
        gcs_uri: gcsUri,
        byte_size: blob.size,
        content_type: blob.type
      })
    });
  }
}

loadState();

async function addMarker() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    await sendTabMessage(tab.id, { type: "OPEN_MARKER" });
  } catch {
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "marker",
      payload: { label: "Marker", url: tab.url || state.lastUrl }
    });
    chrome.tabs.sendMessage(tab.id, { type: "MARKER_TOAST" });
  }
}

async function openAnnotation() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "OPEN_ANNOTATION" });
}

async function getActiveTab() {
  if (state.currentTabId) {
    try {
      return await chrome.tabs.get(state.currentTabId);
    } catch {
      // fallback to query
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getTabEnvironment(tabId) {
  try {
    const response = await sendTabMessage(tabId, { type: "GET_ENV" });
    return response?.env || null;
  } catch {
    return null;
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

async function addSessionEntry(entry) {
  const stored = await chrome.storage.local.get(["qa_sessions"]);
  const sessions = stored.qa_sessions || [];
  const next = [
    {
      id: entry.id,
      url: entry.url,
      title: entry.title,
      started_at: entry.started_at || new Date().toISOString(),
      status: entry.status || "recording",
      metadata: entry.metadata || {}
    },
    ...sessions.filter((session) => session.id !== entry.id)
  ].slice(0, 20);
  await chrome.storage.local.set({ qa_sessions: next });
}

async function updateSessionEntry(sessionId, updates) {
  if (!sessionId) return;
  const stored = await chrome.storage.local.get(["qa_sessions"]);
  const sessions = stored.qa_sessions || [];
  const next = sessions.map((session) =>
    session.id === sessionId ? { ...session, ...updates } : session
  );
  await chrome.storage.local.set({ qa_sessions: next });
}

async function directUpload(uploadUrl, uploadMethod, uploadHeaders, blob) {
  if (uploadMethod.toUpperCase() === "PUT") {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: blob
    });
    return;
  }

  const formData = new FormData();
  formData.append("file", blob, `chunk-${Date.now()}.webm`);
  await fetch(uploadUrl, { method: uploadMethod, body: formData });
}
