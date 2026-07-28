import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "line-items");

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function isAllowedFileType(type: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(type);
}

export function lineItemFilePath(url: string): string {
  return path.join(UPLOAD_DIR, url);
}

export async function saveLineItemFile(
  file: File
): Promise<{ url: string; fileName: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${sanitizedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  return { url: storedName, fileName: file.name };
}

export async function deleteLineItemFile(url: string): Promise<void> {
  try {
    await unlink(lineItemFilePath(url));
  } catch {
    // Best-effort: a missing or already-removed file is not worth surfacing.
  }
}
