import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOutputFilename } from "./filename.js";

describe("createOutputFilename", () => {
  it("keeps the stem and appends -structured", () => {
    assert.equal(createOutputFilename("affolter-27338.txt", "spc"), "affolter-27338-structured.txt");
    assert.equal(createOutputFilename("invoice.PDF", "pdf"), "invoice-structured.pdf");
  });

  it("uses only the file name from a path", () => {
    assert.equal(createOutputFilename("samples/Frey Peter 2026.pdf", "pdf"), "Frey Peter 2026-structured.pdf");
  });
});
