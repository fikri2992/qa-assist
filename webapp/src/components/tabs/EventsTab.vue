<script setup>
import { computed } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { interactions, currentSession } = storeToRefs(sessionsStore);

const enriched = computed(() =>
  interactions.value.map((event) => ({
    ...event,
    tabLabel:
      event.payload?.tab?.title ||
      event.payload?.tab?.url ||
      (event.payload?.tab?.id ? `Tab ${event.payload.tab.id}` : "Unknown tab")
  }))
);

function formatTime(ts) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
</script>

<template>
  <div class="events-tab">
    <div v-if="interactions.length" class="events-list">
      <Card v-for="(event, i) in enriched" :key="i" class="event-card">
        <template #title>
          <div class="event-title">
            <div class="event-title-left">
              <i class="pi pi-mouse"></i>
              <span>{{ event.payload?.action || "interaction" }}</span>
            </div>
            <span class="event-time">{{ formatTime(event.ts) }}</span>
          </div>
        </template>
        <template #content>
          <div class="event-meta">
            <span class="event-tab">{{ event.tabLabel }}</span>
            <span v-if="event.payload?.url" class="event-url">{{ event.payload.url }}</span>
          </div>
          <code class="event-selector">{{ event.payload?.selector || "" }}</code>
          <p v-if="event.payload?.text" class="event-text">{{ event.payload.text }}</p>
        </template>
      </Card>
    </div>
    <Message v-else severity="info" :closable="false">
      <span v-if="currentSession?.status === 'recording'">Capturing interactions...</span>
      <span v-else>No interactions captured.</span>
    </Message>
  </div>
</template>

<style scoped>
.events-list {
  display: grid;
  gap: var(--space-3);
}

.event-card {
  background: var(--bg-base);
}

.event-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 14px;
}

.event-title-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.event-time {
  font-size: 11px;
  color: var(--text-muted);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.event-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-2);
}

.event-tab {
  font-size: 12px;
  color: var(--text-secondary);
}

.event-url {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}

.event-selector {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  word-break: break-all;
}

.event-text {
  margin: var(--space-2) 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
