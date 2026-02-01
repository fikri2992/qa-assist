const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { test, expect, chromium } = require('@playwright/test');

const STATE_FILE = path.join(__dirname, '.e2e-state.json');
const DEBUG = process.env.QA_E2E_DEBUG === '1';
const VISUAL = process.env.QA_E2E_VISUAL === '1' || DEBUG;
const AUTH_EMAIL = process.env.QA_E2E_EMAIL || 'demo@qaassist.local';
const AUTH_PASSWORD = process.env.QA_E2E_PASSWORD || 'demo123';
const E2E_CHUNK_MS = process.env.QA_E2E_CHUNK_MS
  ? Number(process.env.QA_E2E_CHUNK_MS)
  : 3000;
const E2E_RECORD_MS = process.env.QA_E2E_RECORD_MS
  ? Number(process.env.QA_E2E_RECORD_MS)
  : 5000;
const REQUIRE_REAL_CAPTURE = process.env.QA_E2E_REQUIRE_REAL_CAPTURE === '1';
const API_BASE = (() => {
  if (process.env.QA_API_BASE) return process.env.QA_API_BASE;
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data.apiBase) return data.apiBase;
    } catch {
      // ignore
    }
  }
  return 'http://127.0.0.1:4000/api';
})();

const WEBAPP_URL = (() => {
  if (process.env.QA_WEBAPP_URL) return process.env.QA_WEBAPP_URL;
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data.webappUrl) return data.webappUrl;
    } catch {
      // ignore
    }
  }
  return 'http://127.0.0.1:5173';
})();

function createTestServer() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QA Assist Test Page</title>
    <style>
      body { font-family: sans-serif; padding: 24px; }
      .card { padding: 16px; border: 1px solid #ccc; border-radius: 8px; width: 360px; }
      button { padding: 8px 12px; }
      #qa-observer {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 320px;
        max-height: 40vh;
        background: rgba(15, 23, 42, 0.95);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        z-index: 2147483647;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
        overflow: hidden;
        pointer-events: none;
      }
      #qa-observer-header {
        padding: 6px 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        background: rgba(30, 41, 59, 0.9);
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      }
      #qa-observer-body {
        max-height: calc(40vh - 28px);
        overflow: auto;
        padding: 8px 10px;
        display: grid;
        gap: 4px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div id="qa-observer">
      <div id="qa-observer-header">QA Assist Observer</div>
      <div id="qa-observer-body"></div>
    </div>
    <div class="card">
      <h1>Test Page</h1>
      <label for="nameInput">Name</label>
      <input id="nameInput" data-test="name-input" type="text" />
      <button id="saveBtn" data-test="save-btn">Save</button>
      <div id="result" data-test="result"></div>
    </div>
    <script>
      (function () {
        const body = document.getElementById('qa-observer-body');
        window.__qaObserver = {
          log(message) {
            if (!body) return;
            const line = document.createElement('div');
            line.textContent = new Date().toISOString() + ' ' + message;
            body.appendChild(line);
            body.scrollTop = body.scrollHeight;
          }
        };
        window.__qaObserver.log('Test page ready');
      })();

      const btn = document.getElementById('saveBtn');
      const input = document.getElementById('nameInput');
      const result = document.getElementById('result');
      btn.addEventListener('click', async () => {
        console.error('QA Assist synthetic error');
        try {
          await fetch('/missing');
        } catch (err) {
          console.warn('fetch failed', err);
        }
        result.textContent = 'Saved: ' + input.value;
      });
    </script>
  </body>
