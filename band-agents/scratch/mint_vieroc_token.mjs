/**
 * mint_vieroc_token.mjs
 *
 * VIEROC_API_TOKEN is an Auth.js (NextAuth v5) **session JWT**. The VieroClick
 * API routes authenticate via `getUserId()`, which reads the `Authorization:
 * Bearer <token>` header and decodes it with AUTH_SECRET + salt
 * "authjs.session-token" to recover the user id. So the token must be a real,
 * signed Auth.js session token for an existing user — not an arbitrary string.
 *
 * This script mints one for admin@vieroc.dev (falling back to the highest-
 * privilege member if that user doesn't exist), verifies it round-trips through
 * the same decode() the app uses, and writes it into band-agents/.env. It never
 * prints the token.
 *
 * Run from the repo root:
 *     node band-agents/scratch/mint_vieroc_token.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../.."); // band-agents/scratch -> repo root
const require = createRequire(pathToFileURL(ROOT + "/package.json"));

// --- env (parse .env manually) ---
function parseEnv(p) {
  const out = {};
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env0 = parseEnv(path.join(ROOT, ".env"));
const AUTH_SECRET = env0.AUTH_SECRET;
const DATABASE_URL = env0.DATABASE_URL;
if (!AUTH_SECRET || !DATABASE_URL) throw new Error("AUTH_SECRET or DATABASE_URL missing in repo .env");

// --- pick the target user (prefer admin@vieroc.dev) ---
const neonPath = require.resolve("@neondatabase/serverless", {
  paths: [ROOT + "/packages/db", ROOT + "/apps/web", ROOT],
});
const neonMod = await import(pathToFileURL(neonPath).href);
const neon = neonMod.neon || neonMod.default?.neon;
const sql = neon(DATABASE_URL);

const TARGET_EMAIL = "admin@vieroc.dev";
let rows = await sql`
  select u.id, u.email, wm.role
  from users u
  join workspace_members wm on wm.user_id = u.id
  where u.email = ${TARGET_EMAIL}
  limit 1`;
if (!rows.length) {
  rows = await sql`
    select u.id, u.email, wm.role
    from users u
    join workspace_members wm on wm.user_id = u.id
    order by case wm.role when 'owner' then 0 when 'admin' then 1 when 'leader' then 2 else 3 end
    limit 1`;
  if (rows.length) console.error(`[warn] ${TARGET_EMAIL} not found — using ${rows[0].email} instead`);
}
if (!rows.length) throw new Error("No workspace members found in DB");
const user = rows[0];

// --- mint + verify the Auth.js session token ---
const jwtPath = require.resolve("next-auth/jwt", { paths: [ROOT + "/apps/web"] });
const { encode, decode } = await import(pathToFileURL(jwtPath).href);
const salt = "authjs.session-token";
const token = await encode({
  token: { sub: user.id, userId: user.id, email: user.email },
  secret: AUTH_SECRET,
  salt,
  maxAge: 60 * 60 * 24 * 365, // 1 year
});
const back = await decode({ token, secret: AUTH_SECRET, salt });
const resolved = back?.userId || back?.sub;
if (resolved !== user.id) throw new Error("Token failed to round-trip through decode()");

// --- write into band-agents/.env (never printed) ---
const envPath = path.join(ROOT, "band-agents", ".env");
let env = fs.readFileSync(envPath, "utf8");
const line = `VIEROC_API_TOKEN=${token}`;
env = /^VIEROC_API_TOKEN=.*$/m.test(env)
  ? env.replace(/^VIEROC_API_TOKEN=.*$/m, line)
  : env + `\n${line}\n`;
fs.writeFileSync(envPath, env);

console.log(`✅ Minted token for ${user.email} (role=${user.role}); decode_ok=true`);
console.log(`   Wrote VIEROC_API_TOKEN into band-agents/.env`);
