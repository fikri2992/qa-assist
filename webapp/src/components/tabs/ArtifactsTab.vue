<script setup>
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Button from "primevue/button";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { artifacts, apiBase, authToken } = storeToRefs(sessionsStore);
</script>

<template>
  <div class="artifacts-tab">
    <div v-if="artifacts.length" class="cards-grid">
      <Card v-for="artifact in artifacts" :key="artifact.id" class="artifact-card">
        <template #title>
          <div class="card-title">
            <i class="pi pi-file"></i>
            {{ artifact.name }}
          </div>
        </template>
        <template #content>
          <p v-if="artifact.description" class="artifact-desc">{{ artifact.description }}</p>
        </template>
        <template #footer>
          <Button
            label="Download"
            icon="pi pi-download"
            size="small"
            outlined
            as="a"
            :href="`${apiBase}/artifacts/${artifact.id}?auth_token=${encodeURIComponent(authToken || '')}`"
            target="_blank"
          />
        </template>
      </Card>
    </div>
    <Message v-else severity="info" :closable="false">
      No artifacts yet.
    </Message>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.artifact-card {
  background: var(--bg-base);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
}

.artifact-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
