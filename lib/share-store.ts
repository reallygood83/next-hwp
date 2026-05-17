import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const shareRoot = path.join(process.cwd(), ".data", "shares");

export async function saveSharedHtml(html: string) {
  const id = randomUUID().replaceAll("-", "").slice(0, 16);
  await mkdir(shareRoot, { recursive: true });
  await writeFile(path.join(shareRoot, `${id}.html`), html, "utf8");
  return id;
}

export async function readSharedHtml(id: string) {
  if (!/^[a-f0-9]{16}$/i.test(id)) {
    return null;
  }

  try {
    return await readFile(path.join(shareRoot, `${id}.html`), "utf8");
  } catch {
    return null;
  }
}
