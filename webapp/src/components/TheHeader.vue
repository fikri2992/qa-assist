<script setup>
import { useAppStore } from "../stores/app";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import { computed } from "vue";

const appStore = useAppStore();
const sessionsStore = useSessionsStore();
const { theme, assistantOpen } = storeToRefs(appStore);
const { currentSession } = storeToRefs(sessionsStore);

const sessionTitle = computed(() => {
  if (!currentSession.value) return "Select a session";
  return `Session ${currentSession.value.id.slice(0, 8)}`;
});

const sessionMeta = computed(() => {
  if (!currentSession.value) return "";
  const date = new Date(currentSession.value.started_at).toLocaleString();
  return `Started ${date} · ${currentSession.value.chunks?.length || 0} chunks`;
});

const statusClass = computed(() => {
  const status = currentSession.value?.status;
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "recording") return "info";
  return "default";
});

const themeIcon = computed(() => theme.value === "dark" ? "pi-sun" : "pi-moon");
</script>

<template>
  <header class="top-bar">
    <div class="session-info">
      <h1 class="session-title">{{ sessionTitle }}</h1>
      <span v-if="sessionMeta" class="session-meta">{{ sessionMeta }}</span>
    </div>
    <div class="header-actions">
      <span v-if="currentSession" class="status-badge" :class="statusClass">
        <span class="status-dot"></span>
        {{ currentSession.status }}
      </span>
      <button class="icon-btn" :title="theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="appStore.toggleTheme">
        <i :class="['pi', themeIcon]"></i>
      </button>
      <button 
        v-if="!assistantOpen" 
        class="assistant-btn"
        title="Open Assistant"
        @click="appStore.toggleAssistant"
      >
        <i class="pi pi-sparkles"></i>
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  gap: var(--space-4);
  min-height: 60px;
}

.session-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}

.session-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-primary);
}

.session-meta {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.status-badge.success .status-dot {
  background: #22c55e;
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.status-badge.error .status-dot {
  background: #ef4444;
}

.status-badge.info {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.status-badge.info .status-dot {
  background: #3b82f6;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.icon-btn i {
  font-size: 16px;
}

.assistant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--accent) 0%, #f59e0b 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assistant-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);
}

.assistant-btn:active {
  transform: scale(0.95);
}

.assistant-btn i {
  font-size: 18px;
}
</style>
