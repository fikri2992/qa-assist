<script setup>
import { useAppStore } from "../stores/app";
import { useSessionsStore } from "../stores/sessions";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

const appStore = useAppStore();
const sessionsStore = useSessionsStore();
const router = useRouter();

const { sidebarCollapsed } = storeToRefs(appStore);
const { apiBase, deviceId, sessions, loading, currentSession } = storeToRefs(sessionsStore);

async function handleLoadSessions() {
  await sessionsStore.loadSessions();
}

async function handleSelectSession(session) {
  await sessionsStore.selectSession(session.id);
  router.push({ name: "session-detail", params: { id: session.id } });
}

function formatSessionId(id) {
  return id?.slice(0, 8) || "";
}
</script>

<template>
  <!-- Full Sidebar -->
  <aside v-show="!sidebarCollapsed" class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <i class="pi pi-box logo-icon"></i>
        <span class="logo-text">QA Assist</span>
      </div>
      <Button
        icon="pi pi-bars"
        text
        rounded
        severity="secondary"
        size="small"
        @click="appStore.toggleSidebar"
        aria-label="Collapse sidebar"
      />
    </div>

    <div class="sidebar-section">
      <div class="section-label">Connection</div>
      <InputText
        v-model="apiBase"
        placeholder="http://localhost:4000/api"
        class="w-full"
        size="small"
      />
      <InputText
        v-model="deviceId"
        placeholder="Device UUID"
        class="w-full"
        size="small"
      />
      <Button
        label="Load Sessions"
        icon="pi pi-refresh"
        :loading="loading"
        class="w-full"
        @click="handleLoadSessions"
      />
    </div>

    <div class="sidebar-section flex-1">
      <div class="section-label">Sessions</div>
      <ul class="session-list">
        <li
          v-for="session in sessions"
          :key="session.id"
          :class="{ active: currentSession?.id === session.id }"
          @click="handleSelectSession(session)"
        >
          <i class="pi pi-file"></i>
          {{ formatSessionId(session.id) }} · {{ session.status }}
        </li>
        <li v-if="!sessions.length && !loading" class="empty">
          <i class="pi pi-inbox"></i>
          No sessions loaded
        </li>
      </ul>
    </div>
  </aside>

  <!-- Collapsed Rail -->
  <div v-show="sidebarCollapsed" class="sidebar-rail">
    <Button
      icon="pi pi-bars"
      text
      rounded
      severity="secondary"
      @click="appStore.toggleSidebar"
      aria-label="Expand sidebar"
    />
  </div>
</template>

<style scoped>
.sidebar {
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  width: var(--sidebar-width);
  overflow: hidden;
}

.sidebar-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.logo-icon {
  font-size: 20px;
  color: var(--accent);
}

.logo-text {
  font-weight: 600;
  font-size: 15px;
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
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.session-list li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.session-list li:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.session-list li.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.session-list li.empty {
  color: var(--text-muted);
  cursor: default;
  flex-direction: column;
  padding: var(--space-4);
  text-align: center;
}

.session-list li.empty:hover {
  background: transparent;
  color: var(--text-muted);
}

.session-list li.empty i {
  font-size: 24px;
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

/* Sidebar Rail */
.sidebar-rail {
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  width: 56px;
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--space-3);
}
</style>
