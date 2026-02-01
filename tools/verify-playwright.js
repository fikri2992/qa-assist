#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode || 0, headers: res.headers, body: bodyText });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login(apiBase, email, password) {
  const url = `${apiBase.replace(/\/$/, "")}/auth/login`;
  const payload = JSON.stringify({ email, password });
  const res = await request("POST", url, { "Content-Type": "application/json" }, payload);
  if (res.status !== 200) {
    throw new Error(`Login failed (${res.status}): ${res.body.slice(0, 200)}`);
  }
  const data = JSON.parse(res.body);
  return data.token;
}

async function downloadArtifact(apiBase, sessionId, token) {
  const url = `${apiBase.replace(/\/$/, "")}/artifacts/playwright-${sessionId}`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await request("GET", url, headers);
  if (res.status !== 200) {
    throw new Error(`Artifact download failed (${res.status}): ${res.body.slice(0, 200)}`);
  }
  return res.body;
}

async function run() {
  const args = parseArgs(process.argv);
  const sessionId = args.session || args._[0];
  if (!sessionId) {
    console.error("Usage: node tools/verify-playwright.js --session <id> [--api <base>] [--token <token>]");
    process.exit(1);
  }

  const apiBase = args.api || process.env.QA_API_BASE || "http://localhost:4000/api";
  let token = args.token || process.env.QA_AUTH_TOKEN || "";
  const email = args.email || process.env.QA_AUTH_EMAIL || "";
  const password = args.password || process.env.QA_AUTH_PASSWORD || "";

  if (!token && email && password) {
    token = await login(apiBase, email, password);
  }
  if (!token) {
    console.error("Missing auth token. Set QA_AUTH_TOKEN or provide --email/--password.");
    process.exit(1);
  }

  const script = await downloadArtifact(apiBase, sessionId, token);
  const outPath = path.join(os.tmpdir(), `qa-assist-repro-${sessionId}.spec.js`);
  fs.writeFileSync(outPath, script, "utf-8");
  console.log(`Saved Playwright script to ${outPath}`);

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npxCmd, ["playwright", "test", outPath, "--reporter=line"], {
    stdio: "inherit",
  });
  process.exit(result.status === null ? 1 : result.status);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
