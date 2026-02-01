<script setup>
import { computed, ref, watch } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { logs, currentSession } = storeToRefs(sessionsStore);

const viewMode = ref("console");
const searchText = ref("");
const selectedLevels = ref([]);
const selectedNetKinds = ref([]);
const expandedNetwork = ref(new Set());
const levelsInitialized = ref(false);
const netKindsInitialized = ref(false);

const consoleLogs = computed(() => logs.value.filter((log) => log.type === "console"));
const networkLogs = computed(() => logs.value.filter((log) => log.type === "network"));

const availableLevels = computed(() => {
  const levels = consoleLogs.value.map((log) => normalizeLevel(log?.payload?.level));
  return Array.from(new Set(levels)).filter(Boolean);
});

const availableNetKinds = computed(() => {
  const kinds = networkLogs.value.map((log) => networkKind(log));
  return Array.from(new Set(kinds)).filter(Boolean);
});

watch(
  availableLevels,
  (levels) => {
    if (!levelsInitialized.value && levels.length) {
      selectedLevels.value = levels.slice();
      levelsInitialized.value = true;
    }
  },
  { immediate: true }
);

watch(
  availableNetKinds,
  (kinds) => {
    if (!netKindsInitialized.value && kinds.length) {
      selectedNetKinds.value = kinds.slice();
      netKindsInitialized.value = true;
    }
  },
  { immediate: true }
);

const filteredConsole = computed(() => {
  if (!consoleLogs.value.length) return [];
  const query = searchText.value.trim().toLowerCase();
  return consoleLogs.value.filter((log) => {
    const level = normalizeLevel(log?.payload?.level);
    if (selectedLevels.value.length && !selectedLevels.value.includes(level)) {
      return false;
    }
    if (!query) return true;
    const message = `${log?.payload?.message || ""} ${log?.payload?.url || ""}`.toLowerCase();
    return message.includes(query);
  });
});

const filteredNetwork = computed(() => {
  if (!networkLogs.value.length) return [];
  const query = searchText.value.trim().toLowerCase();
  return networkLogs.value.filter((log) => {
    const kind = networkKind(log);
    if (selectedNetKinds.value.length && !selectedNetKinds.value.includes(kind)) {
      return false;
    }
    if (!query) return true;
    const payload = log?.payload || {};
    const message = `${payload.url || ""} ${payload.method || ""} ${payload.status || ""} ${payload.error || ""}`.toLowerCase();
    return message.includes(query);
  });
});

const totalConsole = computed(() => consoleLogs.value.length);
const totalNetwork = computed(() => networkLogs.value.length);

function normalizeLevel(level) {
  if (!level) return "log";
  const lowered = String(level).toLowerCase();
  if (lowered === "warning") return "warn";
  if (lowered === "error") return "error";
  if (lowered === "info") return "info";
  if (lowered === "debug") return "debug";
  return "log";
}

function networkKind(log) {
  const payload = log?.payload || {};
  if (payload.type === "request") return "request";
  if (payload.type === "failed" || payload.error) return "failed";
  if (Number.isFinite(payload.status)) return "response";
  return "other";
}

function formatTime(ts) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function tabLabel(log) {
  const tab = log?.payload?.tab;
  if (!tab) return "Unknown tab";
  return tab.title || tab.url || (tab.id ? `Tab ${tab.id}` : "Unknown tab");
}

function toggleLevel(level) {
  if (selectedLevels.value.includes(level)) {
    selectedLevels.value = selectedLevels.value.filter((item) => item !== level);
  } else {
    selectedLevels.value = [...selectedLevels.value, level];
  }
}

function toggleNetKind(kind) {
  if (selectedNetKinds.value.includes(kind)) {
    selectedNetKinds.value = selectedNetKinds.value.filter((item) => item !== kind);
  } else {
    selectedNetKinds.value = [...selectedNetKinds.value, kind];
  }
}

