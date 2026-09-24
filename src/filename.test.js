import { TestSuite }            from "../kolibri/util/test.js";
import { createOutputFilename } from "./filename.js";

const suite = TestSuite("createOutputFilename");

suite.add("keeps the stem and appends -structured", assert => {
  assert.is(createOutputFilename("combined-k.txt", "spc"), "combined-k-structured.txt");
  assert.is(createOutputFilename("invoice.PDF", "pdf"), "invoice-structured.pdf");
});

suite.add("uses only the file name from a path", assert => {
  assert.is(createOutputFilename("invoices/Frey Peter 2026.pdf", "pdf"), "Frey Peter 2026-structured.pdf");
});

suite.run();
