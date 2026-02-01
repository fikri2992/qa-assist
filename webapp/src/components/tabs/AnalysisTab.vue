<script setup>
import { computed } from "vue";
import { useSessionsStore } from "../../stores/sessions";
import { storeToRefs } from "pinia";
import Tag from "primevue/tag";
import Card from "primevue/card";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Message from "primevue/message";

const sessionsStore = useSessionsStore();
const { analysis, issues } = storeToRefs(sessionsStore);

const status = computed(() => analysis.value?.status || "pending");
const summary = computed(() => analysis.value?.summary || "No analysis available yet.");

const statusSeverity = computed(() => {
  if (status.value === "done") return "success";
  if (status.value === "failed") return "danger";
  if (status.value === "running") return "info";
  return "secondary";
});

const severityCounts = computed(() => {
  const breakdown = analysis.value?.final_report?.severity_breakdown;
  const analyses = Array.isArray(analysis.value?.analyses) ? analysis.value.analyses : [];
  const allIssues = analyses.flatMap((item) => item.report?.issues || []);
  
  const counts = breakdown || countSeverity(allIssues);
  
  return [
    { key: "high", count: counts.high || 0, severity: "danger" },
    { key: "medium", count: counts.medium || 0, severity: "warn" },
    { key: "low", count: counts.low || 0, severity: "success" },
  ].filter((b) => b.count > 0);
});

const autonomyEntries = computed(() => {
  const analyses = Array.isArray(analysis.value?.analyses) ? analysis.value.analyses : [];
  const entries = [];
  
  analyses.forEach((item) => {
    const agents = item.report?.agents;
    if (!Array.isArray(agents)) return;
    agents.forEach((agent) => {
      entries.push({
        chunkId: item.chunk_id,
        name: agent.name,
        summary: agent.summary || "",
      });
    });
  });
  
  return entries;
});

const showAutonomyEmpty = computed(() => status.value === "done" && autonomyEntries.value.length === 0);

const rawReport = computed(() => {
  if (!analysis.value?.final_report) return "";
  return JSON.stringify(analysis.value.final_report, null, 2);
});

function countSeverity(issues) {
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  issues.forEach((issue) => {
    const severity = String(issue.severity || "unknown").toLowerCase();
    if (counts[severity] !== undefined) {
      counts[severity]++;
    } else {
      counts.unknown++;
    }
  });
  return counts;
}

function getSeverity(severity) {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warn";
  if (severity === "low") return "success";
  return "secondary";
}
</script>

<template>
  <div class="analysis-tab">
    <!-- Summary -->
    <div class="analysis-header">
      <div class="analysis-summary">
        <Tag :value="status" :severity="statusSeverity" />
        <p class="summary-text">{{ summary }}</p>
      </div>
      <div class="severity-badges">
        <Tag
          v-for="badge in severityCounts"
          :key="badge.key"
          :value="`${badge.key}: ${badge.count}`"
          :severity="badge.severity"
        />
      </div>
    </div>

    <!-- Issues -->
    <div class="issues-grid">
      <Card v-for="(issue, i) in issues.slice(0, 12)" :key="i" class="issue-card">
        <template #title>
          <div class="issue-header">
            <Tag
              :value="issue.severity || 'unknown'"
              :severity="getSeverity(issue.severity)"
              size="small"
            />
            <span>{{ issue.title || "Issue" }}</span>
          </div>
        </template>
        <template #content>
          <p class="issue-body">{{ issue.detail || issue.message || "" }}</p>
          <p class="issue-meta">{{ issue.source || issue.type || "" }}</p>
        </template>
      </Card>
      <Message v-if="!issues.length" severity="info" :closable="false">
        No issues flagged yet.
      </Message>
    </div>

    <!-- Raw Report -->
    <Accordion v-if="rawReport" class="raw-accordion">
      <AccordionPanel value="0">
        <AccordionHeader>Raw Report</AccordionHeader>
        <AccordionContent>
          <pre class="code-block">{{ rawReport }}</pre>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <!-- Agent Timeline -->
    <div v-if="autonomyEntries.length" class="autonomy-section">
      <h3 class="subsection-title">
        <i class="pi pi-sitemap"></i>
        Agent Timeline
      </h3>
      <div class="autonomy-list">
        <Card v-for="(entry, i) in autonomyEntries" :key="i" class="autonomy-card">
          <template #title>{{ entry.name || "agent" }}</template>
          <template #subtitle>{{ entry.chunkId }}</template>
          <template #content>
            <p>{{ entry.summary }}</p>
          </template>
        </Card>
      </div>
    </div>
    <Message v-else-if="showAutonomyEmpty" severity="info" :closable="false">
      Agent timeline is empty. Enable ADK (set `GOOGLE_API_KEY`) and re-run a session to populate it.
    </Message>
  </div>
</template>

<style scoped>
.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}

.analysis-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.summary-text {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.severity-badges {
  display: flex;
  gap: var(--space-2);
}

.issues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.issue-card {
  background: var(--bg-base);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
}

.issue-body {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.issue-meta {
  margin: var(--space-2) 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.raw-accordion {
  margin-top: var(--space-5);
}

.code-block {
  background: var(--bg-base);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.autonomy-section {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-subtle);
}

.subsection-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
  font-size: 14px;
  font-weight: 600;
}

.autonomy-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.autonomy-card {
  background: var(--bg-base);
}
</style>
