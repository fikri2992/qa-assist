const DEFAULT_API_BASE = "http://localhost:4000/api";
const CHUNK_DURATION_MS = 5 * 1000;
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
  localEvents: [],
  sessionMeta: null,
  stopInProgress: false,
  pendingChunkUploads: 0,
  pendingChunkWaiters: [],
  offscreenStopped: false,
  offscreenStopWaiters: [],
  offscreenUploadsDone: false,
  offscreenUploadWaiters: [],
  currentTabInfo: null,
  captureMode: null
};

let flushInFlight = false;

let stateReady = null;

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
    "qa_auth_token",
    "qa_capture_mode"
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
  state.captureMode = stored.qa_capture_mode || null;
  state.chunkDurationMs = CHUNK_DURATION_MS;
}

function ensureStateReady() {
  if (!stateReady) {
    stateReady = loadState();
  }
  return stateReady;
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
    qa_auth_token: state.authToken,
    qa_capture_mode: state.captureMode
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

  return response.session;
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
    await chrome.debugger.sendCommand({ tabId }, "Console.enable");
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
    return { ok: true };
  } catch (err) {
    const message = err?.message || String(err);
    console.warn("Debugger attach failed", message);
    return { ok: false, error: message };
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
  if (exists) {
    try {
      const response = await sendRuntimeMessage({ type: "OFFSCREEN_PING" }, 1000);
      if (response?.ok) {
        state.offscreenReady = true;
        return;
      }
    } catch {
      // Will recreate below.
    }
    if (chrome.offscreen?.closeDocument) {
      try {
        await chrome.offscreen.closeDocument();
      } catch {
        // ignore
      }
    }
  }

  state.offscreenReady = false;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Record active tab video"
  });

  const ready = await waitForOffscreenReady(2000);
  if (!ready) {
    throw new Error("Offscreen document did not become ready.");
  }
}

function sendRuntimeMessage(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Offscreen message timed out")), timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message || "Offscreen message failed"));
      } else {
        resolve(response);
      }
    });
  });
}

async function startCapture(tabId, streamIdOverride, sessionIdOverride, chunkStartIndexOverride) {
  state.offscreenStopped = false;
  await ensureOffscreen();
  const chunkDurationMs = state.chunkDurationMs || CHUNK_DURATION_MS;

  try {
    const streamId =
      streamIdOverride ||
      (await chrome.tabCapture.getMediaStreamId({
        consumerTabId: tabId,
        targetTabId: tabId
      }));
    const sessionId =
      sessionIdOverride !== undefined ? sessionIdOverride : state.sessionId;
    const chunkStartIndex = Number.isFinite(chunkStartIndexOverride)
      ? chunkStartIndexOverride
      : state.chunkIndex;

    const response = await sendRuntimeMessage({
      type: "OFFSCREEN_START",
      streamId,
      sessionId,
      chunkDurationMs,
      chunkStartIndex,
      debug: state.debug,
      apiBase: state.apiBase,
      authToken: state.authToken
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Offscreen failed to start recording");
    }
    state.captureMode = "real";
    await persistState();
  } catch (err) {
    console.warn("tabCapture failed, falling back to fake capture", err);
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "marker",
      payload: {
        message: `Video capture failed; using synthetic video. ${err?.message || String(err)}`
      }
    });
    state.captureMode = "fake";
    await persistState();
    const response = await sendRuntimeMessage({
      type: "OFFSCREEN_START_FAKE",
      sessionId: state.sessionId,
      chunkDurationMs,
      chunkStartIndex: state.chunkIndex,
      debug: state.debug,
      apiBase: state.apiBase,
      authToken: state.authToken
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Offscreen failed to start synthetic recording");
    }
  }
}

async function stopCapture() {
  try {
    await sendRuntimeMessage({ type: "OFFSCREEN_STOP" }, 3000);
  } catch (err) {
    debugLog("offscreen stop message failed", { error: err?.message || String(err) });
  }
}

function scheduleFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setInterval(flushEvents, 3000);
}

