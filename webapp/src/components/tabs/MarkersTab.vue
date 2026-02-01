<script setup>
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { markers, currentSession } = storeToRefs(sessionsStore);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<template>
  <div class="markers-tab">
    <div v-if="markers.length" class="cards-grid">
      <Card v-for="(marker, i) in markers" :key="i" class="marker-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-flag"></i>
            {{ marker.payload?.label || marker.payload?.message || "Marker" }}
          </div>
        </template>
        <template #content>
          <p class="marker-time">{{ formatDate(marker.ts) }}</p>
        </template>
      </Card>
    </div>
    <Message v-else severity="info" :closable="false">
      <span v-if="currentSession?.status === 'recording'">Waiting for markers...</span>
      <span v-else>No markers yet.</span>
    </Message>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.marker-card {
  background: var(--bg-base);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
}

.card-title i {
  color: var(--warning);
}

.marker-time {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
