<script setup>
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import ProgressSpinner from "primevue/progressspinner";

const sessionsStore = useSessionsStore();
const { sessions, loading } = storeToRefs(sessionsStore);
</script>

<template>
  <div class="empty-state">
    <ProgressSpinner v-if="loading" />
    <template v-else>
      <i class="pi pi-box empty-icon"></i>
      <h2>Welcome to QA Assist</h2>
      <p>Load sessions from the sidebar to get started.</p>
      <p v-if="sessions.length" class="hint-text">
        {{ sessions.length }} session(s) available. Select one to view details.
      </p>
    </template>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-6);
}

.empty-icon {
  font-size: 64px;
  color: var(--accent);
  margin-bottom: var(--space-4);
  opacity: 0.4;
}

.empty-state h2 {
  margin: 0 0 var(--space-2);
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.hint-text {
  margin-top: var(--space-4) !important;
  color: var(--text-muted);
}
</style>
