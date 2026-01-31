<script setup>
import { ref, computed } from "vue";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import Button from "primevue/button";

const sessionsStore = useSessionsStore();
const { chunks, currentChunkIndex, currentChunk, currentSession, events } = storeToRefs(sessionsStore);

const videoRef = ref(null);

const videoUrl = computed(() => currentChunk.value?.video_url || "");

// Timeline calculations
const timelineSegments = computed(() => {
  if (!chunks.value.length) return [];
  
  const { start, end } = getSessionWindow();
  const total = Math.max(end - start, 1);

  return chunks.value.map((chunk, index) => {
    const duration = getDuration(chunk, 1);
    return {
      width: (duration / total) * 100,
      active: index === currentChunkIndex.value,
      index,
    };
  });
});

const timelinePins = computed(() => {
  if (!chunks.value.length) return [];
  
  const { start, end } = getSessionWindow();
  const total = Math.max(end - start, 1);

  return events.value
    .filter((e) => e.ts && (e.type === "marker" || e.type === "annotation"))
    .map((event) => {
      const time = new Date(event.ts).getTime();
      const left = ((time - start) / total) * 100;
      return {
        left: Math.max(0, Math.min(100, left)),
        type: event.type,
        label: event.type === "annotation" ? event.payload?.text : "Marker",
      };
    })
    .filter((pin) => pin.left >= 0 && pin.left <= 100);
});

function getSessionWindow() {
  const timestamps = [];
  if (currentSession.value?.started_at) timestamps.push(new Date(currentSession.value.started_at).getTime());
  if (currentSession.value?.ended_at) timestamps.push(new Date(currentSession.value.ended_at).getTime());
  
  chunks.value.forEach((chunk) => {
    if (chunk.start_ts) timestamps.push(new Date(chunk.start_ts).getTime());
    if (chunk.end_ts) timestamps.push(new Date(chunk.end_ts).getTime());
  });

  events.value.forEach((event) => {
    if (event.ts) timestamps.push(new Date(event.ts).getTime());
  });

  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);
  
  return {
    start: Number.isFinite(start) ? start : Date.now(),
    end: Number.isFinite(end) ? end : Date.now() + 1,
  };
}

function getDuration(chunk, fallback) {
  if (chunk.start_ts && chunk.end_ts) {
    const start = new Date(chunk.start_ts).getTime();
    const end = new Date(chunk.end_ts).getTime();
    const duration = end - start;
    return duration > 0 ? duration : fallback;
  }
  return fallback;
}

function handleVideoEnded() {
  sessionsStore.nextChunk();
}

function selectChunk(index) {
  sessionsStore.setCurrentChunk(index);
}
</script>

<template>
  <section class="video-section">
    <div class="video-container">
      <video
        ref="videoRef"
        :src="videoUrl"
        controls
        playsinline
        class="video-player"
        @ended="handleVideoEnded"
      />
    </div>

    <!-- Timeline -->
    <div class="timeline-container">
      <div class="timeline-track">
        <div
          v-for="segment in timelineSegments"
          :key="segment.index"
          class="timeline-segment"
          :style="{ width: segment.width + '%' }"
          :class="{ active: segment.active }"
          @click="selectChunk(segment.index)"
        />
      </div>
      <div class="timeline-pins">
        <div
          v-for="(pin, i) in timelinePins"
          :key="i"
          class="timeline-pin"
          :class="pin.type"
          :style="{ left: `calc(${pin.left}% - 4px)` }"
          :title="pin.label"
        />
      </div>
    </div>

    <!-- Chunk Pills -->
    <div class="chunk-list">
      <Button
        v-for="(chunk, index) in chunks"
        :key="chunk.id"
        :label="`#${chunk.idx} · ${chunk.status}`"
        :outlined="index !== currentChunkIndex"
        :severity="index === currentChunkIndex ? 'primary' : 'secondary'"
        size="small"
        @click="selectChunk(index)"
      />
    </div>
  </section>
</template>

<style scoped>
.video-section {
  padding: var(--space-5);
  background: var(--bg-base);
}

.video-container {
  position: relative;
  background: #000;
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 16 / 9;
  max-height: 55vh;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.timeline-container {
  position: relative;
  height: 36px;
  margin-top: var(--space-4);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.timeline-track {
  display: flex;
  height: 100%;
}

.timeline-segment {
  height: 100%;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.15s;
}

.timeline-segment:hover {
  background: var(--bg-hover);
}

.timeline-segment.active {
  background: var(--accent-soft);
}

.timeline-pins {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.timeline-pin {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: var(--warning);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--warning);
}

.timeline-pin.annotation {
  background: var(--info);
  box-shadow: 0 0 6px var(--info);
}

.chunk-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
