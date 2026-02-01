let isRecording = false;
let mediaRecorder = null;
let streamRef = null;
let chunkIndex = 0;
let currentChunkStart = null;
let fakeCanvas = null;
let fakeCtx = null;
let fakeTimer = null;
let debugEnabled = false;
let currentSessionId = null;
let apiBase = "http://localhost:4000/api";
let authToken = null;
let pendingUploads = 0;
let stopRequested = false;

chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

async function startRecording({ streamId, chunkDurationMs, chunkStartIndex, debug, sessionId }) {
  if (isRecording) return;
  debugEnabled = !!debug;
  currentSessionId = sessionId || null;
  pendingUploads = 0;
  stopRequested = false;

  streamRef = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  mediaRecorder = new MediaRecorder(streamRef, { mimeType });
  isRecording = true;
  chunkIndex = Number.isFinite(chunkStartIndex) ? chunkStartIndex : 0;
  currentChunkStart = Date.now();
  logDebug("offscreen recording started");
  const stoppedSessionId = currentSessionId;
  mediaRecorder.onstop = () => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: stoppedSessionId });
  };

  mediaRecorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0) {
      logDebug("chunk empty", { size: event.data?.size || 0 });
      return;
    }
    const startTs = currentChunkStart;
    const endTs = Date.now();
    currentChunkStart = endTs;

    const blob = event.data;
    await uploadChunk({
      sessionId: currentSessionId,
      chunkIndex,
      startTs,
      endTs,
      mimeType: blob.type,
      blob
    });
    logDebug("chunk captured", { index: chunkIndex, bytes: blob.size });

    chunkIndex += 1;
  };

  mediaRecorder.start(chunkDurationMs);
}

async function startFakeRecording({ chunkDurationMs, chunkStartIndex, debug, sessionId }) {
  if (isRecording) return;
  debugEnabled = !!debug;
  currentSessionId = sessionId || null;
  pendingUploads = 0;
  stopRequested = false;

  fakeCanvas = document.createElement("canvas");
  fakeCanvas.width = 1280;
  fakeCanvas.height = 720;
  fakeCtx = fakeCanvas.getContext("2d");

  const stream = fakeCanvas.captureStream(10);
  streamRef = stream;

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  mediaRecorder = new MediaRecorder(streamRef, { mimeType });
  isRecording = true;
  chunkIndex = Number.isFinite(chunkStartIndex) ? chunkStartIndex : 0;
  currentChunkStart = Date.now();
  logDebug("fake recording started");
  const stoppedSessionId = currentSessionId;
  mediaRecorder.onstop = () => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: stoppedSessionId });
  };

  fakeTimer = setInterval(() => {
    if (!fakeCtx) return;
    fakeCtx.fillStyle = "#0f172a";
    fakeCtx.fillRect(0, 0, fakeCanvas.width, fakeCanvas.height);
    fakeCtx.fillStyle = "#f8fafc";
    fakeCtx.font = "32px sans-serif";
    fakeCtx.fillText("QA Assist E2E", 40, 80);
    fakeCtx.font = "20px sans-serif";
    fakeCtx.fillText(new Date().toISOString(), 40, 130);
  }, 200);

  mediaRecorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0) {
      logDebug("chunk empty", { size: event.data?.size || 0, fake: true });
      return;
    }
    const startTs = currentChunkStart;
    const endTs = Date.now();
    currentChunkStart = endTs;

    const blob = event.data;
    await uploadChunk({
      sessionId: currentSessionId,
      chunkIndex,
      startTs,
      endTs,
      mimeType: blob.type,
      blob,
      fake: true
    });
    logDebug("chunk captured", { index: chunkIndex, bytes: blob.size, fake: true });

    chunkIndex += 1;
  };

  mediaRecorder.start(chunkDurationMs);
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  stopRequested = true;
  logDebug("offscreen recording stopped");
  const stoppedSessionId = currentSessionId;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = () => {
      chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: stoppedSessionId });
    };
    mediaRecorder.stop();
  } else {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOPPED", sessionId: stoppedSessionId });
  }

  if (fakeTimer) {
    clearInterval(fakeTimer);
    fakeTimer = null;
  }
  fakeCtx = null;
  fakeCanvas = null;

  if (streamRef) {
    streamRef.getTracks().forEach((track) => track.stop());
    streamRef = null;
  }

  mediaRecorder = null;

  maybeNotifyUploadsDone();
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
  if (pendingUploads > 0) return;
  chrome.runtime.sendMessage({ type: "OFFSCREEN_UPLOADS_DONE" });
  currentSessionId = null;
}

function getApiBase() {
  return (apiBase || "http://localhost:4000/api").replace(/\/$/, "");
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

async function uploadChunk({ sessionId, chunkIndex, startTs, endTs, mimeType, blob, fake }) {
  if (!sessionId) return;
  pendingUploads += 1;
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
    logDebug("chunk upload failed", { index: chunkIndex, error: err?.message || String(err) });
    const canFallback = !chunkResponse;
    if (canFallback) {
      try {
        const buffer = await blob.arrayBuffer();
        await sendChunkToBackground({
          sessionId,
          chunkIndex,
          startTs,
          endTs,
          mimeType,
          data: buffer,
          fake: !!fake
        });
        return;
      } catch (fallbackError) {
        logDebug("chunk fallback failed", {
          index: chunkIndex,
          error: fallbackError?.message || String(fallbackError)
        });
        chrome.runtime.sendMessage({
          type: "CHUNK_FAILED",
          sessionId,
          chunkIndex,
          error: fallbackError?.message || String(fallbackError)
        });
      }
    } else {
      chrome.runtime.sendMessage({
        type: "CHUNK_FAILED",
        sessionId,
        chunkIndex,
        error: err?.message || String(err)
      });
    }
  } finally {
    pendingUploads = Math.max(0, pendingUploads - 1);
    maybeNotifyUploadsDone();
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

function sendChunkToBackground(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "CHUNK_DATA", ...payload }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message || "chunk upload failed"));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "chunk upload failed"));
        return;
      }
      resolve(response);
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_START") {
    apiBase = message.apiBase || apiBase;
    authToken = message.authToken || authToken;
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_START_FAKE") {
    apiBase = message.apiBase || apiBase;
    authToken = message.authToken || authToken;
    startFakeRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_STOP") {
    stopRecording();
    sendResponse({ ok: true });
  }
});