function scheduleIdleCheck() {
  // Auto-pause disabled: keep recording even when idle.
  return;
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

function markOffscreenUploadsDone() {
  state.offscreenUploadsDone = true;
  const waiters = state.offscreenUploadWaiters.slice();
  state.offscreenUploadWaiters = [];
  waiters.forEach((resolve) => resolve());
  debugLog("offscreen uploads done");
}

function waitForOffscreenUploads(timeoutMs) {
  if (state.offscreenUploadsDone) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    state.offscreenUploadWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function flushEvents({ force = false } = {}) {
  if (flushInFlight) return;
  if (!state.sessionId || state.eventQueue.length === 0) return;
  if (!force && !state.recording) return;
  const batch = state.eventQueue.splice(0, state.eventQueue.length);
  let succeeded = false;
  flushInFlight = true;
  try {
    debugLog("flushing events", { count: batch.length });
    await apiFetch(`/sessions/${state.sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events: batch })
    });
    succeeded = true;
  } catch (err) {
    console.warn("Failed to flush events", err);
    state.eventQueue.unshift(...batch);
  } finally {
    flushInFlight = false;
    if (succeeded && state.eventQueue.length > 0 && (force || state.recording)) {
      flushEvents({ force }).catch(() => {});
    }
  }
}

async function flushEventsWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await flushEvents({ force: true });
    if (state.eventQueue.length === 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return state.eventQueue.length === 0;
}

async function loadPendingEvents() {
  const stored = await chrome.storage.local.get(["qa_pending_events"]);
  return stored.qa_pending_events || {};
}

async function savePendingEvents(pending) {
  await chrome.storage.local.set({ qa_pending_events: pending });
}

async function persistPendingEvents(sessionId, events) {
  if (!sessionId || !events?.length) return;
  const pending = await loadPendingEvents();
  pending[sessionId] = events;
  await savePendingEvents(pending);
}

async function flushPendingEvents() {
  const pending = await loadPendingEvents();
  const sessionIds = Object.keys(pending);
  if (sessionIds.length === 0) return;
  for (const sessionId of sessionIds) {
    const events = pending[sessionId];
    if (!events?.length) {
      delete pending[sessionId];
      continue;
    }
    try {
      await apiFetch(`/sessions/${sessionId}/events`, {
        method: "POST",
        body: JSON.stringify({ events })
      });
      delete pending[sessionId];
    } catch (err) {
      debugLog("pending events flush failed", { sessionId, error: err?.message || String(err) });
    }
  }
  await savePendingEvents(pending);
}

function enqueueEvent(event) {
  if (!state.recording) {
    debugLog("event dropped (not recording)", { type: event?.type });
    return;
  }
  const normalized = normalizeEvent(event);
  state.localEvents.push(normalized);
  state.eventQueue.push(normalized);
  flushEvents().catch(() => {});
  scheduleFlush();
}

function normalizeEvent(event) {
  const ts = event?.ts || new Date().toISOString();
  const payload = { ...(event?.payload || {}) };
  const tabInfo = payload.tab || state.currentTabInfo;
  if (tabInfo) {
    payload.tab = tabInfo;
  }
  if (payload.frameId === undefined && state.currentTabInfo?.frameId !== undefined) {
    payload.frameId = state.currentTabInfo.frameId;
  }
  if (!payload.ts_ms) {
    payload.ts_ms = new Date(ts).getTime();
  }
  return {
    ...event,
    ts,
    payload
  };
}

function buildTabInfo(tab, frameId) {
  if (!tab) return null;
  const info = {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    windowId: tab.windowId
  };
  if (frameId !== undefined) {
    info.frameId = frameId;
  }
  return info;
}

async function startRecording(apiBaseOverride, debugOverride, chunkDurationOverride, captureInfo = {}) {
  stateReady = loadState();
  await stateReady;
  if (apiBaseOverride) state.apiBase = apiBaseOverride;
  if (typeof debugOverride === "boolean") state.debug = debugOverride;
  if (Number.isFinite(chunkDurationOverride)) state.chunkDurationMs = chunkDurationOverride;
  if (!state.authToken) {
    throw new Error("auth token missing");
  }

  let tab = null;
  if (captureInfo?.tabId) {
    try {
      tab = await chrome.tabs.get(captureInfo.tabId);
    } catch {
      tab = null;
    }
  }
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab || null;
  }
  if (!tab) {
    throw new Error("No active tab found.");
  }

  const isResuming = state.sessionId && state.status === "paused";
  let earlyCaptureStarted = false;
  if (!isResuming) {
    try {
      await startCapture(tab.id, captureInfo?.streamId, null, 0);
      earlyCaptureStarted = true;
    } catch (err) {
      state.recording = false;
      state.status = "idle";
      await persistState();
      recordState("start_failed", err?.message || "capture failed");
      throw err;
    }
  }

  const env = await getTabEnvironment(tab.id);
  if (!env) {
    if (earlyCaptureStarted) {
      await stopCapture();
    }
    throw new Error("Content script not available. Reload the page and try again.");
  }

  debugLog("start recording", { tabId: tab.id, url: tab.url });
  await ensureDevice();
  await flushPendingEvents();

  const attached = await attachDebugger(tab.id);
  if (!attached.ok) {
    state.recording = false;
    state.status = "idle";
    await persistState();
    notifyStatus("Stopped");
    const detail = attached.error || "debugger_attach_failed";
    recordState("start_failed", detail);
    if (earlyCaptureStarted) {
      await stopCapture();
    }
    throw new Error(`Unable to attach debugger: ${detail}`);
  }
  debugLog("debugger attached");

  if (isResuming) {
    await resumeSession();
    const details = await apiFetch(`/sessions/${state.sessionId}`);
    state.chunkIndex = details?.chunks?.length || state.chunkIndex;
    state.sessionMeta = {
      id: details?.id || state.sessionId,
      started_at: details?.started_at || new Date().toISOString(),
      url: details?.metadata?.url || tab.url,
      title: details?.metadata?.title || tab.title,
      metadata: details?.metadata || {}
    };
    await updateSessionEntry(state.sessionId, { status: "recording" });
  } else {
    const session = await createSession(tab, env);
    await startSession();
    state.sessionMeta = {
      id: session.id,
      started_at: session.started_at,
      url: tab.url,
      title: tab.title,
      metadata: session.metadata || {}
    };
    state.eventQueue = [];
    state.localEvents = [];
  }

  if (!isResuming && earlyCaptureStarted) {
    try {
      await sendRuntimeMessage({
        type: "OFFSCREEN_SET_SESSION",
        sessionId: state.sessionId
      });
    } catch (err) {
      await stopCapture();
      recordState("start_failed", err?.message || "session attach failed");
      throw err;
    }
  }

  state.recording = true;
  state.status = "recording";
  state.autoPaused = false;
  state.stopInProgress = false;
  state.receivedChunks = 0;
  state.offscreenUploadsDone = false;
  state.currentTabId = tab.id;
  state.currentTabInfo = buildTabInfo(tab);
  state.lastUrl = tab.url || null;
  state.lastActivity = Date.now();
  await persistState();
  try {
    await chrome.storage.local.set({ qa_last_error: "" });
  } catch {
    // ignore storage errors
  }
  recordState("recording", "started");

  try {
    if (isResuming) {
      await startCapture(tab.id, captureInfo?.streamId, state.sessionId, state.chunkIndex);
    } else if (!earlyCaptureStarted) {
      await startCapture(tab.id, captureInfo?.streamId, state.sessionId, state.chunkIndex);
    }
  } catch (err) {
    state.recording = false;
    state.status = "idle";
    await persistState();
    recordState("start_failed", err?.message || "capture failed");
    throw err;
  }

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
  stateReady = loadState();
  await stateReady;
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
    recordState("stopped", "user_stop");
    clearTimers();

    if (wasRecording && state.currentTabId) {
      await detachDebugger(state.currentTabId);
    }

    await stopCapture();
    const stopped = await waitForOffscreenStop(5000);
    const uploadsDone = await waitForOffscreenUploads(15000);
    if (!stopped) {
      debugLog("offscreen stop timed out");
    }
    if (!uploadsDone) {
      debugLog("offscreen uploads timed out");
    }

    const flushed = await flushEventsWithRetry(3);
    if (!flushed && state.eventQueue.length > 0) {
      await persistPendingEvents(sessionId, state.eventQueue.slice());
      notifyError("Failed to upload all events. Will retry next time.");
    }
    try {
      await chrome.storage.local.set({ qa_debug_before_synth: state.receivedChunks });
    } catch {
      // ignore
    }
    await uploadSessionJson(sessionId);
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

async function uploadSessionJson(sessionId) {
  if (!sessionId) return;
  try {
    await apiFetch(`/sessions/${sessionId}/session-json/rebuild`, {
      method: "POST"
    });
  } catch (err) {
    debugLog("session json upload failed", { error: err?.message || String(err) });
    notifyError(`Failed to upload session file: ${err?.message || String(err)}`);
  } finally {
    state.localEvents = [];
    state.sessionMeta = null;
  }
}

async function pauseRecording(autoPaused = false) {
  stateReady = loadState();
  await stateReady;
  if (!state.recording) return;

  debugLog("pausing recording", { sessionId: state.sessionId, autoPaused });
  state.recording = false;
  state.status = "paused";
  state.autoPaused = autoPaused;
  await persistState();
  recordState("paused", autoPaused ? "auto_pause" : "paused");
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

function notifyError(message) {
  chrome.runtime.sendMessage({ type: "ERROR", message });
  try {
    chrome.storage.local.set({ qa_last_error: message || "Recording error." });
  } catch {
    // ignore storage errors
  }
}

function recordState(stateLabel, reason) {
  try {
    chrome.storage.local.set({
      qa_last_state: stateLabel || "",
      qa_last_state_reason: reason || "",
      qa_last_state_ts: new Date().toISOString()
    });
  } catch {
    // ignore storage errors
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INTERACTION") {
    ensureStateReady().then(() => {
      state.lastActivity = Date.now();
      if (state.recording) {
        const tabInfo = buildTabInfo(sender?.tab, sender?.frameId);
        if (message.event?.payload) {
          message.event.payload = { ...message.event.payload, tab: tabInfo || message.event.payload.tab };
          if (sender?.frameId !== undefined) {
            message.event.payload.frameId = sender.frameId;
          }
        }
        enqueueEvent(message.event);
      }
    });
    return;
  }
  if (message.type === "ACTIVITY") {
    ensureStateReady().then(() => {
      state.lastActivity = Date.now();
    });
    return;
  }
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
  if (message.type === "OFFSCREEN_UPLOADS_DONE") {
    markOffscreenUploadsDone();
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "START") {
    startRecording(message.apiBase, message.debug, message.chunkDurationMs, {
      streamId: message.streamId,
      tabId: message.captureTabId
    })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Start recording failed", err);
        debugLog("start failed", { error: err?.message || String(err) });
        recordState("start_failed", err?.message || "start failed");
        notifyError(err?.message || "Failed to start recording.");
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
  if (message.type === "CHUNK_DATA") {
    ensureStateReady()
      .then(() => handleChunkData(message))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn("chunk handling failed", err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true;
  }
  if (message.type === "CHUNK_UPLOADED") {
    ensureStateReady().then(() => {
      state.receivedChunks += 1;
      if (Number.isFinite(message.chunkIndex)) {
        state.chunkIndex = Math.max(state.chunkIndex, message.chunkIndex + 1);
      }
      persistState().catch(() => {});
      debugLog("chunk uploaded", {
        index: message.chunkIndex,
        bytes: message.byteSize,
        fake: message.fake
      });
    });
  }
  if (message.type === "CHUNK_FAILED") {
    debugLog("chunk upload failed", { index: message.chunkIndex, error: message.error });
  }
  if (message.type === "ANNOTATION_SUBMIT") {
    if (state.recording) {
      const tabInfo = buildTabInfo(sender?.tab, sender?.frameId);
      enqueueEvent({
        ts: new Date().toISOString(),
        type: "annotation",
        payload: { ...message.payload, tab: tabInfo || message.payload?.tab }
      });
    }
  }
  if (message.type === "MARKER_SUBMIT") {
    if (state.recording) {
      const tabInfo = buildTabInfo(sender?.tab, sender?.frameId);
      enqueueEvent({
        ts: new Date().toISOString(),
        type: "marker",
        payload: { ...message.payload, tab: tabInfo || message.payload?.tab }
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
  const tabMeta = state.currentTabInfo || { id: source.tabId, url: state.lastUrl };

  if (method === "Log.entryAdded") {
    const entry = params.entry || {};
    enqueueEvent({
      ts: new Date(entry.timestamp || Date.now()).toISOString(),
      type: "console",
      payload: { message: entry.text, level: entry.level, tab: tabMeta }
    });
  }

  if (method === "Console.messageAdded") {
    const msg = params.message || {};
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "console",
      payload: {
        message: msg.text,
        level: msg.level,
        source: msg.source,
        url: msg.url,
        line: msg.line,
        tab: tabMeta
      }
    });
  }

  if (method === "Runtime.consoleAPICalled") {
    const args = params.args || [];
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "console",
      payload: {
        message: args.map((arg) => arg.value || arg.description || arg.type).join(" "),
        level: params.type,
        stackTrace: params.stackTrace,
        tab: tabMeta
      }
    });
  }

  if (method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails || {};
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "console",
      payload: {
        message: details.text || "exception",
        level: "error",
        url: details.url,
        line: details.lineNumber,
        column: details.columnNumber,
        exception: details.exception?.description,
        stackTrace: details.stackTrace,
        tab: tabMeta
      }
    });
  }

  if (method === "Network.responseReceived") {
    const response = params.response || {};
    enqueueEvent({
      ts: new Date(response.responseTime || Date.now()).toISOString(),
      type: "network",
      payload: {
        url: response.url,
        requestId: params.requestId,
        status: response.status,
        statusText: response.statusText,
        mimeType: response.mimeType,
        headers: response.headers,
        fromDiskCache: response.fromDiskCache,
        tab: tabMeta
      }
    });
  }

  if (method === "Network.requestWillBeSent") {
    const request = params.request || {};
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "network",
      payload: {
        requestId: params.requestId,
        url: request.url,
        method: request.method,
        type: "request",
        headers: request.headers,
        postData: request.postData,
        initiator: params.initiator?.type,
        tab: tabMeta
      }
    });
  }

  if (method === "Network.loadingFailed") {
    enqueueEvent({
      ts: new Date().toISOString(),
      type: "network",
      payload: {
        requestId: params.requestId,
        url: params.request?.url,
        error: params.errorText,
        canceled: params.canceled,
        type: "failed",
        tab: tabMeta
      }
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Auto-pause disabled: keep recording across tab switches.
  return;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!state.currentTabId || tabId !== state.currentTabId) return;
  if (changeInfo.url || changeInfo.title) {
    state.currentTabInfo = buildTabInfo(tab);
    state.lastUrl = tab.url || state.lastUrl;
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

    const chunkBuffer = await normalizeChunkData(message.data);
    if (!chunkBuffer) {
      debugLog("chunk payload invalid", { dataType: typeof message.data, keys: Object.keys(message.data || {}) });
      throw new Error("invalid chunk payload");
    }
    const blob = new Blob([chunkBuffer], { type: message.mimeType || "video/webm" });

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

stateReady = loadState();

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
    if (response?.env) return response.env;
  } catch {
    // will attempt injection
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (err) {
    debugLog("content script injection failed", { error: err?.message || String(err) });
    return null;
  }
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

async function normalizeChunkData(data) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return await data.arrayBuffer();
  if (ArrayBuffer.isView(data)) return data.buffer;
  if (Array.isArray(data)) return new Uint8Array(data).buffer;
  if (data?.data && Array.isArray(data.data)) return new Uint8Array(data.data).buffer;
  return null;
}
