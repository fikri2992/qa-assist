import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useSessionsStore = defineStore("sessions", () => {
  // Connection
  const apiBase = ref(localStorage.getItem("qa_api_base") || "http://localhost:4000/api");
  const deviceId = ref(localStorage.getItem("qa_device_id") || "");
  const deviceSecret = ref(localStorage.getItem("qa_device_secret") || "");

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

  // Polling
  let analysisPoller = null;

  // Computed
  const currentChunk = computed(() => chunks.value[currentChunkIndex.value] || null);

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
    if (deviceId.value) headers["x-device-id"] = deviceId.value;
    if (deviceSecret.value) headers["x-device-secret"] = deviceSecret.value;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  function saveConnection() {
    localStorage.setItem("qa_api_base", apiBase.value);
    localStorage.setItem("qa_device_id", deviceId.value);
    localStorage.setItem("qa_device_secret", deviceSecret.value);
  }

  async function loadSessions() {
    if (!apiBase.value || !deviceId.value || !deviceSecret.value) {
      error.value = "API URL, Device ID, and Device Secret are required.";
      return;
    }

    saveConnection();
    loading.value = true;
    error.value = null;

    try {
      sessions.value = await fetchJson(`${apiBase.value}/sessions?device_id=${deviceId.value}`);
    } catch (err) {
      error.value = err.message;
      sessions.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function selectSession(sessionId) {
    loading.value = true;
    error.value = null;
    stopAnalysisPolling();

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

  return {
    apiBase,
    deviceId,
    deviceSecret,
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
    annotations,
    markers,
    interactions,
    logs,
    issues,
    loadSessions,
    selectSession,
    setCurrentChunk,
    nextChunk,
    stopAnalysisPolling,
  };
});
