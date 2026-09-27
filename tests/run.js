import assert from "node:assert";
import { escapeText, setOf } from "../kv.js";
import { step, close } from "../kvrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { pairs: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "set", key: "a", value: "1" }],
  missing_error_code: "E_MISSING", key_error_code: "E_BAD_KEY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("escapeText returns text", () => {
  assert.strictEqual(typeof escapeText("a,b"), "string");
});

check("setOf returns pairs", () => {
  assert.ok(Array.isArray(setOf([], "z", "1")));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
