import test from "node:test";
import assert from "node:assert/strict";
import { validateDiagram } from "./rules.mjs";
test("rejects excessive PV voltage", () => {
  const result = validateDiagram({ nodes: [{ id: "pv", type: "pv-array", seriesVoc: 520, controllerMaxVoc: 500 }], connections: [] });
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].code, "PV_VOC_EXCEEDED");
});
