<script setup>
import { computed } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { logs, currentSession } = storeToRefs(sessionsStore);

const formattedLogs = computed(() => JSON.stringify(logs.value, null, 2));
</script>

<template>
  <div class="logs-tab">
    <pre v-if="logs.length" class="code-block">{{ formattedLogs }}</pre>
    <Message v-else severity="info" :closable="false">
      <span v-if="currentSession?.status === 'recording'">Collecting logs...</span>
      <span v-else>No logs captured.</span>
    </Message>
  </div>
</template>

<style scoped>
.code-block {
  background: var(--bg-base);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
</style>
