import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "fs";
import {
  saveLineItemFile,
  deleteLineItemFile,
  lineItemFilePath,
  isAllowedFileType,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./lineItemFileStorage";

const savedUrls: string[] = [];

describe("isAllowedFileType", () => {
  it("accepts every type in ALLOWED_FILE_TYPES", () => {
    for (const type of ALLOWED_FILE_TYPES) {
      expect(isAllowedFileType(type)).toBe(true);
    }
  });

  it("rejects an unlisted type", () => {
    expect(isAllowedFileType("application/x-executable")).toBe(false);
  });
});

describe("MAX_FILE_SIZE_BYTES", () => {
  it("is 5MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("saveLineItemFile / deleteLineItemFile", () => {
  afterEach(async () => {
    while (savedUrls.length > 0) {
      await deleteLineItemFile(savedUrls.pop()!);
    }
  });

  it("saves a file to disk and returns a url and the original file name", async () => {
    const file = new File([Buffer.from("test content")], "id scan.pdf", {
      type: "application/pdf",
    });

    const result = await saveLineItemFile(file);
    savedUrls.push(result.url);

    expect(result.fileName).toBe("id scan.pdf");
    expect(existsSync(lineItemFilePath(result.url))).toBe(true);
  });

  it("sanitizes the stored file name but keeps the original file name for display", async () => {
    const file = new File([Buffer.from("x")], "weird name (final) v2.png", {
      type: "image/png",
    });

    const result = await saveLineItemFile(file);
    savedUrls.push(result.url);

    expect(result.url).not.toContain(" ");
    expect(result.url).not.toContain("(");
    expect(result.fileName).toBe("weird name (final) v2.png");
  });

  it("generates a different url for two files with the same original name", async () => {
    const file1 = new File([Buffer.from("a")], "same.pdf", { type: "application/pdf" });
    const file2 = new File([Buffer.from("b")], "same.pdf", { type: "application/pdf" });

    const result1 = await saveLineItemFile(file1);
    const result2 = await saveLineItemFile(file2);
    savedUrls.push(result1.url, result2.url);

    expect(result1.url).not.toBe(result2.url);
  });

  it("deleteLineItemFile removes the file from disk", async () => {
    const file = new File([Buffer.from("x")], "to-delete.pdf", {
      type: "application/pdf",
    });
    const result = await saveLineItemFile(file);

    await deleteLineItemFile(result.url);
    expect(existsSync(lineItemFilePath(result.url))).toBe(false);
  });

  it("deleteLineItemFile does not throw for a url that doesn't exist on disk", async () => {
    await expect(deleteLineItemFile("nonexistent-file.pdf")).resolves.not.toThrow();
  });
});
