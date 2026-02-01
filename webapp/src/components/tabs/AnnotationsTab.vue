<script setup>
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { annotations, currentSession } = storeToRefs(sessionsStore);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<template>
  <div class="annotations-tab">
    <div v-if="annotations.length" class="cards-grid">
      <Card v-for="(annotation, i) in annotations" :key="i" class="annotation-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-bookmark"></i>
            {{ formatDate(annotation.ts) }}
          </div>
        </template>
        <template #content>
          <p>{{ annotation.payload?.text || "(empty)" }}</p>
        </template>
      </Card>
    </div>
    <Message v-else severity="info" :closable="false">
      <span v-if="currentSession?.status === 'recording'">Waiting for annotations...</span>
      <span v-else>No annotations yet.</span>
    </Message>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.annotation-card {
  background: var(--bg-base);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
}

.card-title i {
  color: var(--accent);
}
</style>
