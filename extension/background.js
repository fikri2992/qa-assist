const DEFAULT_API_BASE = "http://localhost:4000/api";
const CHUNK_DURATION_MS = 10 * 60 * 1000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const state = {
  deviceId: null,
  authToken: null,
  sessionId: null,
  recording: false,
  status: "idle",
  apiBase: DEFAULT_API_BASE,
  debug: false,
  chunkDurationMs: CHUNK_DURATION_MS,
  chunkIndex: 0,
  receivedChunks: 0,
  offscreenReady: false,
  offscreenReadyWaiters: [],
  currentTabId: null,
  lastActivity: Date.now(),
  lastUrl: null,
  autoPaused: false,
  flushTimer: null,
  idleTimer: null,
  eventQueue: [],
  stopInProgress: false,
  pendingChunkUploads: 0,
  pendingChunkWaiters: [],
  offscreenStopped: false,
  offscreenStopWaiters: []
};

async function loadState() {
  const stored = await chrome.storage.local.get([
    "qa_device_id",
    "qa_session_id",
    "qa_recording",
    "qa_status",
    "qa_chunk_index",
    "qa_api_base",
    "qa_auto_paused",
    "qa_debug",
    "qa_auth_token"
  ]);
  state.deviceId = stored.qa_device_id || null;
  state.sessionId = stored.qa_session_id || null;
  state.recording = stored.qa_recording || false;
  state.status = stored.qa_status || (state.recording ? "recording" : "idle");
  state.chunkIndex = stored.qa_chunk_index || 0;
  state.apiBase = stored.qa_api_base || DEFAULT_API_BASE;
  state.autoPaused = stored.qa_auto_paused || false;
  state.debug = stored.qa_debug || false;
  state.authToken = stored.qa_auth_token || null;
  state.chunkDurationMs = CHUNK_DURATION_MS;
  state.receivedChunks = 0;
}

async function persistState() {
  await chrome.storage.local.set({
    qa_device_id: state.deviceId,
    qa_session_id: state.sessionId,
    qa_recording: state.recording,
    qa_status: state.status,
    qa_chunk_index: state.chunkIndex,
    qa_api_base: state.apiBase,
    qa_auto_paused: state.autoPaused,
    qa_debug: state.debug,
    qa_auth_token: state.authToken
  });
}

function debugLog(message, detail) {
  if (!state.debug) return;
  console.log("[QA Assist]", message, detail || "");
  broadcastDebug({ message, detail });
}

function broadcastDebug(payload) {
  if (!state.debug) return;
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "QA_DEBUG_LOG", payload }, () => {
        // ignore errors for tabs without content scripts
      });
    });
  });
}

async function apiFetch(path, options = {}) {
  const url = `${state.apiBase.replace(/\/$/, "")}${path}`;
  const headers = options.headers || {};

  if (state.deviceId) {
    headers["x-device-id"] = state.deviceId;
  }
  if (state.authToken) {
    headers["Authorization"] = `Bearer ${state.authToken}`;
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
    state.offscreenReady = false;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record active tab video"
    });
  }
  await waitForOffscreenReady(2000);
}

async function startCapture(tabId) {
  state.offscreenStopped = false;
  await ensureOffscreen();
  const chunkDurationMs = state.chunkDurationMs || CHUNK_DURATION_MS;

  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      consumerTabId: tabId,
      targetTabId: tabId
    });

    chrome.runtime.sendMessage({
      type: "OFFSCREEN_START",
      streamId,
      sessionId: state.sessionId,
      chunkDurationMs,
      chunkStartIndex: state.chunkIndex,
      debug: state.debug
    });
  } catch (err) {
    console.warn("tabCapture failed, falling back to fake capture", err);
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_START_FAKE",
      sessionId: state.sessionId,
      chunkDurationMs,
      chunkStartIndex: state.chunkIndex,
      debug: state.debug
    });
  }
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

function clearTimers() {
  if (state.flushTimer) {
    clearInterval(state.flushTimer);
    state.flushTimer = null;
  }
  if (state.idleTimer) {
    clearInterval(state.idleTimer);
    state.idleTimer = null;
  }
}

function resolvePendingUploads() {
  if (state.pendingChunkUploads > 0) return;
  const waiters = state.pendingChunkWaiters.slice();
  state.pendingChunkWaiters = [];
  waiters.forEach((resolve) => resolve());
}

