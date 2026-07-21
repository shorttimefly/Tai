const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const dbFile = path.join(__dirname, "..", process.env.DB_FILE || "../data/app.db");
const resolvedDbFile = path.resolve(dbFile);
const dbDir = path.dirname(resolvedDbFile);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(resolvedDbFile);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function initializeSchema() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  return run("PRAGMA foreign_keys = ON;")
    .then(() => run("PRAGMA journal_mode = WAL;"))
    .then(() => run("PRAGMA busy_timeout = 5000;"))
    .then(async () => {
      const statements = schema
        .split(";")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => `${item};`);
      for (const statement of statements) {
        await run(statement);
      }
    });
}

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = {
  db,
  run,
  get,
  all,
  initializeSchema,
  closeDb,
  hashToken,
  resolvedDbFile,
};
