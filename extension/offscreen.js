const RECORDING_TIMESLICE_MS = 1000;
const DEFAULT_API_BASE = "http://localhost:4000/api";

let isRecording = false;
let mediaRecorder = null;
let streamRef = null;
let fakeCanvas = null;
let fakeCtx = null;
let fakeTimer = null;

let debugEnabled = false;
let apiBase = DEFAULT_API_BASE;
let authToken = null;

let currentSessionId = null;
let currentCaptureToken = null;
let currentChunkIndex = 0;
let firstChunkReported = false;

let recordingStartTs = null;
let recordedParts = [];
let recordingMimeType = "video/webm";

let stopRequested = false;
let uploadInFlight = false;
let pendingUpload = null;

chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

function resetRecordingState({ sessionId, captureToken, chunkStartIndex, debug }) {
  debugEnabled = !!debug;
  currentSessionId = sessionId || null;
  currentCaptureToken = captureToken ?? null;
  currentChunkIndex = Number.isFinite(chunkStartIndex) ? chunkStartIndex : 0;
  firstChunkReported = false;
  stopRequested = false;
  uploadInFlight = false;
  pendingUpload = null;
  recordingStartTs = Date.now();
  recordedParts = [];
}

async function startRecording({
  streamId,
  debug,
  sessionId,
  captureToken,
  captureSource,
  chunkStartIndex
}) {
  if (isRecording) return;
  resetRecordingState({ sessionId, captureToken, chunkStartIndex, debug });

  const mediaSource = captureSource || "tab";
  streamRef = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: mediaSource,
        chromeMediaSourceId: streamId
      }
    }
  });

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  recordingMimeType = mimeType;
  isRecording = true;
  logDebug("offscreen recording started");
  startRecorder(mimeType, false);
}

async function startFixtureRecording({ debug, sessionId, captureToken, chunkStartIndex }) {
  if (isRecording) return;
  resetRecordingState({ sessionId, captureToken, chunkStartIndex, debug });

  fakeCanvas = document.createElement("canvas");
  fakeCanvas.width = 1280;
  fakeCanvas.height = 720;
  fakeCtx = fakeCanvas.getContext("2d");

  const stream = fakeCanvas.captureStream(10);
  streamRef = stream;

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  recordingMimeType = mimeType;
  isRecording = true;
  logDebug("fake recording started");

  fakeTimer = setInterval(() => {
    if (!fakeCtx) return;
    fakeCtx.fillStyle = "#0f172a";
    fakeCtx.fillRect(0, 0, fakeCanvas.width, fakeCanvas.height);
    fakeCtx.fillStyle = "#f8fafc";
    fakeCtx.font = "32px sans-serif";
    fakeCtx.fillText("QA Assist Fixture", 40, 80);
    fakeCtx.font = "20px sans-serif";
    fakeCtx.fillText(new Date().toISOString(), 40, 130);
  }, 200);

  startRecorder(mimeType, true);
}

function startRecorder(mimeType, fake) {
  if (!streamRef) return;

  mediaRecorder = new MediaRecorder(streamRef, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (!event.data || event.data.size === 0) {
      logDebug("chunk empty", { size: event.data?.size || 0, fake });
      return;
    }
    recordedParts.push(event.data);
    if (!firstChunkReported) {
      firstChunkReported = true;
      chrome.runtime.sendMessage({
        type: "OFFSCREEN_FIRST_CHUNK",
        captureToken: currentCaptureToken,
        ts: new Date(recordingStartTs || Date.now()).toISOString()
      });
    }
  };

  mediaRecorder.onerror = (event) => {
    logDebug("media recorder error", {
      error: event?.error?.message || String(event?.error || "unknown"),
      fake
    });
  };

  mediaRecorder.onstop = () => {
    finalizeStop(fake);
  };

  mediaRecorder.start(RECORDING_TIMESLICE_MS);
}

function stopRecording() {
  stopRequested = true;

  if (!isRecording) {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: currentSessionId });
    maybeNotifyUploadsDone();
    return;
  }

  isRecording = false;
  logDebug("offscreen recording stopped");

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  } else {
    finalizeStop(false);
  }

  cleanupFixture();
}

function finalizeStop(fake) {
  isRecording = false;
  const stoppedSessionId = currentSessionId;
  const endTs = Date.now();
  const startTs = recordingStartTs || endTs;
  const blob = new Blob(recordedParts, { type: recordingMimeType || "video/webm" });
  recordedParts = [];

  chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: stoppedSessionId });
  cleanupStream();
  if (fake) {
    cleanupFixture();
  }

  if (blob.size === 0) {
    logDebug("final blob empty", { sessionId: stoppedSessionId });
    maybeNotifyUploadsDone();
    return;
  }

  queueUpload({
    sessionId: stoppedSessionId,
    chunkIndex: currentChunkIndex,
    startTs,
    endTs,
    mimeType: blob.type || "video/webm",
    blob,
    fake: !!fake
  });
}

