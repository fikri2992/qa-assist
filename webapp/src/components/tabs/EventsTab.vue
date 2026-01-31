<script setup>
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { interactions } = storeToRefs(sessionsStore);
</script>

<template>
  <div class="events-tab">
    <div v-if="interactions.length" class="events-list">
      <Card v-for="(event, i) in interactions" :key="i" class="event-card">
        <template #title>
          <div class="event-title">
            <i class="pi pi-mouse"></i>
            {{ event.payload?.action || "interaction" }}
          </div>
        </template>
        <template #content>
          <code class="event-selector">{{ event.payload?.selector || "" }}</code>
          <p v-if="event.payload?.text" class="event-text">{{ event.payload.text }}</p>
        </template>
      </Card>
    </div>
    <Message v-else severity="info" :closable="false">
      No interactions captured.
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
  gap: var(--space-2);
  font-size: 14px;
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
