#!/usr/bin/env node
// Usage: node scripts/guard-migrate.mjs <push|migrate>
//
// This repo has ONE shared Neon database — there is no separate dev branch,
// so every db:push/db:migrate run touches whatever DATABASE_URL currently
// points at. This guard requires an explicit ALLOW_PROD_MIGRATION=1 opt-in
// before delegating to the real drizzle-kit command, so a schema change is
// never applied by accident (e.g. muscle-memory `pnpm db:push` in the wrong
// terminal). It is intentionally stateless — it fires on every invocation.
import { spawnSync } from "node:child_process";

const command = process.argv[2];

if (command !== "push" && command !== "migrate") {
  console.error("Usage: node scripts/guard-migrate.mjs <push|migrate>");
  process.exit(1);
}

if (process.env.ALLOW_PROD_MIGRATION !== "1") {
  console.error(`
⚠️  DATABASE GUARD ⚠️
This repo has ONE shared Neon database — there is no separate dev branch.
Every 'db:${command}' run touches whatever DATABASE_URL currently points at.

Dự án chỉ có MỘT database Neon dùng chung. Không có nhánh (branch) riêng
cho dev. Mọi lệnh 'db:${command}' đều tác động lên DB mà DATABASE_URL
đang trỏ tới.

To proceed, re-run with:
  ALLOW_PROD_MIGRATION=1 pnpm db:${command}

Aborting — nothing was run.
`);
  process.exit(1);
}

const result = spawnSync("drizzle-kit", [command], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
