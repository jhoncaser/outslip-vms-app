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

export async function readLineItemFile(
  file: File
): Promise<{ data: Buffer<ArrayBuffer>; fileName: string; type: string }> {
  return {
    data: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    type: file.type,
  };
}