</html>`;

  const server = http.createServer((req, res) => {
    if (req.url === '/missing') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  return server;
}

async function pollUntil(fn, timeoutMs, intervalMs, label, page) {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    if (label && Date.now() - lastLog > 5000) {
      await logStep(`waiting for ${label}...`, page);
      lastLog = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for condition');
}

function attachPageLogging(page, label) {
  if (!DEBUG) return;
  page.on('console', (msg) => {
    console.log(`[${label} console] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[${label} error] ${err.message}`);
  });
}

async function logStep(message, page) {
  const line = `[e2e] ${new Date().toISOString()} ${message}`;
  console.log(line);
  if (page) {
    try {
      await page.evaluate((msg) => {
        window.__qaObserver?.log?.(msg);
      }, message);
    } catch {
      // page may be closed or not ready
    }
  }
}

async function getServiceWorker(context, extensionId) {
  const existing = context.serviceWorkers().find((sw) => {
    try {
      return new URL(sw.url()).host === extensionId;
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  return context.waitForEvent('serviceworker');
}

let cachedExtensionPage = null;

async function getExtensionPage(context, extensionId) {
  const url = `chrome-extension://${extensionId}/popup.html`;
  if (cachedExtensionPage && !cachedExtensionPage.isClosed()) {
    return cachedExtensionPage;
  }
  const existing = context.pages().find((page) => page.url().startsWith(url));
  if (existing) {
    cachedExtensionPage = existing;
    return existing;
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  cachedExtensionPage = page;
  return page;
}

async function sendExtensionMessage(context, extensionId, message) {
  const page = await getExtensionPage(context, extensionId);
  return page.evaluate((msg) => new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: 'timeout' });
    }, 5000);
    chrome.runtime.sendMessage(msg, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    });
  }), message);
}

async function readDeviceInfo(context, extensionId) {
  const page = await getExtensionPage(context, extensionId);
  return page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get(['qa_device_id'], resolve);
  }));
}

async function readExtensionState(context, extensionId) {
  const page = await getExtensionPage(context, extensionId);
  return page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get(['qa_recording', 'qa_status', 'qa_session_id', 'qa_capture_mode'], resolve);
  }));
}

async function readDebugSynthetic(context, extensionId) {
  const page = await getExtensionPage(context, extensionId);
  return page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get(['qa_debug_synthetic', 'qa_debug_before_synth', 'qa_debug_received_chunks'], resolve);
  }));
}

async function readOffscreenState(context, extensionId) {
  const page = await getExtensionPage(context, extensionId);
  return page.evaluate(async () => {
    if (!chrome.offscreen?.hasDocument) return { supported: false };
    const exists = await chrome.offscreen.hasDocument();
    return { supported: true, exists };
  });
}

