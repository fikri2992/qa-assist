export function initApp() {
  // DOM Elements
  const apiBaseInput = document.getElementById("apiBase");
  const deviceIdInput = document.getElementById("deviceId");
  const loadSessionsBtn = document.getElementById("loadSessions");
  const sessionList = document.getElementById("sessionList");
  const sessionTitle = document.getElementById("sessionTitle");
  const sessionMeta = document.getElementById("sessionMeta");
  const sessionStatus = document.getElementById("sessionStatus");
  const videoPlayer = document.getElementById("videoPlayer");
  const chunkList = document.getElementById("chunkList");
  const timelineTrack = document.getElementById("timelineTrack");
  const timelinePins = document.getElementById("timelinePins");
  const annotationOverlay = document.getElementById("annotationOverlay");
  const logPane = document.getElementById("logPane");
  const eventPane = document.getElementById("eventPane");
  const analysisSummary = document.getElementById("analysisSummary");
  const analysisBadges = document.getElementById("analysisBadges");
  const analysisIssues = document.getElementById("analysisIssues");
  const analysisReport = document.getElementById("analysisReport");
  const analysisStatus = document.getElementById("analysisStatus");
  const autonomyList = document.getElementById("autonomyList");
  const envPane = document.getElementById("envPane");
  const annotationList = document.getElementById("annotationList");
  const markerList = document.getElementById("markerList");
  const annotationCount = document.getElementById("annotationCount");
  const markerCount = document.getElementById("markerCount");
  const issueCount = document.getElementById("issueCount");
  const artifactList = document.getElementById("artifactList");
  const chatList = document.getElementById("chatList");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");
  const chatStop = document.getElementById("chatStop");
  const chatMode = document.getElementById("chatMode");
  const chatModel = document.getElementById("chatModel");
  const toggleAssistant = document.getElementById("toggleAssistant");
  const closeAssistant = document.getElementById("closeAssistant");
  const assistantPanel = document.getElementById("assistantPanel");
  const toggleTheme = document.getElementById("toggleTheme");
  const collapseSidebar = document.getElementById("collapseSidebar");
  const expandSidebar = document.getElementById("expandSidebar");
  const sidebar = document.querySelector(".sidebar");
  const appShell = document.querySelector(".app-shell");

  // State
  const storedApiBase = localStorage.getItem("qa_api_base") || "http://localhost:4000/api";
  const storedDeviceId = localStorage.getItem("qa_device_id") || "";

  apiBaseInput.value = storedApiBase;
  deviceIdInput.value = storedDeviceId;

  let currentChunks = [];
  let currentChunkIndex = 0;
  let currentEvents = [];
  let currentSession = null;
  let currentApiBase = storedApiBase;
  let chatAbort = null;
  let analysisPoller = null;

  // ============================================
  // SIDEBAR COLLAPSE
  // ============================================
  function initSidebar() {
    const isCollapsed = localStorage.getItem("qa_sidebar_collapsed") === "true";
    if (isCollapsed) {
      sidebar?.classList.add("collapsed");
      appShell?.classList.add("sidebar-collapsed");
    }

    collapseSidebar?.addEventListener("click", () => {
      sidebar?.classList.add("collapsed");
      appShell?.classList.add("sidebar-collapsed");
      localStorage.setItem("qa_sidebar_collapsed", "true");
    });

    expandSidebar?.addEventListener("click", () => {
      sidebar?.classList.remove("collapsed");
      appShell?.classList.remove("sidebar-collapsed");
      localStorage.setItem("qa_sidebar_collapsed", "false");
    });
  }

  // ============================================
  // THEME TOGGLE
  // ============================================
  function initTheme() {
    const stored = localStorage.getItem("qa_theme");
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      // Use system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }

    toggleTheme?.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("qa_theme", next);
    });

    // Listen for system preference changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("qa_theme")) {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    });
  }

  // ============================================
  // TAB NAVIGATION
  // ============================================
  function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.dataset.tab;

        tabBtns.forEach((b) => b.classList.remove("active"));
        tabPanels.forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(`tab-${tabId}`)?.classList.add("active");
      });
    });
  }

  // ============================================
  // ASSISTANT PANEL
  // ============================================
  function initAssistantPanel() {
    toggleAssistant?.addEventListener("click", () => {
      assistantPanel?.classList.add("open");
    });

    closeAssistant?.addEventListener("click", () => {
      assistantPanel?.classList.remove("open");
    });

    // Mode pill toggles
    const modePills = document.querySelectorAll(".mode-pill");
    modePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        modePills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        chatMode.value = pill.dataset.mode;
      });
    });
  }

  // ============================================
  // UTILITIES
  // ============================================
  function setStatus(text) {
    if (sessionStatus) sessionStatus.textContent = text || "";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ============================================
  // SESSION LOADING
  // ============================================
  async function loadSessions() {
    const apiBase = apiBaseInput.value.trim();
    const deviceId = deviceIdInput.value.trim();

    if (!apiBase || !deviceId) {
      alert("API URL and Device ID are required.");
      return;
    }

    localStorage.setItem("qa_api_base", apiBase);
    currentApiBase = apiBase;
    localStorage.setItem("qa_device_id", deviceId);

    sessionList.innerHTML = "";
    sessionTitle.textContent = "Loading...";
    sessionMeta.textContent = "";
    setStatus("");

    if (analysisPoller) {
      clearInterval(analysisPoller);
      analysisPoller = null;
    }

    try {
      const sessions = await fetchJson(`${apiBase}/sessions?device_id=${deviceId}`);
      if (!sessions.length) {
        sessionTitle.textContent = "No sessions found";
        return;
      }
      sessionTitle.textContent = "Select a session";
      sessions.forEach((session) => addSessionItem(session, apiBase));
    } catch (err) {
      sessionTitle.textContent = "Failed to load sessions";
      sessionMeta.textContent = err.message;
    }
  }

  function addSessionItem(session, apiBase) {
    const item = document.createElement("li");
    item.textContent = `${session.id.slice(0, 8)} · ${session.status}`;
    item.onclick = () => selectSession(session.id, apiBase, item);
    sessionList.appendChild(item);
  }

  async function selectSession(sessionId, apiBase, selectedItem) {
    [...sessionList.children].forEach((child) => child.classList.remove("active"));
    selectedItem.classList.add("active");

    sessionTitle.textContent = `Session ${sessionId.slice(0, 8)}`;
    setStatus("Loading...");

    try {
      const session = await fetchJson(`${apiBase}/sessions/${sessionId}`);
      const analysis = await fetchJson(`${apiBase}/sessions/${sessionId}/analysis`);
      const events = await fetchJson(`${apiBase}/sessions/${sessionId}/events?limit=1000`);
      const artifacts = await fetchJson(`${apiBase}/sessions/${sessionId}/artifacts`);

      sessionMeta.textContent = `Started ${formatDate(session.started_at)} · ${session.chunks.length} chunks`;
      setStatus(session.status);

      const orderedEvents = events.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));

      currentSession = session;
      currentApiBase = apiBase;
      currentChunks = session.chunks.slice().sort((a, b) => a.idx - b.idx);
      currentChunkIndex = 0;
      currentEvents = orderedEvents;

      renderChunks(currentChunks);
      setCurrentChunk(0);
      renderTimeline(session, currentChunks, orderedEvents);
      renderEvents(orderedEvents);
      renderLogs(orderedEvents);
      renderMarkers(orderedEvents);
      renderAnnotations(orderedEvents);
      renderAnalysis(analysis);
      renderEnvironment(session);
      startAnalysisPolling(sessionId, apiBase);
      renderArtifacts(artifacts, apiBase);
      renderChatIntro();
    } catch (err) {
      sessionMeta.textContent = err.message;
      setStatus("error");
    }
  }

  // ============================================
  // CHUNK RENDERING
  // ============================================
  function renderChunks(chunks) {
    chunkList.innerHTML = "";
    chunks.forEach((chunk, index) => {
      const pill = document.createElement("div");
      pill.className = "chunk-pill";
      pill.dataset.chunkId = chunk.id;
      pill.textContent = `#${chunk.idx} · ${chunk.status}`;
      pill.addEventListener("click", () => setCurrentChunk(index));
      chunkList.appendChild(pill);
    });
  }

  function setCurrentChunk(index) {
    if (!currentChunks.length) {
      videoPlayer.removeAttribute("src");
      return;
    }
    currentChunkIndex = Math.max(0, Math.min(index, currentChunks.length - 1));
    const chunk = currentChunks[currentChunkIndex];
    if (chunk?.video_url) {
      videoPlayer.src = chunk.video_url;
    }

    highlightTimeline();
    highlightChunks();
    renderOverlay();
  }

  function highlightTimeline() {
    const segments = timelineTrack.querySelectorAll("div");
    segments.forEach((segment, index) => {
      segment.classList.toggle("active", index === currentChunkIndex);
    });
  }

  function highlightChunks() {
    const pills = chunkList.querySelectorAll(".chunk-pill");
    pills.forEach((pill, index) => {
      pill.classList.toggle("active", index === currentChunkIndex);
    });
  }

  // ============================================
  // TIMELINE
  // ============================================
  function renderTimeline(session, chunks, events) {
    timelineTrack.innerHTML = "";
    timelinePins.innerHTML = "";

    if (!chunks.length) return;

    const { start, end } = getSessionWindow(session, chunks, events);
    const total = Math.max(end - start, 1);

    chunks.forEach((chunk, index) => {
      const duration = getDuration(chunk, 1);
      const widthPercent = (duration / total) * 100;
      const segment = document.createElement("div");
      segment.style.width = `${widthPercent}%`;
      segment.title = `Chunk ${chunk.idx}`;
      segment.addEventListener("click", () => setCurrentChunk(index));
      timelineTrack.appendChild(segment);
    });

    highlightTimeline();

    events.forEach((event) => {
      if (!event.ts) return;
      const time = new Date(event.ts).getTime();
      const left = ((time - start) / total) * 100;
      if (left < 0 || left > 100) return;

      if (event.type === "marker" || event.type === "annotation") {
        const pin = document.createElement("div");
        pin.className = `timeline-pin ${event.type === "annotation" ? "annotation" : ""}`;
        pin.style.left = `calc(${left}% - 4px)`;
        pin.title = event.type === "annotation" ? event.payload?.text || "Annotation" : "Marker";
        timelinePins.appendChild(pin);
      }
    });
  }

  function getDuration(chunk, fallback) {
    if (chunk.start_ts && chunk.end_ts) {
      const start = new Date(chunk.start_ts).getTime();
      const end = new Date(chunk.end_ts).getTime();
      const duration = end - start;
      return duration > 0 ? duration : fallback;
    }
    return fallback;
  }

  function getSessionWindow(session, chunks, events) {
    const timestamps = [];
    if (session.started_at) timestamps.push(new Date(session.started_at).getTime());
    if (session.ended_at) timestamps.push(new Date(session.ended_at).getTime());
    chunks.forEach((chunk) => {
      if (chunk.start_ts) timestamps.push(new Date(chunk.start_ts).getTime());
      if (chunk.end_ts) timestamps.push(new Date(chunk.end_ts).getTime());
    });
    events.forEach((event) => {
      if (event.ts) timestamps.push(new Date(event.ts).getTime());
    });

    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    return {
      start: Number.isFinite(start) ? start : Date.now(),
      end: Number.isFinite(end) ? end : Date.now() + 1
    };
  }

  // ============================================
  // EVENTS & LOGS
  // ============================================
  function renderEvents(events) {
    const interactions = events.filter((event) => event.type === "interaction");
    eventPane.innerHTML = "";

    if (!interactions.length) {
      eventPane.innerHTML = '<div class="event-item">No interactions captured.</div>';
      return;
    }

    interactions.forEach((event) => {
      const payload = event.payload || {};
      const item = document.createElement("div");
      item.className = "event-item";
      const label = payload.action || "interaction";
      const selector = payload.selector || "";
      const text = payload.text || "";
      item.innerHTML = `
        <strong>${escapeHtml(label)}</strong> ${escapeHtml(selector)}
        <div class="event-meta">${escapeHtml(text)}</div>
      `;
      eventPane.appendChild(item);
    });
  }

  function renderLogs(events) {
    const logs = events.filter((event) => event.type === "console" || event.type === "network");
    logPane.textContent = JSON.stringify(logs, null, 2);
  }

  // ============================================
  // MARKERS & ANNOTATIONS
  // ============================================
  function renderMarkers(events) {
    const markers = events.filter((event) => event.type === "marker");
    if (markerCount) markerCount.textContent = markers.length;
    markerList.innerHTML = "";

    if (!markers.length) {
      markerList.innerHTML = '<div class="marker-card">No markers yet.</div>';
      return;
    }

    markers.forEach((marker) => {
      const card = document.createElement("div");
      card.className = "marker-card";
      const label = marker.payload?.label || marker.payload?.message || "Marker";
      card.innerHTML = `
        <h4>${escapeHtml(label)}</h4>
        <div>${formatDate(marker.ts)}</div>
      `;
      markerList.appendChild(card);
    });
  }

  function renderAnnotations(events) {
    const annotations = events.filter((event) => event.type === "annotation");
    if (annotationCount) annotationCount.textContent = annotations.length;
    annotationList.innerHTML = "";

    if (!annotations.length) {
      annotationList.innerHTML = '<div class="annotation-card">No annotations yet.</div>';
      return;
    }

    annotations.forEach((annotation) => {
      const card = document.createElement("div");
      card.className = "annotation-card";
      const text = annotation.payload?.text || "(empty)";
      card.innerHTML = `
        <h4>${formatDate(annotation.ts)}</h4>
        <p>${escapeHtml(text)}</p>
      `;
      annotationList.appendChild(card);
    });
  }

  // ============================================
  // OVERLAY
  // ============================================
  function renderOverlay() {
    annotationOverlay.innerHTML = "";
    if (!currentSession || !currentChunks.length) return;

    const chunk = currentChunks[currentChunkIndex];
    if (!chunk?.start_ts || !chunk?.end_ts) return;
    const start = new Date(chunk.start_ts).getTime();
    const end = new Date(chunk.end_ts).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    const relevant = currentEvents.filter((event) => {
      if (!event.ts) return false;
      if (event.type !== "annotation" && event.type !== "marker") return false;
      const ts = new Date(event.ts).getTime();
      return ts >= start && ts <= end;
    });

    const rect = videoPlayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    relevant.forEach((event) => {
      const payload = event.payload || {};
      const viewport = payload.viewport || currentSession?.metadata?.viewport;
      const x = payload.x;
      const y = payload.y;
      if (!viewport || typeof x !== "number" || typeof y !== "number") return;

      const left = (x / viewport.width) * 100;
      const top = (y / viewport.height) * 100;
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;

      const pin = document.createElement("div");
      pin.className = `overlay-pin ${event.type === "marker" ? "marker" : ""}`;
      pin.style.left = `${left}%`;
      pin.style.top = `${top}%`;
      annotationOverlay.appendChild(pin);
    });
  }

  // ============================================
  // ARTIFACTS
  // ============================================
  function renderArtifacts(artifacts, apiBase) {
    artifactList.innerHTML = "";
    if (!artifacts.length) {
      artifactList.innerHTML = '<div class="artifact-card">No artifacts yet.</div>';
      return;
    }

    artifacts.forEach((artifact) => {
      const card = document.createElement("div");
      card.className = "artifact-card";
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(artifact.name)}</strong>
          <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(artifact.description || "")}</div>
        </div>
        <a href="${apiBase}/artifacts/${artifact.id}" target="_blank" rel="noreferrer">Download</a>
      `;
      artifactList.appendChild(card);
    });
  }

  // ============================================
  // ANALYSIS
  // ============================================
  function renderAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") {
      analysisSummary.textContent = "No analysis available yet.";
      if (analysisBadges) analysisBadges.innerHTML = "";
      analysisIssues.innerHTML = "";
      analysisReport.textContent = "";
      analysisStatus.textContent = "pending";
      autonomyList.innerHTML = "";
      if (issueCount) issueCount.textContent = "0";
      updateChunkAnalysisBadges({});
      return;
    }

    analysisStatus.textContent = analysis.status || "pending";
    analysisSummary.textContent = analysis.summary || "No analysis available yet.";

    renderSeverityBadges(analysis);
    renderIssueList(analysis);

    if (analysis.final_report) {
      analysisReport.textContent = JSON.stringify(analysis.final_report, null, 2);
    } else {
      analysisReport.textContent = "";
    }

    renderAutonomy(analysis);
    updateChunkAnalysisBadges(analysis);
  }

  function renderIssueList(analysis) {
    if (!analysisIssues) return;
    const finalIssues = analysis?.final_report?.issues;
    const topIssues = analysis?.final_report?.top_issues;
    const analyses = Array.isArray(analysis.analyses) ? analysis.analyses : [];
    const issues = Array.isArray(topIssues)
      ? topIssues
      : Array.isArray(finalIssues)
        ? finalIssues
        : analyses.flatMap((item) => item.report?.issues || []);

    if (issueCount) issueCount.textContent = issues.length;
    analysisIssues.innerHTML = "";

    if (!issues.length) {
      analysisIssues.innerHTML = '<div class="issue-card">No issues flagged yet.</div>';
      return;
    }

    issues.slice(0, 12).forEach((issue) => {
      const severity = String(issue.severity || "unknown").toLowerCase();
      const title = issue.title || "Issue";
      const detail = issue.detail || issue.message || "";
      const source = issue.source || issue.type || "";
      const card = document.createElement("div");
      card.className = "issue-card";
      card.innerHTML = `
        <div class="issue-header">
          <span class="issue-badge ${escapeHtml(severity)}">${escapeHtml(severity)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <div class="issue-body">${escapeHtml(detail)}</div>
        <div class="issue-meta">${escapeHtml(source)}</div>
      `;
      analysisIssues.appendChild(card);
    });
  }

  function renderSeverityBadges(analysis) {
    if (!analysisBadges) return;
    const breakdown = analysis?.final_report?.severity_breakdown;
    const analyses = Array.isArray(analysis.analyses) ? analysis.analyses : [];
    const issues = analyses.flatMap((item) => item.report?.issues || []);
    const counts = breakdown && typeof breakdown === "object" ? breakdown : countSeverity(issues);

    analysisBadges.innerHTML = "";
    const entries = [
      ["high", counts.high || 0],
      ["medium", counts.medium || 0],
      ["low", counts.low || 0]
    ];

    entries.forEach(([key, value]) => {
      if (value === 0) return;
      const badge = document.createElement("span");
      badge.className = `analysis-badge ${key}`;
      badge.textContent = `${key}: ${value}`;
      analysisBadges.appendChild(badge);
    });
  }

  function countSeverity(issues) {
    const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
    issues.forEach((issue) => {
      const severity = String(issue.severity || "unknown").toLowerCase();
      if (!Object.hasOwn(counts, severity)) {
        counts.unknown += 1;
      } else {
        counts[severity] += 1;
      }
    });
    return counts;
  }

  function renderAutonomy(analysis) {
    autonomyList.innerHTML = "";
    const analyses = Array.isArray(analysis.analyses) ? analysis.analyses : [];
    const entries = [];

    analyses.forEach((item) => {
      const agents = item.report?.agents;
      if (!Array.isArray(agents)) return;
      agents.forEach((agent) => {
        entries.push({
          chunkId: item.chunk_id,
          name: agent.name,
          summary: agent.summary || "",
          createdAt: item.created_at
        });
      });
    });

    if (!entries.length) {
      autonomyList.innerHTML = '<div class="autonomy-item">No agent timeline yet.</div>';
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "autonomy-item";
      row.innerHTML = `
        <div class="autonomy-title">${escapeHtml(entry.name || "agent")}</div>
        <div class="autonomy-meta">${escapeHtml(entry.chunkId || "")}</div>
        <div class="autonomy-summary">${escapeHtml(entry.summary || "")}</div>
      `;
      autonomyList.appendChild(row);
    });
  }

  function renderEnvironment(session) {
    if (!envPane) return;
    const metadata = session?.metadata || {};
    const viewport = metadata.viewport || {};
    const screen = metadata.screen || {};
    const userAgentData = metadata.userAgentData || {};
    const rows = [
      ["URL", metadata.url],
      ["Title", metadata.title],
      ["Platform", metadata.platform || userAgentData.platform],
      ["Platform version", userAgentData.platformVersion],
      ["Browser", userAgentData.uaFullVersion || metadata.userAgent],
      ["Viewport", viewport.width && viewport.height ? `${viewport.width}×${viewport.height}` : ""],
      ["Screen", screen.width && screen.height ? `${screen.width}×${screen.height}` : ""],
      ["Language", metadata.language]
    ];

    envPane.innerHTML = "";
    rows.forEach(([label, value]) => {
      if (!value) return;
      const row = document.createElement("div");
      row.className = "env-item";
      row.innerHTML = `<span>${escapeHtml(label)}</span><span>${escapeHtml(String(value))}</span>`;
      envPane.appendChild(row);
    });

    if (!envPane.children.length) {
      envPane.innerHTML = '<div class="env-item">No environment metadata.</div>';
    }
  }

  function updateChunkAnalysisBadges(analysis) {
    const analyses = Array.isArray(analysis.analyses) ? analysis.analyses : [];
    const statusByChunk = {};
    analyses.forEach((item) => {
      if (!item.chunk_id) return;
      statusByChunk[item.chunk_id] = item.status;
    });

    const pills = chunkList.querySelectorAll(".chunk-pill");
    pills.forEach((pill) => {
      const chunkId = pill.dataset.chunkId;
      const status = statusByChunk[chunkId];
      pill.classList.toggle("done", status === "done");
      pill.classList.toggle("running", status === "running");
      pill.classList.toggle("failed", status === "failed");
    });
  }

  function startAnalysisPolling(sessionId, apiBase) {
    if (analysisPoller) clearInterval(analysisPoller);

    const poll = async () => {
      if (!currentSession || currentSession.id !== sessionId) return;
      try {
        const analysis = await fetchJson(`${apiBase}/sessions/${sessionId}/analysis`);
        renderAnalysis(analysis);
      } catch {
        // ignore transient failures
      }
    };
    poll();
    analysisPoller = setInterval(poll, 5000);
  }

  // ============================================
  // CHAT
  // ============================================
  function renderChatIntro() {
    chatList.innerHTML = "";
    if (!currentSession) return;
    addChatMessage("assistant", "Ask me about this session's logs, UI issues, or repro steps.");
  }

  function addChatMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    chatList.appendChild(bubble);
    chatList.scrollTop = chatList.scrollHeight;
  }

  function setChatBusy(isBusy) {
    chatSend.disabled = isBusy;
    chatStop.disabled = !isBusy;
  }

  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!currentSession) {
      addChatMessage("assistant", "Select a session first.");
      return;
    }

    addChatMessage("user", message);
    chatInput.value = "";
    setChatBusy(true);

    chatAbort = new AbortController();
    try {
      const res = await fetch(`${currentApiBase}/sessions/${currentSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          mode: chatMode.value,
          model: chatModel.value
        }),
        signal: chatAbort.signal
      });
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
      const data = await res.json();
      addChatMessage("assistant", data.reply || "No reply.");
    } catch (err) {
      if (err.name !== "AbortError") {
        addChatMessage("assistant", err.message || "Chat failed.");
      }
    } finally {
      setChatBusy(false);
      chatAbort = null;
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  videoPlayer.addEventListener("ended", () => {
    if (currentChunkIndex < currentChunks.length - 1) {
      setCurrentChunk(currentChunkIndex + 1);
    }
  });

  videoPlayer.addEventListener("loadedmetadata", renderOverlay);
  window.addEventListener("resize", renderOverlay);

  loadSessionsBtn.addEventListener("click", loadSessions);

  chatSend.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendChatMessage();
  });
  chatStop.addEventListener("click", () => {
    if (chatAbort) chatAbort.abort();
  });

  // ============================================
  // INITIALIZATION
  // ============================================
  initSidebar();
  initTheme();
  initTabs();
  initAssistantPanel();
  setChatBusy(false);
}
