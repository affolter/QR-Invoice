import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrap } from "./either.js";
import { parseArgs } from "./cli.js";

describe("CLI argv", () => {
  it("returns help for -h and --help", () => {
    assert.equal(unwrap(parseArgs(["node", "cli", "--help"])), "help");
    assert.equal(unwrap(parseArgs(["node", "cli", "-h"])), "help");
  });

  it("rejects missing input/output", () => {
    assert.equal(parseArgs(["node", "cli"]).ok, false);
    assert.equal(parseArgs(["node", "cli", "old.txt"]).ok, false);
  });

  it("parses --accept-review and --strict with --output", () => {
    const parsed = parseArgs([
      "node",
      "cli",
      "old-payload.txt",
      "--output",
      "new-payload.txt",
      "--accept-review",
      "--strict",
    ]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || parsed.value === "help") throw new Error("expected convert args");
    assert.equal(parsed.value.acceptReview, true);
    assert.equal(parsed.value.strict, true);
    assert.match(parsed.value.input, /old-payload\.txt$/);
    assert.match(parsed.value.outputPath, /new-payload\.txt$/);
  });

  it("rejects unknown options", () => {
    const parsed = parseArgs(["node", "cli", "old.txt", "--output", "new.txt", "--pdf"]);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.error, /Unknown option: --pdf/);
  });
});