function toggleNetwork(index) {
  const next = new Set(expandedNetwork.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  expandedNetwork.value = next;
}

function isExpanded(index) {
  return expandedNetwork.value.has(index);
}

function prettyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
</script>

<template>
  <div class="logs-tab">
    <div v-if="logs.length" class="logs-shell">
      <header class="logs-header">
        <div class="header-title">
          <span class="title-kicker">Session Logs</span>
          <h3>Console and Network</h3>
          <p>Filter by type, level, or keyword.</p>
        </div>
        <div class="header-meta">
          <div class="metric-card">
            <span>Console</span>
            <strong>{{ totalConsole }}</strong>
          </div>
          <div class="metric-card">
            <span>Network</span>
            <strong>{{ totalNetwork }}</strong>
          </div>
        </div>
      </header>

      <div class="logs-controls">
        <div class="view-switch">
          <button :class="{ active: viewMode === 'console' }" @click="viewMode = 'console'">Console</button>
          <button :class="{ active: viewMode === 'network' }" @click="viewMode = 'network'">Network</button>
          <button :class="{ active: viewMode === 'all' }" @click="viewMode = 'all'">All</button>
        </div>
        <label class="search">
          <span>Search</span>
          <input v-model="searchText" placeholder="Filter by keyword, url, status..." />
        </label>
      </div>

      <div class="logs-filters">
        <div v-if="viewMode !== 'network'" class="chip-group">
          <span class="chip-label">Console levels</span>
          <button
            v-for="level in availableLevels"
            :key="level"
            class="chip"
            :class="{ active: selectedLevels.includes(level) }"
            @click="toggleLevel(level)"
          >
            {{ level }}
          </button>
        </div>
        <div v-if="viewMode !== 'console'" class="chip-group">
          <span class="chip-label">Network types</span>
          <button
            v-for="kind in availableNetKinds"
            :key="kind"
            class="chip"
            :class="{ active: selectedNetKinds.includes(kind) }"
            @click="toggleNetKind(kind)"
          >
            {{ kind }}
          </button>
        </div>
      </div>

      <div class="logs-grid" :class="{ single: viewMode !== 'all' }">
        <section v-if="viewMode !== 'network'" class="log-panel">
          <div class="panel-head">
            <h4>Console stream</h4>
            <span>{{ filteredConsole.length }} entries</span>
          </div>
          <div class="panel-body">
            <div v-for="(log, index) in filteredConsole" :key="index" class="log-row" :data-level="normalizeLevel(log.payload?.level)">
              <span class="log-time">{{ formatTime(log.ts) }}</span>
              <span class="level-rail" aria-hidden="true"></span>
              <span class="level-text">{{ normalizeLevel(log.payload?.level) }}</span>
              <div class="log-message">
                <p>{{ log.payload?.message || "console event" }}</p>
                <span class="log-meta">{{ tabLabel(log) }}</span>
                <span v-if="log.payload?.url" class="log-meta">{{ log.payload.url }}</span>
              </div>
            </div>
            <div v-if="!filteredConsole.length" class="panel-empty">No console logs match this filter.</div>
          </div>
        </section>

        <section v-if="viewMode !== 'console'" class="log-panel">
          <div class="panel-head">
            <h4>Network stream</h4>
            <span>{{ filteredNetwork.length }} entries</span>
          </div>
          <div class="panel-body">
            <div v-for="(log, index) in filteredNetwork" :key="index" class="net-row" :class="{ expanded: isExpanded(index) }">
              <button class="net-summary" type="button" @click="toggleNetwork(index)">
                <span class="log-time">{{ formatTime(log.ts) }}</span>
                <span class="net-method">{{ log.payload?.method || "GET" }}</span>
                <span class="net-status" :data-status="log.payload?.status">{{ log.payload?.status ?? "--" }}</span>
                <div class="log-message">
                  <p>{{ log.payload?.url || "network event" }}</p>
                  <span class="log-meta">{{ tabLabel(log) }}</span>
                  <span class="log-meta">{{ networkKind(log) }}</span>
                </div>
                <span class="net-toggle">{{ isExpanded(index) ? "Hide" : "Details" }}</span>
              </button>
              <div v-if="isExpanded(index)" class="net-details">
                <div class="detail-block">
                  <h5>Request</h5>
                  <div class="detail-row">
                    <span>Method</span>
                    <strong>{{ log.payload?.method || "--" }}</strong>
                  </div>
                  <div class="detail-row" v-if="log.payload?.headers">
                    <span>Headers</span>
                    <pre>{{ prettyValue(log.payload?.headers) }}</pre>
                  </div>
                  <div class="detail-row" v-if="log.payload?.postData">
                    <span>Payload</span>
                    <pre>{{ prettyValue(log.payload?.postData) }}</pre>
                  </div>
                  <div class="detail-row" v-if="log.payload?.initiator">
                    <span>Initiator</span>
                    <strong>{{ log.payload?.initiator }}</strong>
                  </div>
                </div>
                <div class="detail-block">
                  <h5>Response</h5>
                <div class="detail-row">
                  <span>Status</span>
                  <strong>{{ log.payload?.status ?? "--" }} {{ log.payload?.statusText || "" }}</strong>
                </div>
                <div class="detail-row">
                  <span>Tab</span>
                  <strong>{{ tabLabel(log) }}</strong>
                </div>
                  <div class="detail-row" v-if="log.payload?.mimeType">
                    <span>MIME</span>
                    <strong>{{ log.payload?.mimeType }}</strong>
                  </div>
                  <div class="detail-row" v-if="log.payload?.headers">
                    <span>Headers</span>
                    <pre>{{ prettyValue(log.payload?.headers) }}</pre>
                  </div>
                  <div class="detail-row" v-if="log.payload?.error">
                    <span>Error</span>
                    <strong>{{ log.payload?.error }}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!filteredNetwork.length" class="panel-empty">No network logs match this filter.</div>
          </div>
        </section>
      </div>
    </div>
    <Message v-else severity="info" :closable="false">
      <span v-if="currentSession?.status === 'recording'">Collecting logs...</span>
      <span v-else>No logs captured.</span>
    </Message>
  </div>
</template>

<style scoped>
.logs-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: linear-gradient(160deg, rgba(148, 163, 184, 0.12), transparent 70%), var(--bg-surface);
}