test('records a full session with extension + backend + AI', async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
  const serverUrl = 'http://127.0.0.1:4174/';

  const extensionPath = path.join(__dirname, '..', '..', 'extension');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-assist-e2e-'));

  const launchArgs = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ];
  if (VISUAL) {
    launchArgs.push('--auto-open-devtools-for-tabs');
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    devtools: VISUAL,
    slowMo: VISUAL ? 150 : 0,
    args: launchArgs,
  });

  try {
    await logStep('opening test page');
    const appPage = await context.newPage();
    attachPageLogging(appPage, 'app');
    await appPage.goto(serverUrl, { waitUntil: 'domcontentloaded' });

    await logStep('waiting for extension service worker', appPage);
    const worker = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent('serviceworker');

    const extensionId = new URL(worker.url()).host;
    await logStep(`extension id: ${extensionId}`, appPage);
    await getExtensionPage(context, extensionId);
    await logStep('logging in', appPage);
    const authRes = await context.request.post(`${API_BASE}/auth/login`, {
      data: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
    });
    if (!authRes.ok()) throw new Error(`Auth failed: ${authRes.status()}`);
    const authData = await authRes.json();
    const authToken = authData.token;
    const authPage = await getExtensionPage(context, extensionId);
    await authPage.evaluate(({ token, email, apiBase }) => {
      chrome.storage.local.set({ qa_auth_token: token, qa_auth_email: email, qa_api_base: apiBase });
    }, { token: authToken, email: AUTH_EMAIL, apiBase: API_BASE });

    await logStep('starting recording', appPage);
    await appPage.bringToFront();
    const streamInfo = await authPage.evaluate(() => new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab?.id) {
          resolve({ error: 'no_active_tab' });
          return;
        }
        chrome.tabCapture.getMediaStreamId({ consumerTabId: tab.id, targetTabId: tab.id }, (streamId) => {
          const err = chrome.runtime?.lastError;
          if (err || !streamId) {
            resolve({ error: err?.message || 'stream_id_failed' });
            return;
          }
          resolve({ streamId, tabId: tab.id });
        });
      });
    }));

    if (streamInfo?.error) {
      if (REQUIRE_REAL_CAPTURE) {
        throw new Error(`Failed to acquire streamId: ${streamInfo.error}`);
      }
      await logStep(`streamId unavailable (${streamInfo.error}); falling back to synthetic capture`, appPage);
    }

    await sendExtensionMessage(context, extensionId, {
      type: 'START',
      apiBase: API_BASE,
      debug: VISUAL,
      chunkDurationMs: E2E_CHUNK_MS,
      streamId: streamInfo?.streamId,
      captureTabId: streamInfo?.tabId
    });

    const offscreenState = await readOffscreenState(context, extensionId);
    await logStep(`offscreen document: ${JSON.stringify(offscreenState)}`, appPage);

    await logStep('waiting for recording state', appPage);
    await pollUntil(async () => {
      const state = await readExtensionState(context, extensionId);
      return state?.qa_recording && state?.qa_session_id ? state : null;
    }, 15000, 500, 'recording state', appPage);

    await logStep('performing interactions', appPage);
    await appPage.click('[data-test="name-input"]');
    if (VISUAL) await appPage.waitForTimeout(300);
    await appPage.type('[data-test="name-input"]', 'Alice');
    if (VISUAL) await appPage.waitForTimeout(300);
    await appPage.click('[data-test="save-btn"]');
    if (VISUAL) await appPage.waitForTimeout(300);
    await appPage.mouse.wheel(0, 400);

    await logStep(`waiting ${E2E_RECORD_MS}ms before stop`, appPage);
    await appPage.waitForTimeout(E2E_RECORD_MS);

    await logStep('reading device credentials', appPage);
    const deviceInfo = await pollUntil(
      () => readDeviceInfo(context, extensionId),
      15000,
      500,
      'device credentials',
      appPage
    );

    await logStep('stopping recording', appPage);
    await appPage.bringToFront();
    await sendExtensionMessage(context, extensionId, { type: 'STOP' });

    await logStep('waiting for extension to reset', appPage);
    await pollUntil(async () => {
      const state = await readExtensionState(context, extensionId);
      if (!state) return null;
      return !state.qa_recording && !state.qa_session_id ? state : null;
    }, 15000, 500, 'extension reset', appPage);

    const captureState = await readExtensionState(context, extensionId);
    if (streamInfo?.streamId) {
      expect(captureState?.qa_capture_mode).toBe('real');
    } else if (REQUIRE_REAL_CAPTURE) {
      expect(captureState?.qa_capture_mode).toBe('real');
    } else {
      expect(['fake', 'real', null]).toContain(captureState?.qa_capture_mode);
    }

    await appPage.waitForTimeout(2500);
    const syntheticStatus = await readDebugSynthetic(context, extensionId);
    await logStep(
      `synthetic chunk status: ${syntheticStatus?.qa_debug_synthetic || 'none'} | before=${syntheticStatus?.qa_debug_before_synth ?? 'n/a'} | received=${syntheticStatus?.qa_debug_received_chunks ?? 'n/a'}`,
      appPage
    );

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    await logStep('polling for ended session', appPage);
    const session = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions`, { headers });
      if (!res.ok()) return null;
      const sessions = await res.json();
      if (!Array.isArray(sessions) || sessions.length === 0) return null;
      const latest = sessions[0];
      return latest.status === 'ended' ? latest : null;
    }, 60000, 1500, 'session ended', appPage);

    await logStep('polling for ready chunk', appPage);
    const sessionDetail = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions/${session.id}`, { headers });
      if (!res.ok()) return null;
      const data = await res.json();
      if (!data.chunks || data.chunks.length === 0) return null;
      const chunk = data.chunks[0];
      if (chunk.status !== 'ready') return null;
      return data;
    }, 60000, 1500, 'chunk ready', appPage);

    await logStep('fetching events', appPage);
    const eventsRes = await context.request.get(`${API_BASE}/sessions/${session.id}/events?limit=1000`, { headers });
    const events = await eventsRes.json();

    expect(sessionDetail.chunks.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);

    await logStep('fetching artifacts', appPage);
    const artifactsRes = await context.request.get(`${API_BASE}/sessions/${session.id}/artifacts`, { headers });
    const artifacts = await artifactsRes.json();
    const sessionJson = artifacts.find((artifact) => artifact.kind === 'session-json' && artifact.id);
    expect(sessionJson).toBeTruthy();

    await logStep('downloading session json artifact', appPage);
    const artifactRes = await context.request.get(`${API_BASE}/artifacts/${sessionJson.id}`, { headers });
    let downloadRes = artifactRes;
    if (artifactRes.status() === 302) {
      const location = artifactRes.headers()['location'];
      const baseUrl = API_BASE.replace(/\/api\/?$/, '');
      const targetUrl = location.startsWith('http') ? location : `${baseUrl}${location}`;
      downloadRes = await context.request.get(targetUrl, { headers });
    }
    expect(downloadRes.ok()).toBeTruthy();
    const jsonText = await downloadRes.text();
    const parsed = JSON.parse(jsonText);
    expect(parsed.events?.length).toBeGreaterThan(0);

    await logStep('opening session in webapp', appPage);
    const dashboardPage = await context.newPage();
    await dashboardPage.addInitScript(({ token, email, apiBase }) => {
      localStorage.setItem('qa_auth_token', token);
      localStorage.setItem('qa_auth_email', email);
      localStorage.setItem('qa_api_base', apiBase);
    }, { token: authToken, email: AUTH_EMAIL, apiBase: API_BASE });
    await dashboardPage.goto(`${WEBAPP_URL}/sessions/${session.id}`, { waitUntil: 'domcontentloaded' });

    await logStep('opening artifacts tab', appPage);
    const artifactsTab = dashboardPage.locator('[role="tab"]', { hasText: 'Artifacts' });
    if (await artifactsTab.count()) {
      await artifactsTab.first().click();
    } else {
      await dashboardPage.getByText('Artifacts', { exact: false }).click();
    }

    await logStep('clicking Download JSON in webapp', appPage);
    const downloadLink = dashboardPage.locator('a:has-text("Download JSON"), button:has-text("Download JSON")').first();
    await downloadLink.waitFor({ state: 'visible', timeout: 15000 });
    const downloadHref = await downloadLink.getAttribute('href');
    expect(downloadHref).toBeTruthy();

    const popupPromise = dashboardPage
      .waitForEvent('popup', { timeout: 5000 })
      .catch(() => null);
    await downloadLink.click();
    const popup = await popupPromise;

    if (popup) {
      const popupUrl = popup.url();
      expect(popupUrl).toContain('session-');
      try {
        await popup.close();
      } catch {
        // ignore if already closed
      }
    }

    await logStep('verifying webapp download url', appPage);
    const resolvedUrl = downloadHref.startsWith('http')
      ? downloadHref
      : new URL(downloadHref, WEBAPP_URL).toString();
    const webDownload = await context.request.get(resolvedUrl, { headers });
    let webRes = webDownload;
    if (webDownload.status() === 302) {
      const location = webDownload.headers()['location'];
      const baseUrl = API_BASE.replace(/\/api\/?$/, '');
      const targetUrl = location.startsWith('http') ? location : `${baseUrl}${location}`;
      webRes = await context.request.get(targetUrl, { headers });
    }
    expect(webRes.ok()).toBeTruthy();
    const webJson = JSON.parse(await webRes.text());
    expect(webJson.events?.length).toBeGreaterThan(0);

    const eventCount = events.length;
    await logStep('sending post-stop interaction', appPage);
    await authPage.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'INTERACTION',
        event: {
          ts: new Date().toISOString(),
          type: 'interaction',
          payload: { source: 'e2e-post-stop' }
        }
      });
    });
    await appPage.waitForTimeout(1000);
    const eventsResAfter = await context.request.get(`${API_BASE}/sessions/${session.id}/events?limit=1000`, { headers });
    const eventsAfter = await eventsResAfter.json();
    expect(eventsAfter.length).toBe(eventCount);

    await logStep('polling for analysis', appPage);
    const analysis = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions/${session.id}/analysis`, { headers });
      if (!res.ok()) return null;
      const data = await res.json();
      return data.status === 'done' ? data : null;
    }, 90000, 2000, 'analysis done', appPage);

    expect(analysis.status).toBe('done');
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        // ignore already closed contexts
      }
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
