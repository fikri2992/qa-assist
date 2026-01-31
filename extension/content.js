(() => {
  let lastPointer = { x: 0, y: 0 };
  let annotationEl = null;

  const style = document.createElement("style");
  style.textContent = `
    .qa-assist-annotate {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 12, 0.55);
      backdrop-filter: blur(6px);
      z-index: 2147483647;
      display: grid;
      place-items: center;
    }
    .qa-assist-panel {
      width: min(520px, 92vw);
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.6);
      font-family: "Segoe UI", Tahoma, sans-serif;
    }
    .qa-assist-panel h3 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    .qa-assist-panel textarea {
      width: 100%;
      height: 120px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: #0b1220;
      color: #f8fafc;
      padding: 10px;
      resize: vertical;
    }
    .qa-assist-actions {
      margin-top: 12px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .qa-assist-actions button {
      border: none;
      border-radius: 10px;
      padding: 8px 14px;
      cursor: pointer;
      font-weight: 600;
    }
    .qa-assist-save {
      background: #3b82f6;
      color: #fff;
    }
    .qa-assist-cancel {
      background: #1f2937;
      color: #e2e8f0;
    }
    .qa-assist-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.3);
      padding: 10px 14px;
      border-radius: 999px;
      font-family: "Segoe UI", Tahoma, sans-serif;
      font-size: 12px;
      z-index: 2147483647;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
      animation: qa-toast 2.4s ease forwards;
    }
    @keyframes qa-toast {
      0% { opacity: 0; transform: translateY(10px); }
      12% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; }
      100% { opacity: 0; transform: translateY(8px); }
    }
  `;
  document.documentElement.appendChild(style);

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && path.length < 5) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      }
      const siblingIndex = Array.from(el.parentNode.children).indexOf(el) + 1;
      selector += `:nth-child(${siblingIndex})`;
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(" > ");
  }

  function sendInteraction(type, event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const rect = target.getBoundingClientRect();
    const payload = {
      action: type,
      selector: cssPath(target),
      text: target.innerText?.slice(0, 120) || "",
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      url: window.location.href
    };

    chrome.runtime.sendMessage({
      type: "INTERACTION",
      event: {
        ts: new Date().toISOString(),
        type: "interaction",
        payload
      }
    });
  }

  function openAnnotation() {
    if (annotationEl) {
      const textarea = annotationEl.querySelector("textarea");
      textarea?.focus();
      return;
    }

    annotationEl = document.createElement("div");
    annotationEl.className = "qa-assist-annotate";
    annotationEl.innerHTML = `
      <div class="qa-assist-panel">
        <h3>Add annotation</h3>
        <textarea placeholder="Describe what you observed..."></textarea>
        <div class="qa-assist-actions">
          <button class="qa-assist-cancel" type="button">Cancel</button>
          <button class="qa-assist-save" type="button">Save</button>
        </div>
      </div>
    `;

    const textarea = annotationEl.querySelector("textarea");
    const cancelBtn = annotationEl.querySelector(".qa-assist-cancel");
    const saveBtn = annotationEl.querySelector(".qa-assist-save");

    cancelBtn.addEventListener("click", closeAnnotation);
    saveBtn.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (!text) return;
      chrome.runtime.sendMessage({
        type: "ANNOTATION_SUBMIT",
        payload: {
          text,
          url: window.location.href,
          x: lastPointer.x,
          y: lastPointer.y,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        }
      });
      closeAnnotation();
    });

    annotationEl.addEventListener("click", (event) => {
      if (event.target === annotationEl) {
        closeAnnotation();
      }
    });

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          closeAnnotation();
        }
      },
      { once: true }
    );

    document.body.appendChild(annotationEl);
    textarea.focus();
  }

  function closeAnnotation() {
    if (annotationEl) {
      annotationEl.remove();
      annotationEl = null;
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "qa-assist-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "OPEN_ANNOTATION") {
      openAnnotation();
    }
    if (message.type === "MARKER_TOAST") {
      showToast("Marker added");
    }
  });

  ["click", "keydown", "scroll", "mousemove"].forEach((type) => {
    window.addEventListener(
      type,
      (event) => {
        if (type === "mousemove") {
          lastPointer = { x: event.clientX, y: event.clientY };
          chrome.runtime.sendMessage({ type: "ACTIVITY" });
          return;
        }

        chrome.runtime.sendMessage({ type: "ACTIVITY" });
        sendInteraction(type, event);
      },
      { passive: true, capture: true }
    );
  });
})();
