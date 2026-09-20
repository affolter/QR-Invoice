import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Observable } from "./observable.js";

describe("Observable", () => {
  it("notifies immediately and on later setValue", () => {
    /** @type { string[] } */
    const seen = [];
    const street = Observable("Route 12 Dorf 8");
    const cancel = street.onChange(value => {
      seen.push(value);
    });
    street.setValue("Bahnhofstrasse");
    street.setValue("Bahnhofstrasse");
    cancel();
    street.setValue("ignored");
    assert.deepEqual(seen, ["Route 12 Dorf 8", "Bahnhofstrasse"]);
    assert.equal(street.getValue(), "ignored");
  });
});
