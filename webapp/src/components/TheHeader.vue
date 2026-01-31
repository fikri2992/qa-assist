<script setup>
import { useAppStore } from "../stores/app";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import Button from "primevue/button";
import Tag from "primevue/tag";

const appStore = useAppStore();
const sessionsStore = useSessionsStore();

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

const statusSeverity = computed(() => {
  const status = currentSession.value?.status;
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "recording") return "info";
  return "secondary";
});
</script>

<template>
  <header class="top-bar">
    <div class="session-info">
      <h1 class="session-title">{{ sessionTitle }}</h1>
      <span class="session-meta">{{ sessionMeta }}</span>
    </div>
    <div class="session-actions">
      <Tag
        v-if="currentSession"
        :value="currentSession.status"
        :severity="statusSeverity"
      />
      <Button
        icon="pi pi-moon"
        text
        rounded
        severity="secondary"
        @click="appStore.toggleTheme"
        aria-label="Toggle theme"
      />
      <Button
        icon="pi pi-sparkles"
        label="Assistant"
        outlined
        size="small"
        @click="appStore.toggleAssistant"
      />
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
}

.session-meta {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
