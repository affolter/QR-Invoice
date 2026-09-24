import { TestSuite }           from "../kolibri/util/test.js";
import { unwrap }              from "./either.js";
import { buildQrPayload }      from "./build.js";
import { buildSwissQrPayload } from "./synthetic.js";
import { normalizeInvoice }    from "./normalize.js";
import { parseQrPayload }      from "./parse.js";

const suite = TestSuite("buildQrPayload");

suite.add("emits SPC text and round-trips structured fields without changing the IBAN", assert => {
  const { invoice } = normalizeInvoice(unwrap(parseQrPayload(buildSwissQrPayload())));
  assert.isTrue(invoice != null);
  if (!invoice) return;
  const built = buildQrPayload(invoice);
  assert.isTrue(/^SPC\n0200\n1\n/.test(built));
  const again = unwrap(parseQrPayload(built));
  assert.is(again.account.value, invoice.account);
  assert.is(again.amount.value, invoice.amount);
  assert.is(again.currency.value, invoice.currency);
  assert.is(again.reference.value, invoice.reference);
  assert.is(again.creditor.addressType.value, "S");
  assert.is(again.creditor.street.value, "Rue du Lac");
  assert.is(again.creditor.buildingNumber.value, "1268");
});

suite.run();
