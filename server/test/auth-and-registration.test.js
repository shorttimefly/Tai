const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const serverDir = path.resolve(__dirname, "..");
const tempDir = path.join(__dirname, ".tmp");
fs.mkdirSync(tempDir, { recursive: true });

const children = new Set();

after(async () => {
  await Promise.all([...children].map(stopServer));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function reservePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startServer({ production = false } = {}) {
  const port = await reservePort();
  const dbFile = `test/.tmp/tai-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DB_FILE: dbFile,
      NODE_ENV: production ? "production" : "test",
      DEMO_SEED_ENABLED: "false",
      JWT_SECRET: production ? "" : "test-only-jwt-secret-that-is-long-enough",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  const output = [];
  child.logs = output;
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  if (production) {
    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ exited: false, output: output.join("") }), 700);
      child.once("exit", (code) => {
        clearTimeout(timeout);
        resolve({ exited: true, code, output: output.join("") });
      });
    });
    if (!result.exited) {
      await stopServer(child);
    }
    return { ...result, child };
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start: ${output.join("")}`)), 3000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited early (${code}): ${output.join("")}`));
    });
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("API ready:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return {
    child,
    baseUrl: `http://127.0.0.1:${port}`,
    dbPath: path.join(serverDir, dbFile),
  };
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      return resolve();
    }
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 1000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function api(server, pathname, { method = "GET", token, body } = {}) {
  const response = await fetch(`${server.baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

function query(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get(sql, params, (error, row) => {
      db.close();
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function execute(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(sql, params, function onRun(error) {
      db.close();
      if (error) return reject(error);
      resolve(this);
    });
  });
}

test("password-only auth, explicit demo seed, and registration safety", async () => {
  const production = await startServer({ production: true });
  assert.equal(production.exited, true, "production must reject a missing JWT_SECRET");
  assert.notEqual(production.code, 0);

  const server = await startServer();
  const demoCount = await query(server.dbPath, "SELECT COUNT(*) AS total FROM users WHERE email LIKE '%@tai.demo'");
  assert.equal(demoCount.total, 0, "demo users must not be inserted unless explicitly enabled");

  const sendCode = await api(server, "/api/v1/auth/send-code", {
    method: "POST",
    body: { account: "member@example.com" },
  });
  assert.equal(sendCode.status, 404, "verification-code flow must not exist");

  const registrations = await Promise.all(
    ["one", "two", "three"].map((name) =>
      api(server, "/api/v1/auth/register", {
        method: "POST",
        body: {
          account: `${name}@example.com`,
          password: "correct-horse-battery-staple",
          nickname: `用户${name}`,
        },
      })
    )
  );
  assert.ok(registrations.every((result) => result.status === 200));

  const firstUser = await query(server.dbPath, "SELECT * FROM users WHERE email = ?", ["one@example.com"]);
  assert.match(firstUser.password_hash, /^\$argon2id\$/);
  assert.equal(firstUser.password_salt, null, "Argon2id records do not retain a separate salt column");

  const login = await api(server, "/api/v1/auth/login", {
    method: "POST",
    body: { account: "one@example.com", password: "correct-horse-battery-staple" },
  });
  assert.equal(
    login.status,
    200,
    `account and password login remains supported: ${JSON.stringify(login.body)}\n${server.child.logs.join("")}`
  );

  const event = await execute(
    server.dbPath,
    "INSERT INTO events (title, summary, start_time, end_time, location_name, capacity, signup_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      "并发安全报名测试",
      "仅用于测试",
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      "测试场地",
      1,
      "manual",
      "published",
      firstUser.id,
    ]
  );
  const eventId = event.lastID;
  const tokens = registrations.slice(0, 2).map((result) => result.body.data.accessToken);

  const concurrent = await Promise.all(
    tokens.map((token) => api(server, `/api/v1/events/${eventId}/register`, { method: "POST", token }))
  );
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [200, 409],
    "a one-seat event permits exactly one concurrent registration"
  );
  const confirmed = await query(
    server.dbPath,
    "SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status = 'registered'",
    [eventId]
  );
  assert.equal(confirmed.total, 1);

  const winner = concurrent.find((result) => result.status === 200);
  const winnerToken = tokens[concurrent.indexOf(winner)];
  const duplicateCancellation = await Promise.all(
    [
      api(server, `/api/v1/events/${eventId}/register`, { method: "DELETE", token: winnerToken }),
      api(server, `/api/v1/events/${eventId}/register`, { method: "DELETE", token: winnerToken }),
    ]
  );
  assert.ok(
    duplicateCancellation.every((result) => [200, 404].includes(result.status)),
    "duplicate cancellation must be safe and never fail as an internal error"
  );
  const remaining = await query(
    server.dbPath,
    "SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status = 'registered'",
    [eventId]
  );
  assert.equal(remaining.total, 0);
});
