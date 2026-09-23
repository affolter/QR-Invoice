import { allAsyncTests, failed } from "./kolibri/util/test.js";
import "./src/build.test.js";
import "./src/combined-k.test.js";
import "./src/convert.test.js";
import "./src/filename.test.js";
import "./src/index.test.js";
import "./src/normalize.test.js";
import "./src/parse.test.js";
import "./src/review.test.js";
import "./src/validate.test.js";
import "./src/pdf/pdf.test.js";
import "./cli/cli.test.js";
import "./cli/convert.test.js";

await allAsyncTests();
if (failed.getValue()) process.exit(1);
