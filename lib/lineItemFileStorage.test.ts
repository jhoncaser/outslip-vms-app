import { describe, it, expect } from "vitest";
import {
  readLineItemFile,
  isAllowedFileType,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./lineItemFileStorage";

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

describe("readLineItemFile", () => {
  it("reads the file's bytes, original name, and MIME type", async () => {
    const file = new File([Buffer.from("test content")], "id scan.pdf", {
      type: "application/pdf",
    });

    const result = await readLineItemFile(file);

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.toString()).toBe("test content");
    expect(result.fileName).toBe("id scan.pdf");
    expect(result.type).toBe("application/pdf");
  });

  it("reads two different files independently without mixing up their bytes", async () => {
    const file1 = new File([Buffer.from("a")], "same.pdf", { type: "application/pdf" });
    const file2 = new File([Buffer.from("b")], "same.pdf", { type: "application/pdf" });

    const result1 = await readLineItemFile(file1);
    const result2 = await readLineItemFile(file2);

    expect(result1.data.toString()).toBe("a");
    expect(result2.data.toString()).toBe("b");
  });
});
