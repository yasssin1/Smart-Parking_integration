const express = require("express");
const Database = require("better-sqlite3");
const fs = require("fs");
const cors = require("cors");
const app = express();

app.use(cors({
    origin: "http://127.0.0.1:5500"  
}));
app.use(express.json());

// cree base donnee
const db = new Database("parking.db");
const schema = fs.readFileSync("./database/schema.sql", "utf-8");
db.exec(schema);

function nowIso() {
  return new Date().toISOString();
}

// ------------------
// --- VALIDATION ---
// ------------------
function isNumberOrNull(v) {
  return v === undefined || v === null || (typeof v === "number" && Number.isFinite(v));
}
function isIntOrNull(v) {
  return v === undefined || v === null || (Number.isInteger(v) && Number.isFinite(v));
}

// ---------------
// --- PLACES ----
// ---------------

// ajouter place
app.post("/places", (req, res) => {
  const { id, label, distance, threshold, debounce } = req.body || {};

  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ error: "INVALID_ID", message: "id is required (string)" });
  }

  if (!isNumberOrNull(distance)) {
    return res.status(400).json({ error: "INVALID_DISTANCE", message: "distance must be a number" });
  }
  if (!isNumberOrNull(threshold)) {
    return res.status(400).json({ error: "INVALID_THRESHOLD", message: "threshold must be a number" });
  }
  if (!isIntOrNull(debounce)) {
    return res.status(400).json({ error: "INVALID_DEBOUNCE", message: "debounce must be an integer" });
  }

  const stmt = db.prepare(`
    INSERT INTO spots (id, label, status, distance, threshold, debounce, updated_at)
    VALUES (?, ?, 'FREE', ?, ?, ?, ?)
  `);

  const ts = nowIso();

  try {
    stmt.run(
      id,
      label ?? id,
      distance ?? null,
      threshold ?? null,
      debounce ?? null,
      ts
    );

    return res.status(201).json({
      id,
      label: label ?? id,
      status: "FREE",
      distance: distance ?? null,
      threshold: threshold ?? null,
      debounce: debounce ?? null,
      updated_at: ts
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return res
        .status(409)
        .json({ error: "ALREADY_EXISTS", message: `Spot ${id} already exists` });
    }
    return res
      .status(500)
      .json({ error: "DB_ERROR", message: "Failed to create spot" });
  }
});

// requete liste de places
app.get("/places", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, label, status, distance, threshold, debounce, updated_at FROM spots ORDER BY id"
    )
    .all();
  res.json(rows);
});

// requete chercher place par {id}
app.get("/places/:id", (req, res) => {
  const row = db
    .prepare(
      "SELECT id, label, status, distance, threshold, debounce, updated_at FROM spots WHERE id = ?"
    )
    .get(req.params.id);

  if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "Spot not found" });
  res.json(row);
});

// requete chercher status place par {id}
app.get("/places/:id/status", (req, res) => {
  const row = db.prepare("SELECT status FROM spots WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "Spot not found" });
  res.json(row);
});

// change status d une place
// + accepte aussi (optionnel) distance/threshold/debounce pour mise a jour depuis JSON
app.put("/places/:id/status", (req, res) => {
  const { status, distance, threshold, debounce } = req.body || {};

  if (!["FREE", "OCCUPIED"].includes(status)) {
    return res.status(400).json({ error: "INVALID_STATUS" });
  }

  if (!isNumberOrNull(distance)) {
    return res.status(400).json({ error: "INVALID_DISTANCE", message: "distance must be a number" });
  }
  if (!isNumberOrNull(threshold)) {
    return res.status(400).json({ error: "INVALID_THRESHOLD", message: "threshold must be a number" });
  }
  if (!isIntOrNull(debounce)) {
    return res.status(400).json({ error: "INVALID_DEBOUNCE", message: "debounce must be an integer" });
  }

  const ts = nowIso();

  // Build dynamic update so we only overwrite fields if they are provided
  const sets = ["status = ?", "updated_at = ?"];
  const params = [status, ts];

  if (distance !== undefined) {
    sets.push("distance = ?");
    params.push(distance);
  }
  if (threshold !== undefined) {
    sets.push("threshold = ?");
    params.push(threshold);
  }
  if (debounce !== undefined) {
    sets.push("debounce = ?");
    params.push(debounce);
  }

  params.push(req.params.id);

  const info = db
    .prepare(`UPDATE spots SET ${sets.join(", ")} WHERE id = ?`)
    .run(...params);

  if (info.changes === 0) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Spot not found" });
  }

  const row = db
    .prepare(
      "SELECT id, label, status, distance, threshold, debounce, updated_at FROM spots WHERE id = ?"
    )
    .get(req.params.id);

  res.json(row);
});

// requete chercher liste place non occupee
app.get("/parking/available", (req, res) => {
  const rows = db.prepare("SELECT id FROM spots WHERE status='FREE'").all();
  res.json(rows);
});

// info generale {nbr total, nbr 'free', nbr 'occupee'}
app.get("/parking/state", (req, res) => {
  const r = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='FREE' THEN 1 ELSE 0 END) AS free,
        SUM(CASE WHEN status='OCCUPIED' THEN 1 ELSE 0 END) AS occupied
      FROM spots
    `)
    .get();

  res.json({
    total: r.total || 0,
    free: r.free || 0,
    occupied: r.occupied || 0,
  });
});

// delete functionality for places
app.delete("/places/:id", (req, res) => {
  const info = db.prepare("DELETE FROM spots WHERE id = ?").run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  res.json({ ok: true });
});

// -------------
// --- BARRIER --
// -------------

// chercher status barrier par id
app.get("/barrier/:id", (req, res) => {
  // schema uses "state", not "status"
  const row = db.prepare("SELECT state, updated_at FROM barriers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "Barrier not found" });
  res.json(row);
});

// fonction gerer barrier
function setBarrierState(id, state) {
  const ts = nowIso();
  const stmt = db.prepare(`
    INSERT INTO barriers (id, state, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at
  `);
  stmt.run(id, state, ts);
  return { id, state, updated_at: ts };
}

app.put("/barrier/:id/state", (req, res) => {
  const { state } = req.body || {};
  const allowed = ["OPENING", "OPENED", "CLOSING", "CLOSED"];

  if (!allowed.includes(state)) {
    return res.status(400).json({ error: "INVALID_STATE", allowed });
  }

  const out = setBarrierState(req.params.id, state); // your existing upsert fn
  res.json({ ok: true, ...out });
});


// --- start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REST API running on http://localhost:${PORT}`));
