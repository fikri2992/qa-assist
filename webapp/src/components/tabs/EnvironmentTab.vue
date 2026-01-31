<script setup>
import { computed } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { currentSession } = storeToRefs(sessionsStore);

const envItems = computed(() => {
  const metadata = currentSession.value?.metadata || {};
  const viewport = metadata.viewport || {};
  const screen = metadata.screen || {};
  const userAgentData = metadata.userAgentData || {};

  const rows = [
    { label: "URL", value: metadata.url },
    { label: "Title", value: metadata.title },
    { label: "Platform", value: metadata.platform || userAgentData.platform },
    { label: "Platform Version", value: userAgentData.platformVersion },
    { label: "Browser", value: userAgentData.uaFullVersion || metadata.userAgent },
    { label: "Viewport", value: viewport.width && viewport.height ? `${viewport.width}×${viewport.height}` : "" },
    { label: "Screen", value: screen.width && screen.height ? `${screen.width}×${screen.height}` : "" },
    { label: "Language", value: metadata.language },
  ];

  return rows.filter((row) => row.value);
});
</script>

<template>
  <div class="environment-tab">
    <DataTable v-if="envItems.length" :value="envItems" stripedRows>
      <Column field="label" header="Property" />
      <Column field="value" header="Value">
        <template #body="{ data }">
          <code>{{ data.value }}</code>
        </template>
      </Column>
    </DataTable>
    <Message v-else severity="info" :closable="false">
      No environment metadata.
    </Message>
  </div>
</template>

<style scoped>
code {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
