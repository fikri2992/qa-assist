import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useSessionsStore = defineStore("sessions", () => {
  // Connection
  const defaultApiBase = (() => {
    if (typeof window === "undefined") return "http://localhost:4000/api";
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" ? "/api" : "http://localhost:4000/api";
  })();
  const storedApiBase = localStorage.getItem("qa_api_base");
  const apiBase = ref(storedApiBase || defaultApiBase);
  const authToken = ref(localStorage.getItem("qa_auth_token") || "");
  const authEmail = ref(localStorage.getItem("qa_auth_email") || "");

  if (!storedApiBase) {
    localStorage.setItem("qa_api_base", apiBase.value);
  } else if (storedApiBase === "http://localhost:4000/api" && defaultApiBase === "/api") {
    apiBase.value = "/api";
    localStorage.setItem("qa_api_base", apiBase.value);
  }

  // Sessions
  const sessions = ref([]);
  const currentSession = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Session data
  const events = ref([]);
  const analysis = ref(null);
  const artifacts = ref([]);
  const chunks = ref([]);
  const currentChunkIndex = ref(0);
  const aiHealth = ref(null);

  // Polling
  let analysisPoller = null;
  let eventsPoller = null;

  // Computed
  const currentChunk = computed(() => chunks.value[currentChunkIndex.value] || null);
  const isAuthenticated = computed(() => !!authToken.value);

  const annotations = computed(() => 
    events.value.filter((e) => e.type === "annotation")
  );

  const markers = computed(() => 
    events.value.filter((e) => e.type === "marker")
  );

  const interactions = computed(() => 
    events.value.filter((e) => e.type === "interaction")
  );

  const logs = computed(() => 
    events.value.filter((e) => e.type === "console" || e.type === "network")
  );

  const issues = computed(() => {
    if (!analysis.value) return [];
    const finalIssues = analysis.value?.final_report?.issues;
    const topIssues = analysis.value?.final_report?.top_issues;
    const analyses = Array.isArray(analysis.value.analyses) ? analysis.value.analyses : [];
    return Array.isArray(topIssues)
      ? topIssues
      : Array.isArray(finalIssues)
        ? finalIssues
        : analyses.flatMap((item) => item.report?.issues || []);
  });

  // Actions
  async function fetchJson(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (authToken.value) headers["Authorization"] = `Bearer ${authToken.value}`;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  function saveConnection() {
    localStorage.setItem("qa_api_base", apiBase.value);
    localStorage.setItem("qa_auth_token", authToken.value);
    localStorage.setItem("qa_auth_email", authEmail.value);
  }

  async function login(email, password) {
    if (!email || !password) {
      error.value = "Email and password are required.";
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${apiBase.value}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`Login failed: ${res.status}`);
      const data = await res.json();
      authToken.value = data.token;
      authEmail.value = email;
      saveConnection();
      await loadSessions();
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    authToken.value = "";
    sessions.value = [];
    currentSession.value = null;
    analysis.value = null;
    events.value = [];
    artifacts.value = [];
    chunks.value = [];
    currentChunkIndex.value = 0;
    stopLivePolling();
    saveConnection();
  }

  async function loadSessions() {
    if (!apiBase.value || !authToken.value) {
      error.value = "Login required.";
      return;
    }

    saveConnection();
    loading.value = true;
    error.value = null;

    try {
      sessions.value = await fetchJson(`${apiBase.value}/sessions`);
    } catch (err) {
      error.value = err.message;
      sessions.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadAiHealth() {
    if (!apiBase.value || !authToken.value) return;
    try {
      aiHealth.value = await fetchJson(`${apiBase.value}/ai/health`);
    } catch {
      aiHealth.value = null;
    }
  }

  async function selectSession(sessionId) {
    loading.value = true;
    error.value = null;
    stopAnalysisPolling();
    stopLivePolling();

    try {
      const [session, sessionAnalysis, sessionEvents, sessionArtifacts] = await Promise.all([
        fetchJson(`${apiBase.value}/sessions/${sessionId}`),
        fetchJson(`${apiBase.value}/sessions/${sessionId}/analysis`),
        fetchJson(`${apiBase.value}/sessions/${sessionId}/events?limit=1000`),
        fetchJson(`${apiBase.value}/sessions/${sessionId}/artifacts`),
      ]);

      currentSession.value = session;
      analysis.value = sessionAnalysis;
      events.value = sessionEvents.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
      artifacts.value = sessionArtifacts;
      chunks.value = session.chunks.slice().sort((a, b) => a.idx - b.idx);
      currentChunkIndex.value = 0;

      startAnalysisPolling(sessionId);
      startLivePolling(sessionId);
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  function setCurrentChunk(index) {
    currentChunkIndex.value = Math.max(0, Math.min(index, chunks.value.length - 1));
  }

  function nextChunk() {
    if (currentChunkIndex.value < chunks.value.length - 1) {
      currentChunkIndex.value++;
    }
  }

  function startAnalysisPolling(sessionId) {
    const poll = async () => {
      if (!currentSession.value || currentSession.value.id !== sessionId) return;
      try {
        analysis.value = await fetchJson(`${apiBase.value}/sessions/${sessionId}/analysis`);
      } catch {
        // ignore
      }
    };
    analysisPoller = setInterval(poll, 5000);
  }

  function stopAnalysisPolling() {
    if (analysisPoller) {
      clearInterval(analysisPoller);
      analysisPoller = null;
    }
  }

  async function refreshEvents(sessionId) {
    if (!currentSession.value || currentSession.value.id !== sessionId) return;
    try {
      const sessionEvents = await fetchJson(`${apiBase.value}/sessions/${sessionId}/events?limit=1000`);
      events.value = sessionEvents.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    } catch {
      // ignore polling failures
    }
  }

  async function refreshSession(sessionId) {
    if (!currentSession.value || currentSession.value.id !== sessionId) return;
    try {
      const session = await fetchJson(`${apiBase.value}/sessions/${sessionId}`);
      currentSession.value = session;
      chunks.value = session.chunks.slice().sort((a, b) => a.idx - b.idx);
    } catch {
      // ignore polling failures
    }
  }

  function startLivePolling(sessionId) {
    stopLivePolling();
    const poll = async () => {
      if (!currentSession.value || currentSession.value.id !== sessionId) return;
      await Promise.all([refreshSession(sessionId), refreshEvents(sessionId)]);
      if (currentSession.value?.status === "ended") {
        stopLivePolling();
      }
    };
    eventsPoller = setInterval(poll, 4000);
    poll();
  }

  function stopLivePolling() {
    if (eventsPoller) {
      clearInterval(eventsPoller);
      eventsPoller = null;
    }
  }

  return {
    apiBase,
    authToken,
    authEmail,
    sessions,
    currentSession,
    loading,
    error,
    events,
    analysis,
    artifacts,
    chunks,
    currentChunkIndex,
    currentChunk,
    aiHealth,
    isAuthenticated,
    annotations,
    markers,
    interactions,
    logs,
    issues,
    login,
    logout,
    loadSessions,
    loadAiHealth,
    selectSession,
    setCurrentChunk,
    nextChunk,
    stopAnalysisPolling,
    startLivePolling,
    stopLivePolling,
  };
});