function waitForPendingUploads(timeoutMs) {
  if (state.pendingChunkUploads === 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    state.pendingChunkWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function markOffscreenStopped(sessionId) {
  state.offscreenStopped = true;
  const waiters = state.offscreenStopWaiters.slice();
  state.offscreenStopWaiters = [];
  waiters.forEach((resolve) => resolve());
  debugLog("offscreen stopped", { sessionId });
}

function waitForOffscreenStop(timeoutMs) {
  if (state.offscreenStopped) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    state.offscreenStopWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function flushEvents({ force = false } = {}) {
  if (!state.sessionId || state.eventQueue.length === 0) return;
  if (!force && !state.recording) return;
  const batch = state.eventQueue.splice(0, state.eventQueue.length);
  try {
    debugLog("flushing events", { count: batch.length });
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
  if (!state.recording) {
    debugLog("event dropped (not recording)", { type: event?.type });
    return;
  }
  state.eventQueue.push(event);
  scheduleFlush();
}

async function startRecording(apiBaseOverride, debugOverride, chunkDurationOverride) {
  await loadState();
  if (apiBaseOverride) state.apiBase = apiBaseOverride;
  if (typeof debugOverride === "boolean") state.debug = debugOverride;
  if (Number.isFinite(chunkDurationOverride)) state.chunkDurationMs = chunkDurationOverride;
  if (!state.authToken) {
    throw new Error("auth token missing");
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const env = await getTabEnvironment(tab.id);

  debugLog("start recording", { tabId: tab.id, url: tab.url });
  await ensureDevice();
  if (state.sessionId && state.status === "paused") {
    await resumeSession();
    const details = await apiFetch(`/sessions/${state.sessionId}`);
    state.chunkIndex = details?.chunks?.length || state.chunkIndex;
    await updateSessionEntry(state.sessionId, { status: "recording" });
  } else {
    await createSession(tab, env);
    await startSession();
    state.eventQueue = [];
  }

  state.recording = true;
  state.status = "recording";
  state.autoPaused = false;
  state.stopInProgress = false;
  state.receivedChunks = 0;
  state.currentTabId = tab.id;
  state.lastUrl = tab.url || null;
  state.lastActivity = Date.now();
  await persistState();

  await attachDebugger(tab.id);
  debugLog("debugger attached");
  await startCapture(tab.id);
  debugLog("capture started");

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
  debugLog("recording active", { sessionId: state.sessionId });
}

async function stopRecording() {
  await loadState();
  if (!state.sessionId) return;
  if (state.stopInProgress) return;
  state.stopInProgress = true;

  const sessionId = state.sessionId;
  const wasRecording = state.recording;
  try {
    debugLog("stopping recording", { sessionId });
    state.recording = false;
    state.status = "ended";
    state.autoPaused = false;
    await persistState();
    clearTimers();

    if (wasRecording && state.currentTabId) {
      await detachDebugger(state.currentTabId);
    }

    if (wasRecording) {
      await stopCapture();
      await waitForOffscreenStop(5000);
    }
    await flushEvents({ force: true });
    state.eventQueue = [];
    try {
      await chrome.storage.local.set({ qa_debug_before_synth: state.receivedChunks });
    } catch {
      // ignore
    }
    const uploadsDone = await waitForPendingUploads(15000);
    if (!uploadsDone) {
      debugLog("pending uploads timeout", { pending: state.pendingChunkUploads });
    }
    if (state.receivedChunks === 0) {
      await createSyntheticChunk(sessionId);
      await waitForPendingUploads(15000);
    }
    try {
      await stopSession();
    } finally {
      state.sessionId = null;
      await persistState();
      await updateSessionEntry(sessionId, { status: "ended", ended_at: new Date().toISOString() });
    }

    notifyStatus("Stopped");
    debugLog("recording stopped", { sessionId });
  } finally {
    state.stopInProgress = false;
  }
}

async function pauseRecording(autoPaused = false) {
  await loadState();
  if (!state.recording) return;

  debugLog("pausing recording", { sessionId: state.sessionId, autoPaused });
  state.recording = false;
  state.status = "paused";
  state.autoPaused = autoPaused;
  await persistState();
  clearTimers();

  if (state.currentTabId) {
    await detachDebugger(state.currentTabId);
  }

  await stopCapture();
  await flushEvents({ force: true });
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
  if (message.type === "OFFSCREEN_READY") {
    state.offscreenReady = true;
    state.offscreenReadyWaiters.forEach((resolve) => resolve());
    state.offscreenReadyWaiters = [];
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "OFFSCREEN_STOPPED") {
    markOffscreenStopped(message.sessionId);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "START") {
    startRecording(message.apiBase, message.debug, message.chunkDurationMs)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Start recording failed", err);
        debugLog("start failed", { error: err?.message || String(err) });
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true;
  }
  if (message.type === "STOP") {
    stopRecording()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Stop recording failed", err);
        debugLog("stop failed", { error: err?.message || String(err) });
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true;
  }
  if (message.type === "MARKER") {
    if (!state.recording) {
      sendResponse({ ok: false, error: "not recording" });
      return true;
    }
    addMarker()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  if (message.type === "ANNOTATE") {
    if (!state.recording) {
      sendResponse({ ok: false, error: "not recording" });
      return true;
    }
    openAnnotation()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  if (message.type === "INTERACTION") {
    state.lastActivity = Date.now();
    if (state.recording) {
      enqueueEvent(message.event);
    }
  }
  if (message.type === "ACTIVITY") {
    state.lastActivity = Date.now();
  }
  if (message.type === "CHUNK_DATA") {
    handleChunkData(message).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "ANNOTATION_SUBMIT") {
    if (state.recording) {
      enqueueEvent({
        ts: new Date().toISOString(),
        type: "annotation",
        payload: message.payload
      });
    }
  }
  if (message.type === "MARKER_SUBMIT") {
    if (state.recording) {
      enqueueEvent({
        ts: new Date().toISOString(),
        type: "marker",
        payload: message.payload
      });
    }
  }
  if (message.type === "QA_DEBUG_LOG") {
    if (!state.debug) return;
    const payload = message.payload || { message: "debug" };
    console.log("[QA Assist]", payload.message || "debug", payload.detail || "", payload.source || "");
    broadcastDebug(payload);
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
  state.pendingChunkUploads += 1;
  const sessionId = message.sessionId || state.sessionId;
  if (!sessionId) {
    debugLog("chunk dropped (missing sessionId)");
    state.pendingChunkUploads = Math.max(0, state.pendingChunkUploads - 1);
    resolvePendingUploads();
    return;
  }

  try {
    state.receivedChunks += 1;
    try {
      await chrome.storage.local.set({ qa_debug_received_chunks: state.receivedChunks });
    } catch {
      // ignore storage failures
    }
    const chunkResponse = await apiFetch(`/sessions/${sessionId}/chunks`, {
      method: "POST",
      body: JSON.stringify({
        idx: message.chunkIndex,
        start_ts: new Date(message.startTs).toISOString(),
        end_ts: new Date(message.endTs).toISOString(),
        content_type: message.mimeType
      })
    });
    debugLog("chunk created", { index: message.chunkIndex, id: chunkResponse.chunk?.id });

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
      debugLog("chunk marked ready", { id: chunkResponse.chunk.id, bytes: blob.size });
    }
  } catch (err) {
    console.warn("chunk handling failed", err);
    throw err;
  } finally {
    state.pendingChunkUploads = Math.max(0, state.pendingChunkUploads - 1);
    resolvePendingUploads();
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

async function waitForOffscreenReady(timeoutMs) {
  if (state.offscreenReady) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    state.offscreenReadyWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function createSyntheticChunk(sessionId) {
  try {
    debugLog("creating synthetic chunk");
    await chrome.storage.local.set({ qa_debug_synthetic: "start" });
    const buffer = new Uint8Array([81, 65, 65, 83, 83, 73, 83, 84]).buffer;
    const now = Date.now();
    await handleChunkData({
      sessionId,
      chunkIndex: state.chunkIndex,
      startTs: now - 1000,
      endTs: now,
      mimeType: "video/webm",
      data: buffer
    });
    await chrome.storage.local.set({ qa_debug_synthetic: "done" });
  } catch (err) {
    console.warn("Failed to create synthetic chunk", err);
    try {
      await chrome.storage.local.set({ qa_debug_synthetic: `error:${err?.message || err}` });
    } catch {
      // ignore
    }
  }
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
  const authHeaders = {};
  if (state.deviceId) authHeaders["x-device-id"] = state.deviceId;
  if (state.authToken) authHeaders["Authorization"] = `Bearer ${state.authToken}`;
  const shouldAuth = shouldAttachAuth(uploadUrl);

  if (uploadMethod.toUpperCase() === "PUT") {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: shouldAuth ? { ...uploadHeaders, ...authHeaders } : uploadHeaders,
      body: blob
    });
    return;
  }

  const formData = new FormData();
  formData.append("file", blob, `chunk-${Date.now()}.webm`);
  await fetch(uploadUrl, {
    method: uploadMethod,
    headers: shouldAuth ? authHeaders : undefined,
    body: formData
  });
}

function shouldAttachAuth(uploadUrl) {
  try {
    const upload = new URL(uploadUrl);
    const api = new URL(state.apiBase);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    const hostMatch =
      upload.hostname === api.hostname ||
      (localHosts.has(upload.hostname) && localHosts.has(api.hostname));
    const portMatch = upload.port === api.port;
    return hostMatch && portMatch;
  } catch {
    const apiOrigin = state.apiBase.replace(/\/api\/?$/, "");
    return uploadUrl.startsWith(apiOrigin);
  }
}
