let isRecording = false;
let mediaRecorder = null;
let streamRef = null;
let chunkIndex = 0;
let currentChunkStart = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_START") {
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OFFSCREEN_STOP") {
    stopRecording();
    sendResponse({ ok: true });
  }
});

async function startRecording({ streamId, chunkDurationMs, chunkStartIndex }) {
  if (isRecording) return;

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

  mediaRecorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0) return;
    const buffer = await event.data.arrayBuffer();
    const startTs = currentChunkStart;
    const endTs = Date.now();
    currentChunkStart = endTs;

    chrome.runtime.sendMessage({
      type: "CHUNK_DATA",
      chunkIndex,
      startTs,
      endTs,
      mimeType: event.data.type,
      data: buffer
    });

    chunkIndex += 1;
  };

  mediaRecorder.start(chunkDurationMs);
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (streamRef) {
    streamRef.getTracks().forEach((track) => track.stop());
    streamRef = null;
  }

  mediaRecorder = null;
}
