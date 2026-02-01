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

chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_START") {
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_START_FAKE") {
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

async function startRecording({ streamId, chunkDurationMs, chunkStartIndex, debug, sessionId }) {
  if (isRecording) return;
  debugEnabled = !!debug;
  currentSessionId = sessionId || null;

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
    if (!event.data || event.data.size === 0) return;
    const buffer = await event.data.arrayBuffer();
    const startTs = currentChunkStart;
    const endTs = Date.now();
    currentChunkStart = endTs;

    chrome.runtime.sendMessage({
      type: "CHUNK_DATA",
      sessionId: currentSessionId,
      chunkIndex,
      startTs,
      endTs,
      mimeType: event.data.type,
      data: buffer
    });
    logDebug("chunk captured", { index: chunkIndex, bytes: event.data.size });

    chunkIndex += 1;
  };

  mediaRecorder.start(chunkDurationMs);
}

async function startFakeRecording({ chunkDurationMs, chunkStartIndex, debug, sessionId }) {
  if (isRecording) return;
  debugEnabled = !!debug;
  currentSessionId = sessionId || null;

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
    if (!event.data || event.data.size === 0) return;
    const buffer = await event.data.arrayBuffer();
    const startTs = currentChunkStart;
    const endTs = Date.now();
    currentChunkStart = endTs;

    chrome.runtime.sendMessage({
      type: "CHUNK_DATA",
      sessionId: currentSessionId,
      chunkIndex,
      startTs,
      endTs,
      mimeType: event.data.type,
      data: buffer
    });
    logDebug("chunk captured", { index: chunkIndex, bytes: event.data.size, fake: true });

    chunkIndex += 1;
  };

  mediaRecorder.start(chunkDurationMs);
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  logDebug("offscreen recording stopped");
  const stoppedSessionId = currentSessionId;
  currentSessionId = null;

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
}

function logDebug(message, detail) {
  if (!debugEnabled) return;
  chrome.runtime.sendMessage({
    type: "QA_DEBUG_LOG",
    payload: { message, detail, source: "offscreen" }
  });
}
