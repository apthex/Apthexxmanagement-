const base = (process.env.SMOKE_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);

const checks = [
  {
    name: "health endpoint reports a connected database",
    path: "/api/health",
    expect: (status, body) => status === 200 && body.ok === true && body.database === "connected",
  },
  {
    name: "public config returns supported languages and no secrets",
    path: "/api/config",
    expect: (status, body) =>
      status === 200 &&
      Array.isArray(body.languages) &&
      body.languages.length > 0 &&
      !("sessionSecret" in body) &&
      !("resendApiKey" in body),
  },
  {
    name: "unknown institute codes are rejected",
    path: "/api/institutes/validate?code=SMOKE404",
    expect: (status) => status === 404,
  },
  {
    name: "staff endpoints require authentication",
    path: "/api/complaints",
    expect: (status) => status === 401,
  },
];

let failed = 0;
for (const check of checks) {
  try {
    const response = await fetch(`${base}${check.path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => null);
    const ok = check.expect(response.status, body);
    console.log(`${ok ? "PASS" : "FAIL"}  ${check.name}`);
    if (!ok) {
      failed += 1;
      console.log(`      HTTP ${response.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${check.name} — ${error.message}`);
  }
}

if (failed) {
  console.error(`\nSmoke test failed (${failed}/${checks.length}). Is the API running at ${base}?`);
  process.exit(1);
}
console.log(`\nSmoke test passed (${checks.length}/${checks.length}) at ${base}.`);