function cleanupStream() {
  if (streamRef) {
    streamRef.getTracks().forEach((track) => track.stop());
    streamRef = null;
  }
  mediaRecorder = null;
  currentCaptureToken = null;
}

function cleanupFixture() {
  if (fakeTimer) {
    clearInterval(fakeTimer);
    fakeTimer = null;
  }
  fakeCtx = null;
  fakeCanvas = null;
}

function logDebug(message, detail) {
  if (!debugEnabled) return;
  chrome.runtime.sendMessage({
    type: "QA_DEBUG_LOG",
    payload: { message, detail, source: "offscreen" }
  });
}

function maybeNotifyUploadsDone() {
  if (!stopRequested) return;
  if (uploadInFlight) return;
  if (pendingUpload) return;
  chrome.runtime.sendMessage({ type: "OFFSCREEN_UPLOADS_DONE" });
  currentSessionId = null;
}

function queueUpload(payload) {
  if (!payload.sessionId) {
    pendingUpload = payload;
    return;
  }
  uploadRecording(payload).catch(() => {});
}

function tryUploadPending() {
  if (!pendingUpload || uploadInFlight || !currentSessionId) return;
  const payload = { ...pendingUpload, sessionId: currentSessionId };
  pendingUpload = null;
  uploadRecording(payload).catch(() => {});
}

function getApiBase() {
  return (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
}

async function apiFetch(path, options = {}) {
  const url = `${getApiBase()}${path}`;
  const headers = options.headers || {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }
  return response.json();
}

function shouldAttachAuth(uploadUrl) {
  try {
    const upload = new URL(uploadUrl);
    const api = new URL(getApiBase());
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    const hostMatch =
      upload.hostname === api.hostname ||
      (localHosts.has(upload.hostname) && localHosts.has(api.hostname));
    const portMatch = upload.port === api.port;
    return hostMatch && portMatch;
  } catch {
    const apiOrigin = getApiBase().replace(/\/api\/?$/, "");
    return uploadUrl.startsWith(apiOrigin);
  }
}

async function directUpload(uploadUrl, uploadMethod, uploadHeaders, blob) {
  const authHeaders = {};
  if (authToken) authHeaders["Authorization"] = `Bearer ${authToken}`;
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

async function uploadRecording({ sessionId, chunkIndex, startTs, endTs, mimeType, blob, fake }) {
  uploadInFlight = true;
  let chunkResponse = null;
  try {
    if (!authToken) {
      throw new Error("auth token missing");
    }
    chunkResponse = await apiFetch(`/sessions/${sessionId}/chunks`, {
      method: "POST",
      body: JSON.stringify({
        idx: chunkIndex,
        start_ts: new Date(startTs).toISOString(),
        end_ts: new Date(endTs).toISOString(),
        content_type: mimeType
      })
    });

    const uploadUrl = chunkResponse.upload_url;
    const uploadMethod = chunkResponse.upload_method || "POST";
    const uploadHeaders = chunkResponse.upload_headers || {};
    const resumable = chunkResponse.resumable;
    const storage = chunkResponse.storage;
    const gcsUri = chunkResponse.gcs_uri;
    const chunkId = chunkResponse.chunk?.id;

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
            "Content-Type": blob.type || "video/webm",
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

    if (storage === "gcs" && gcsUri && chunkId) {
      await apiFetch(`/chunks/${chunkId}`, {
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

    chrome.runtime.sendMessage({
      type: "CHUNK_UPLOADED",
      sessionId,
      chunkId,
      chunkIndex,
      byteSize: blob.size,
      fake: !!fake
    });
  } catch (err) {
    logDebug("upload failed", { error: err?.message || String(err) });
    chrome.runtime.sendMessage({
      type: "CHUNK_FAILED",
      sessionId,
      chunkIndex,
      error: err?.message || String(err)
    });
  } finally {
    uploadInFlight = false;
    maybeNotifyUploadsDone();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_PING") {
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "OFFSCREEN_START") {
    apiBase = message.apiBase || apiBase;
    authToken = message.authToken || authToken;
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_START_FIXTURE") {
    apiBase = message.apiBase || apiBase;
    authToken = message.authToken || authToken;
    startFixtureRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_SET_SESSION") {
    const nextSessionId = message.sessionId || null;
    if (nextSessionId) {
      currentSessionId = nextSessionId;
    }
    if (Number.isFinite(message.chunkStartIndex)) {
      currentChunkIndex = message.chunkStartIndex;
    }
    tryUploadPending();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "OFFSCREEN_STOP") {
    stopRecording();
    sendResponse({ ok: true });
  }
});
