<script setup>
import { ref, computed } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Card from "primevue/card";
import Button from "primevue/button";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { artifacts, apiBase, authToken, currentSession, chunks } = storeToRefs(sessionsStore);

const rebuildState = ref({ loading: false, error: "" });

const sessionJsonArtifact = computed(() =>
  artifacts.value.find((artifact) => artifact.kind === "session-json" && artifact.id)
);

const listArtifacts = computed(() =>
  artifacts.value.filter((artifact) => artifact.kind !== "session-json")
);

const sessionJsonStatus = computed(() => {
  if (sessionJsonArtifact.value?.status === "ready") return "ready";
  if (currentSession.value?.status && currentSession.value.status !== "ended") return "capturing";
  return "missing";
});

const sessionJsonLabel = computed(() => {
  if (sessionJsonStatus.value === "ready") return "Ready to download";
  if (sessionJsonStatus.value === "capturing") return "Capturing — available after stop";
  return "Not generated yet";
});

const sessionJsonSize = computed(() => {
  if (!sessionJsonArtifact.value?.byte_size) return "";
  return formatBytes(sessionJsonArtifact.value.byte_size);
});

const sessionJsonDownload = computed(() => {
  if (!sessionJsonArtifact.value?.id) return "";
  return `${apiBase.value}/artifacts/${sessionJsonArtifact.value.id}?auth_token=${encodeURIComponent(authToken.value || "")}`;
});

const storageLabel = computed(() => {
  const backend = currentSession.value?.storage_backend;
  if (!backend) return "Storage: unknown";
  return backend === "gcs" ? "Storage: Google Cloud Storage" : "Storage: local";
});

const canRebuild = computed(() => {
  return currentSession.value?.status === "ended" && sessionJsonStatus.value !== "ready";
});

const chunkStats = computed(() => {
  const total = chunks.value.length;
  const ready = chunks.value.filter((chunk) => chunk.status === "ready").length;
  const pending = Math.max(0, total - ready);

  if (!total) {
    if (currentSession.value?.status === "ended") {
      return { state: "missing", label: "No video chunks uploaded", hint: "Recordings store video in chunks." };
    }
    return { state: "capturing", label: "Waiting for first chunk", hint: "Video starts once recording begins." };
  }

  if (pending > 0) {
    return {
      state: "pending",
      label: `${ready} of ${total} chunks ready`,
      hint: "Uploads finish after the session stops."
    };
  }

  return { state: "ready", label: `${ready} chunks ready`, hint: "Video playback is available above." };
});

const videoChunk = computed(() => {
  if (!chunks.value.length) return null;
  return chunks.value.find((chunk) => chunk.status === "ready" && chunk.gcs_uri) || null;
});

const videoDownloadUrl = computed(() => sessionsStore.chunkDownloadUrl(videoChunk.value?.id));

const videoDownloadLabel = computed(() => {
  if (videoChunk.value?.status === "ready") return "Download video";
  if (currentSession.value?.status === "ended") return "Video not ready yet";
  return "Video available after stop";
});

async function rebuildSessionJson() {
  if (!currentSession.value?.id || rebuildState.value.loading) return;
  rebuildState.value = { loading: true, error: "" };
  try {
    await sessionsStore.rebuildSessionJson(currentSession.value.id);
  } catch (err) {
    rebuildState.value = {
      loading: false,
      error: err?.message || "Failed to generate session JSON."
    };
    return;
  }
  rebuildState.value = { loading: false, error: "" };
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}
</script>

<template>
  <div class="artifacts-tab">
    <section class="overview-card">
      <div class="overview-header">
        <div>
          <p class="overview-kicker">Session exports</p>
          <h3 class="overview-title">Recording assets</h3>
          <p class="overview-subtitle">Files generated from this session for review and sharing.</p>
          <p class="overview-meta">{{ storageLabel }}</p>
        </div>
      </div>

      <div class="overview-rows">
        <div class="overview-row">
          <div class="row-main">
            <div class="row-title">Session events (JSON)</div>
            <div class="row-meta">
              <span class="status-dot" :data-status="sessionJsonStatus"></span>
              <span>{{ sessionJsonLabel }}</span>
              <span v-if="sessionJsonSize">• {{ sessionJsonSize }}</span>
            </div>
          </div>
          <div class="row-actions">
            <Button
              v-if="sessionJsonArtifact?.id"
              label="Download JSON"
              icon="pi pi-download"
              size="small"
              outlined
              as="a"
              :href="sessionJsonDownload"
              target="_blank"
            />
            <Button
              v-else-if="canRebuild"
              :label="rebuildState.loading ? 'Generating...' : 'Generate JSON'"
              icon="pi pi-refresh"
              size="small"
              outlined
              :disabled="rebuildState.loading"
              @click="rebuildSessionJson"
            />
          </div>
        </div>

        <div class="overview-row">
          <div class="row-main">
            <div class="row-title">Video timeline</div>
            <div class="row-meta">
              <span class="status-dot" :data-status="chunkStats.state"></span>
              <span>{{ chunkStats.label }}</span>
            </div>
          </div>
          <div class="row-actions">
            <Button
              v-if="videoDownloadUrl"
              label="Download video"
              icon="pi pi-download"
              size="small"
              outlined
              as="a"
              :href="videoDownloadUrl"
              target="_blank"
            />
            <span v-else class="row-hint">{{ videoDownloadLabel }}</span>
          </div>
        </div>
      </div>

      <Message v-if="rebuildState.error" severity="warn" :closable="false" class="overview-error">
        {{ rebuildState.error }}
      </Message>
    </section>

    <div v-if="listArtifacts.length" class="cards-grid">
      <Card v-for="artifact in listArtifacts" :key="artifact.id || artifact.kind" class="artifact-card">
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
      No additional artifacts yet.
    </Message>
  </div>
</template>

<style scoped>
.overview-card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: linear-gradient(150deg, rgba(148, 163, 184, 0.12), transparent 70%), var(--bg-base);
  margin-bottom: var(--space-5);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.overview-kicker {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 var(--space-1);
}

.overview-title {
  margin: 0 0 var(--space-1);
  font-size: 18px;
}

.overview-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.overview-meta {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.overview-rows {
  display: grid;
  gap: var(--space-3);
}

.overview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.row-title {
  font-weight: 600;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: 13px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.row-hint {
  color: var(--text-muted);
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
  box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.08);
}

.status-dot[data-status="ready"] {
  background: var(--success);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
}

.status-dot[data-status="pending"] {
  background: var(--warning);
  box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.18);
}

.status-dot[data-status="capturing"] {
  background: var(--info);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);
}

.status-dot[data-status="missing"] {
  background: var(--text-muted);
  box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.18);
}

.overview-error {
  margin-top: var(--space-3);
}

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
