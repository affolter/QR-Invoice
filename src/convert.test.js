import { asyncTest } from "../kolibri/util/test.js";
import { convert } from "./convert.js";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./synthetic.js";

asyncTest("text convert — returns SPC bytes", async assert => {
  const result = unwrap(await convert(buildSwissQrPayload(), { output: "spc" }));
  assert.is(result.mediaType, "text/plain;charset=utf-8");
  assert.isTrue(Boolean(result.bytes));
  assert.isTrue(/^SPC\n/.test(new TextDecoder().decode(result.bytes)));
  assert.is(result.invoice?.account, "CH4431999123000889012");
});

asyncTest("text convert — refuses PDF input", async assert => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const converted = await convert(pdf);
  assert.is(converted.ok, false);
  if (!converted.ok) assert.isTrue(/PDF converter/.test(converted.error));
});
