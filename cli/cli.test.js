import { TestSuite } from "../kolibri/util/test.js";
import { unwrap } from "../src/either.js";
import { parseArgs } from "./cli.js";

const suite = TestSuite("CLI argv");

suite.add("returns help for -h and --help", assert => {
  assert.is(unwrap(parseArgs(["node", "cli", "--help"])), "help");
  assert.is(unwrap(parseArgs(["node", "cli", "-h"])), "help");
});

suite.add("rejects missing input/output", assert => {
  assert.is(parseArgs(["node", "cli"]).ok, false);
  assert.is(parseArgs(["node", "cli", "old.txt"]).ok, false);
});

suite.add("parses --accept-review and --strict with --output", assert => {
  const parsed = parseArgs([
    "node",
    "cli",
    "old-payload.txt",
    "--output",
    "new-payload.txt",
    "--accept-review",
    "--strict",
  ]);
  assert.is(parsed.ok, true);
  if (!parsed.ok || parsed.value === "help") throw new Error("expected convert args");
  assert.is(parsed.value.acceptReview, true);
  assert.is(parsed.value.strict, true);
  assert.isTrue(/old-payload\.txt$/.test(parsed.value.input));
  assert.isTrue(/new-payload\.txt$/.test(parsed.value.outputPath));
});

suite.add("rejects unknown options", assert => {
  const parsed = parseArgs(["node", "cli", "old.txt", "--output", "new.txt", "--pdf"]);
  assert.is(parsed.ok, false);
  if (!parsed.ok) assert.isTrue(/Unknown option: --pdf/.test(parsed.error));
});

suite.run();
