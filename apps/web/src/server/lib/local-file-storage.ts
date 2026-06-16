import "server-only";

import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT =
  process.env.FILE_STORAGE_DIR ?? path.join(process.cwd(), ".local-storage", "files");

function cleanFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "upload";
  return baseName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

function resolveStoragePath(storageKey: string) {
  const root = path.resolve(STORAGE_ROOT);
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }
  return target;
}

export async function putLocalFileObject(workspaceId: string, file: File) {
  const safeName = cleanFileName(file.name);
  const storageKey = `${workspaceId}/${randomUUID()}-${safeName}`;
  const target = resolveStoragePath(storageKey);
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });

  return {
    fileName: file.name || safeName,
    mimeType: file.type || null,
    sizeBytes: bytes.byteLength,
    storageKey,
  };
}

export async function readLocalFileObject(storageKey: string) {
  return readFile(resolveStoragePath(storageKey));
}

export async function removeLocalFileObject(storageKey: string) {
  await rm(resolveStoragePath(storageKey), { force: true });
}
