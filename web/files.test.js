import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendQueue, fileStem, formatSize } from "./files.js";

describe("bulk drop helpers", () => {
  it("appends instead of replacing the queue", () => {
    const next = appendQueue([{ name: "a.txt" }], [{ name: "b.pdf" }, { name: "c.spc" }]);
    assert.deepEqual(
      next.map(item => item.name),
      ["a.txt", "b.pdf", "c.spc"],
    );
  });

  it("formats sizes the way the file list shows them", () => {
    assert.equal(formatSize(400), "400 B");
    assert.equal(formatSize(2048), "2.0 KB");
    assert.equal(formatSize(-1), "—");
  });

  it("strips known invoice suffixes", () => {
    assert.equal(fileStem("affolter-27338.pdf"), "affolter-27338");
    assert.equal(fileStem("note"), "note");
  });
});
