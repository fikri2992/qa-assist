<script setup>
import { onMounted } from "vue";
import { useAppStore } from "../stores/app";
import { useSessionsStore } from "../stores/sessions";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { mapSessionStatus } from "../utils/status";

const appStore = useAppStore();
const sessionsStore = useSessionsStore();
const router = useRouter();

const { sidebarCollapsed } = storeToRefs(appStore);
const { sessions, loading, currentSession, isAuthenticated } = storeToRefs(sessionsStore);

async function handleSelectSession(session) {
  await sessionsStore.selectSession(session.id);
  router.push({ name: "session-detail", params: { id: session.id } });
}

function formatSessionId(id) {
  return id?.slice(0, 8) || "";
}

function getStatusInfo(status) {
  return mapSessionStatus(status);
}

function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) {
    return `Today ${time}`;
  }
  return `${date.toLocaleDateString()} ${time}`;
}

function formatDuration(startTs, endTs) {
  if (!startTs || !endTs) return "";
  const diff = Math.max(0, new Date(endTs).getTime() - new Date(startTs).getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function getRecordingStart(session) {
  return session?.recording_started_at || session?.started_at || "";
}

function getRecordingEnd(session) {
  return session?.recording_ended_at || session?.ended_at || "";
}

function sessionMeta(session) {
  if (!session) return "";
  if (session.status === "recording") {
    return `Started ${formatTime(session.started_at) || "recently"}`;
  }
  if (session.status === "paused") {
    return `Paused ${formatTime(session.idle_paused_at || session.started_at) || ""}`.trim();
  }
  if (session.status === "ended") {
    const time = formatTime(getRecordingEnd(session) || session.ended_at || session.started_at);
    const duration = formatDuration(getRecordingStart(session), getRecordingEnd(session));
    return [time, duration].filter(Boolean).join(" · ");
  }
  return formatTime(session.inserted_at || session.started_at);
}

function showStatusBadge(status) {
  return ["recording", "paused", "failed"].includes(status);
}

function handleLogout() {
  sessionsStore.logout();
  router.push({ name: "sessions" });
}

// Auto-load sessions on mount
onMounted(() => {
  if (isAuthenticated.value) {
    sessionsStore.loadSessions();
  }
});
</script>

<template>
  <!-- Full Sidebar -->
  <aside v-if="!sidebarCollapsed" class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <i class="pi pi-box"></i>
        </div>
        <span class="logo-text">QA Assist</span>
      </div>
      <button class="collapse-btn" title="Collapse sidebar" @click="appStore.toggleSidebar">
        <i class="pi pi-angle-left"></i>
      </button>
    </div>

    <div class="sidebar-section flex-1">
      <div class="section-label">Sessions</div>
      <div class="session-list">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: currentSession?.id === session.id }"
          @click="handleSelectSession(session)"
        >
          <i class="pi pi-file"></i>
          <div class="session-info">
            <span class="session-id">{{ formatSessionId(session.id) }}</span>
            <span class="session-meta">{{ sessionMeta(session) }}</span>
          </div>
          <span
            v-if="showStatusBadge(session.status)"
            class="session-status"
            :class="getStatusInfo(session.status).className"
          >
            {{ getStatusInfo(session.status).label }}
          </span>
        </button>
        <div v-if="!sessions.length && !loading" class="empty-sessions">
          <i class="pi pi-inbox"></i>
          <span>No sessions loaded</span>
        </div>
      </div>
    </div>

    <div v-if="isAuthenticated" class="sidebar-footer">
      <button class="logout-btn" @click="handleLogout">
        <i class="pi pi-sign-out"></i>
        <span>Logout</span>
      </button>
    </div>
  </aside>

  <!-- Collapsed Rail -->
  <div v-else class="sidebar-rail">
    <button class="rail-btn" title="Expand sidebar" @click="appStore.toggleSidebar">
      <i class="pi pi-bars"></i>
    </button>
    <div class="rail-divider"></div>
    <button
      v-for="session in sessions.slice(0, 5)"
      :key="session.id"
      class="rail-session"
      :class="{ active: currentSession?.id === session.id }"
      :title="session.id"
      @click="handleSelectSession(session)"
    >
      {{ formatSessionId(session.id).slice(0, 2) }}
    </button>
    <button
      v-if="isAuthenticated"
      class="rail-btn rail-logout"
      title="Logout"
      @click="handleLogout"
    >
      <i class="pi pi-sign-out"></i>
    </button>
  </div>
</template>

<style scoped>
.sidebar {
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: var(--sidebar-width);
  position: sticky;
  top: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent) 0%, #f59e0b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-icon i {
  font-size: 18px;
}

.logo-text {
  font-weight: 700;
  font-size: 16px;
  color: var(--text-primary);
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-section {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sidebar-section.flex-1 {
  flex: 1;
  overflow: hidden;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.session-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.session-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.session-item.active {
  background: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.session-item i {
  font-size: 14px;
  opacity: 0.6;
}

.session-id {
  font-family: monospace;
  color: var(--text-primary);
}

.session-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-status {
  font-size: 10px;
  padding: 2px 6px 2px 8px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.session-status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--status-color, var(--text-muted));
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.02);
}

.session-status.completed {
  --status-color: #2f855a;
  background: rgba(47, 133, 90, 0.08);
  border-color: rgba(47, 133, 90, 0.25);
  color: #2f855a;
}

.session-status.failed {
  --status-color: #b91c1c;
  background: rgba(185, 28, 28, 0.08);
  border-color: rgba(185, 28, 28, 0.25);
  color: #b91c1c;
}

.session-status.recording {
  --status-color: #1d4ed8;
  background: rgba(29, 78, 216, 0.08);
  border-color: rgba(29, 78, 216, 0.25);
  color: #1d4ed8;
}

.session-status.paused {
  --status-color: #b45309;
  background: rgba(180, 83, 9, 0.08);
  border-color: rgba(180, 83, 9, 0.25);
  color: #b45309;
}

.session-status.unknown {
  background: var(--bg-base);
  color: var(--text-muted);
}

.empty-sessions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  color: var(--text-muted);
  text-align: center;
  gap: var(--space-2);
}

.empty-sessions i {
  font-size: 32px;
  opacity: 0.4;
}

.empty-sessions span {
  font-size: 13px;
}

.sidebar-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.logout-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Sidebar Rail */
.sidebar-rail {
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  width: 60px;
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  gap: var(--space-2);
}

.rail-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: none;
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.rail-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rail-btn i {
  font-size: 18px;
}

.rail-divider {
  width: 32px;
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-2) 0;
}

.rail-session {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
}

.rail-session:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rail-session.active {
  background: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.rail-logout {
  margin-top: auto;
}
</style>
