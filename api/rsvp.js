const crypto = require("crypto");
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "rsvps:gael";

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "redis");
  return j.result;
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "Base de datos sin configurar" });
  try {
    if (req.method === "POST") {
      let b = req.body;
      if (typeof b === "string") b = JSON.parse(b || "{}");
      b = b || {};
      if (b.web) return res.status(200).json({ ok: true });
      const name = String(b.name || "").trim().slice(0, 80);
      const guests = Math.min(Math.max(parseInt(b.guests, 10) || 1, 1), 20);
      const message = String(b.message || "").trim().slice(0, 300);
      if (!name) return res.status(400).json({ error: "Falta el nombre" });
      await redis(["RPUSH", KEY, JSON.stringify({ name, guests, message, date: new Date().toISOString() })]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "GET") {
      const pw = process.env.ADMIN_PASSWORD;
      if (!pw || !same(req.headers["x-admin-password"] || "", pw)) return res.status(401).json({ error: "No autorizado" });
      const rows = await redis(["LRANGE", KEY, "0", "-1"]);
      const items = (rows || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ items });
    }
    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
};
