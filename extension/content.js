(function () {
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

  ["click", "keydown", "scroll", "mousemove"].forEach((type) => {
    window.addEventListener(
      type,
      (event) => {
        chrome.runtime.sendMessage({ type: "ACTIVITY" });
        if (type === "mousemove") return;
        sendInteraction(type, event);
      },
      { passive: true, capture: true }
    );
  });
})();
