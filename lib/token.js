// Instagram token storage.
// The token from Meta lasts 60 days. A weekly job refreshes it and saves the
// new one in Redis (Upstash, connected through Vercel → Storage). If Redis is
// not connected yet, the token from the IG_ACCESS_TOKEN env variable is used.

const KEY = "ig_access_token";

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cmd) {
  const cfg = redisConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const data = await res.json();
  return data.result ?? null;
}

export function hasStore() {
  return Boolean(redisConfig());
}

export async function getToken() {
  try {
    const stored = await redis(["GET", KEY]);
    if (stored) return stored;
  } catch (err) {
    console.error("Could not read token from Redis:", err.message);
  }
  return process.env.IG_ACCESS_TOKEN || null;
}

export async function saveToken(token) {
  return redis(["SET", KEY, token]);
}
