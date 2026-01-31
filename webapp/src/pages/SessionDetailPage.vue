<script setup>
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import VideoPlayer from "../components/VideoPlayer.vue";
import SessionTabs from "../components/SessionTabs.vue";

const route = useRoute();
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

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
