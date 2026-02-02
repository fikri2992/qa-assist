const statusEl = document.getElementById("status");
const cancelBtn = document.getElementById("cancelBtn");
const startBtn = document.getElementById("startBtn");

function setStatus(message) {
  statusEl.textContent = message || "";
}

function closeWindow() {
  try {
    window.close();
  } catch {
    // ignore
  }
}

cancelBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CAPTURE_CANCELED" });
  closeWindow();
});

function setButtonsDisabled(disabled) {
  startBtn.disabled = disabled;
  cancelBtn.disabled = disabled;
}

async function startTabCapture() {
  setButtonsDisabled(true);
  setStatus("Starting tab capture...");
  const pending = await chrome.storage.local.get(["qa_pending_start"]);
  const payload = pending.qa_pending_start || {};
  if (!payload.captureTabId) {
    chrome.runtime.sendMessage({
      type: "CAPTURE_FAILED",
      error: "No target tab found. Click Start from the tab you want to record."
    });
    setButtonsDisabled(false);
    return;
  }

  if (!chrome.tabCapture?.getMediaStreamId) {
    chrome.runtime.sendMessage({
      type: "CAPTURE_FAILED",
      error: "Tab capture API not available. Reload the extension."
    });
    setButtonsDisabled(false);
    return;
  }

  chrome.tabCapture.getMediaStreamId(
    { targetTabId: payload.captureTabId },
    (streamId) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        chrome.runtime.sendMessage({
          type: "CAPTURE_FAILED",
          error: err.message || "Failed to start capture."
        });
        setStatus(err.message || "Failed to start capture.");
        setButtonsDisabled(false);
        return;
      }
      if (!streamId) {
        chrome.runtime.sendMessage({
          type: "CAPTURE_FAILED",
          error: "No stream available. Try again."
        });
        setStatus("No stream available. Try again.");
        setButtonsDisabled(false);
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "START",
          apiBase: payload.apiBase,
          debug: payload.debug,
          streamId,
          captureMode: "real",
          captureTabId: payload.captureTabId
        },
        () => {
          closeWindow();
        }
      );
    }
  );
}

startBtn.addEventListener("click", () => {
  startTabCapture().catch((err) => {
    chrome.runtime.sendMessage({
      type: "CAPTURE_FAILED",
      error: err?.message || "Failed to start capture."
    });
    setButtonsDisabled(false);
  });
});

setStatus("Ready to start capture.");
