<script setup>
import { onMounted } from "vue";
import { useAppStore } from "./stores/app";
import { storeToRefs } from "pinia";
import TheSidebar from "./components/TheSidebar.vue";
import TheHeader from "./components/TheHeader.vue";
import AssistantPanel from "./components/AssistantPanel.vue";

const appStore = useAppStore();
const { sidebarCollapsed } = storeToRefs(appStore);

onMounted(() => {
  appStore.initTheme();
});
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <TheSidebar />

    <div class="main-wrapper">
      <TheHeader />
      <main class="main-content">
        <router-view />
      </main>
    </div>

    <AssistantPanel />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
</style>
