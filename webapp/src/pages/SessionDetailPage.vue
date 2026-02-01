<script setup>
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import Button from "primevue/button";
import VideoPlayer from "../components/VideoPlayer.vue";
import SessionTabs from "../components/SessionTabs.vue";
import { useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const sessionsStore = useSessionsStore();
const { currentSession, loading, error } = storeToRefs(sessionsStore);

onMounted(() => {
  const sessionId = route.params.id;
  if (sessionId && (!currentSession.value || currentSession.value.id !== sessionId)) {
    sessionsStore.selectSession(sessionId);
  }
});

watch(() => route.params.id, (newId) => {
  if (newId && (!currentSession.value || currentSession.value.id !== newId)) {
    sessionsStore.selectSession(newId);
  }
});

async function handleDelete() {
  if (!currentSession.value?.id) return;
  const ok = window.confirm("Delete this session? This cannot be undone.");
  if (!ok) return;
  await sessionsStore.deleteSession(currentSession.value.id);
  router.push({ name: "sessions" });
}

function formatSessionId(id) {
  return id?.slice(0, 8) || "";
}
</script>

<template>
  <div class="session-detail">
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>
    <Message v-else-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>
    <template v-else-if="currentSession">
      <div class="session-header">
        <div>
          <p class="session-kicker">Session</p>
          <h2 class="session-title">{{ formatSessionId(currentSession.id) }}</h2>
        </div>
        <Button
          label="Delete session"
          icon="pi pi-trash"
          severity="danger"
          outlined
          size="small"
          @click="handleDelete"
        />
      </div>
      <VideoPlayer />
      <SessionTabs />
    </template>
  </div>
</template>

<style scoped>
.session-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.session-kicker {
  margin: 0 0 var(--space-1);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.session-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