.header-title h3 {
  margin: var(--space-2) 0 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.header-title p {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

.title-kicker {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.header-meta {
  display: flex;
  gap: var(--space-3);
}

.metric-card {
  min-width: 120px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: right;
}

.metric-card strong {
  font-size: 22px;
  color: var(--text-primary);
}

.logs-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.view-switch {
  display: inline-flex;
  background: transparent;
  border-radius: 999px;
  padding: 4px;
  border: 1px solid var(--border-subtle);
}

.view-switch button {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}

.view-switch button.active {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.search {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.search input {
  min-width: 260px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  padding: 8px 12px;
  color: var(--text-primary);
}

.logs-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.chip-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-right: var(--space-2);
}

.chip {
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  text-transform: lowercase;
}

.chip.active {
  border-color: var(--border-subtle);
  background: transparent;
  color: var(--text-primary);
  font-weight: 600;
}

.logs-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.logs-grid.single {
  grid-template-columns: 1fr;
}

.log-panel {
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0 var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
  color: var(--text-secondary);
}

.panel-head h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.panel-body {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  max-height: 520px;
  overflow-y: auto;
}

.log-row {
  display: grid;
  grid-template-columns: 70px 6px 64px 1fr;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-radius: 0;
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
}

.net-row {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-radius: 0;
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
}

.net-summary {
  display: grid;
  grid-template-columns: 70px 70px 70px 1fr auto;
  gap: var(--space-3);
  align-items: center;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.net-toggle {
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 4px 10px;
}

.net-details {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-2) 0 var(--space-3) var(--space-3);
  border-left: 2px solid var(--border-subtle);
}

.detail-block {
  background: transparent;
  border-radius: var(--radius-md);
  border: none;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.detail-block h5 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.detail-row {
  display: grid;
  gap: var(--space-1);
  font-size: 12px;
}

.detail-row span {
  color: var(--text-muted);
}

.detail-row strong {
  color: var(--text-primary);
}

.detail-row pre {
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-time {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.level-rail {
  width: 4px;
  border-radius: 999px;
  background: var(--border-subtle);
  align-self: stretch;
}

.level-text {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.log-row[data-level="error"] .level-rail {
  background: rgba(239, 68, 68, 0.35);
}
.log-row[data-level="error"] .level-text {
  color: rgba(239, 68, 68, 0.7);
}

.log-row[data-level="warn"] .level-rail {
  background: rgba(234, 179, 8, 0.35);
}
.log-row[data-level="warn"] .level-text {
  color: rgba(234, 179, 8, 0.8);
}

.log-row[data-level="info"] .level-rail {
  background: rgba(59, 130, 246, 0.35);
}
.log-row[data-level="info"] .level-text {
  color: rgba(59, 130, 246, 0.7);
}

.net-method {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.net-status {
  font-size: 12px;
  font-weight: 700;
}

.net-status[data-status^="2"] {
  color: var(--success);
}

.net-status[data-status^="3"] {
  color: var(--warning);
}

.net-status[data-status^="4"],
.net-status[data-status^="5"] {
  color: var(--error);
}

.log-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-message p {
  margin: 0;
  color: var(--text-primary);
  word-break: break-word;
}

.log-meta {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}

.panel-empty {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-subtle);
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 900px) {
  .logs-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-meta {
    width: 100%;
  }

  .metric-card {
    flex: 1;
  }

  .search input {
    width: min(100%, 360px);
  }
}
</style>
