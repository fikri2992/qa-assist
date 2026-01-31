<script setup>
import { ref, computed } from "vue";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Badge from "primevue/badge";
import AnalysisTab from "./tabs/AnalysisTab.vue";
import EventsTab from "./tabs/EventsTab.vue";
import LogsTab from "./tabs/LogsTab.vue";
import AnnotationsTab from "./tabs/AnnotationsTab.vue";
import MarkersTab from "./tabs/MarkersTab.vue";
import EnvironmentTab from "./tabs/EnvironmentTab.vue";
import ArtifactsTab from "./tabs/ArtifactsTab.vue";

const sessionsStore = useSessionsStore();
const { issues, annotations, markers } = storeToRefs(sessionsStore);

const activeTab = ref("0");
</script>

<template>
  <section class="tabs-section">
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="0">
          <i class="pi pi-chart-bar"></i>
          Analysis
          <Badge v-if="issues.length" :value="issues.length" severity="danger" />
        </Tab>
        <Tab value="1">
          <i class="pi pi-mouse"></i>
          Interactions
        </Tab>
        <Tab value="2">
          <i class="pi pi-list"></i>
          Logs
        </Tab>
        <Tab value="3">
          <i class="pi pi-bookmark"></i>
          Annotations
          <Badge v-if="annotations.length" :value="annotations.length" />
        </Tab>
        <Tab value="4">
          <i class="pi pi-flag"></i>
          Markers
          <Badge v-if="markers.length" :value="markers.length" />
        </Tab>
        <Tab value="5">
          <i class="pi pi-desktop"></i>
          Environment
        </Tab>
        <Tab value="6">
          <i class="pi pi-download"></i>
          Artifacts
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="0">
          <AnalysisTab />
        </TabPanel>
        <TabPanel value="1">
          <EventsTab />
        </TabPanel>
        <TabPanel value="2">
          <LogsTab />
        </TabPanel>
        <TabPanel value="3">
          <AnnotationsTab />
        </TabPanel>
        <TabPanel value="4">
          <MarkersTab />
        </TabPanel>
        <TabPanel value="5">
          <EnvironmentTab />
        </TabPanel>
        <TabPanel value="6">
          <ArtifactsTab />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </section>
</template>

<style scoped>
.tabs-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
}

:deep(.p-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.p-tablist) {
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
}

:deep(.p-tab) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

:deep(.p-tabpanels) {
  flex: 1;
  overflow-y: auto;
}

:deep(.p-tabpanel) {
  padding: var(--space-5);
}
</style>
