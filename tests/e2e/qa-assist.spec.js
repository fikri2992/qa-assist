const path = require('path');
const http = require('http');
const { test, expect, chromium } = require('@playwright/test');

const API_BASE = process.env.QA_API_BASE || 'http://127.0.0.1:4000/api';

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
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Test Page</h1>
      <label for="nameInput">Name</label>
      <input id="nameInput" type="text" />
      <button id="saveBtn">Save</button>
      <div id="result"></div>
    </div>
    <script>
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

async function pollUntil(fn, timeoutMs, intervalMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for condition');
}

test('records a full session with extension + backend + AI', async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
  const serverUrl = 'http://127.0.0.1:4174/';

  const extensionPath = path.join(__dirname, '..', '..', 'extension');
  const userDataDir = path.join(__dirname, '..', '..', '.playwright-user-data');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const appPage = await context.newPage();
    await appPage.goto(serverUrl, { waitUntil: 'domcontentloaded' });

    const worker = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent('serviceworker');

    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    await popup.click('#mainBtn');
    await popup.waitForFunction(() => {
      const label = document.querySelector('.btn-label');
      return label && label.textContent.includes('Stop');
    });

    await appPage.click('#nameInput');
    await appPage.type('#nameInput', 'Alice');
    await appPage.click('#saveBtn');
    await appPage.mouse.wheel(0, 400);

    const deviceInfo = await popup.evaluate(() => new Promise((resolve) => {
      chrome.storage.local.get(['qa_device_id', 'qa_device_secret'], resolve);
    }));

    await popup.click('#mainBtn');
    await popup.waitForFunction(() => {
      const label = document.querySelector('.btn-label');
      return label && label.textContent.includes('Start');
    });

    const headers = {
      'x-device-id': deviceInfo.qa_device_id,
      'x-device-secret': deviceInfo.qa_device_secret,
    };

    const session = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions?device_id=${deviceInfo.qa_device_id}`, { headers });
      if (!res.ok()) return null;
      const sessions = await res.json();
      if (!Array.isArray(sessions) || sessions.length === 0) return null;
      const latest = sessions[0];
      return latest.status === 'ended' ? latest : null;
    }, 60000, 1500);

    const sessionDetail = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions/${session.id}`, { headers });
      if (!res.ok()) return null;
      const data = await res.json();
      if (!data.chunks || data.chunks.length === 0) return null;
      const chunk = data.chunks[0];
      if (chunk.status !== 'ready') return null;
      return data;
    }, 60000, 1500);

    const eventsRes = await context.request.get(`${API_BASE}/sessions/${session.id}/events?limit=1000`, { headers });
    const events = await eventsRes.json();

    expect(sessionDetail.chunks.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);

    const analysis = await pollUntil(async () => {
      const res = await context.request.get(`${API_BASE}/sessions/${session.id}/analysis`, { headers });
      if (!res.ok()) return null;
      const data = await res.json();
      return data.status === 'done' ? data : null;
    }, 90000, 2000);

    expect(analysis.status).toBe('done');
  } finally {
    await context.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
