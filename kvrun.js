// kvrun.js：按处理预算处理并留账，收尾不限预算把账清空
import { setOf } from "./kv.js";

const CODES = {
  E_MISSING: "missing_error_code",
  E_BAD_KEY: "key_error_code",
  E_BAD_EVENT: "event_error_code"
};

function fail(spec, code, message) {
  const err = new Error(message);
  err.code = (spec && spec[CODES[code]]) || code;
  throw err;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function validateEvent(event, spec) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    fail(spec, "E_BAD_EVENT", "事件必须是对象");
  }
  if (event.kind !== "set" && event.kind !== "unset") {
    fail(spec, "E_BAD_EVENT", "事件 kind 只能是 set 或 unset");
  }
  if (!isNonEmptyString(event.key)) {
    fail(spec, "E_BAD_KEY", "键必须是非空字符串");
  }
  if (event.kind === "set" && !isNonEmptyString(event.value)) {
    fail(spec, "E_BAD_EVENT", "set 的值必须是非空字符串");
  }
}

function toRow(event) {
  return event.kind === "set"
    ? [event.kind, event.key, event.value]
    : [event.kind, event.key];
}

function execute(pairs, kind, key, value, spec) {
  if (kind === "set") {
    return setOf(pairs, key, value);
  }
  const next = pairs.filter(function (pair) { return pair[0] !== key; });
  if (next.length === pairs.length) {
    fail(spec, "E_MISSING", "要删的键不在映射里：" + key);
  }
  return next;
}

function cloneState(state) {
  const source = state || {};
  return {
    pairs: (source.pairs || []).map(function (pair) { return [pair[0], pair[1]]; }),
    ledger: (source.ledger || []).map(function (row) { return row.slice(); }),
    applied: (source.applied || []).slice()
  };
}

export function step(spec) {
  const input = spec || {};
  const events = Array.isArray(input.events) ? input.events : [];
  const budget = Number.isFinite(input.budget) ? Math.max(0, Math.floor(input.budget)) : 0;
  const next = cloneState(input.state);

  events.forEach(function (event) { validateEvent(event, input); });

  const items = next.ledger.map(function (row) { return { fromLedger: true, row: row }; });
  events.forEach(function (event) {
    if (event.id !== undefined && event.id !== null && next.applied.indexOf(event.id) !== -1) {
      return;
    }
    items.push({ fromLedger: false, event: event });
  });

  let served = 0;
  const pending = [];
  items.forEach(function (item) {
    if (served < budget) {
      if (item.fromLedger) {
        next.pairs = execute(next.pairs, item.row[0], item.row[1], item.row[2], input);
        served += 1;
      } else {
        next.pairs = execute(next.pairs, item.event.kind, item.event.key, item.event.value, input);
        if (item.event.id !== undefined && item.event.id !== null) {
          next.applied.push(item.event.id);
        }
        served += 1;
      }
    } else if (item.fromLedger) {
      pending.push(item.row.slice());
    } else {
      pending.push(toRow(item.event));
      if (item.event.id !== undefined && item.event.id !== null) {
        next.applied.push(item.event.id);
      }
    }
  });

  next.ledger = pending;
  const judged = items.filter(function (item) { return !item.fromLedger; }).length;
  return {
    state: next,
    served: served,
    ledger_before: pending.length,
    ledger: pending,
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const input = spec || {};
  const next = cloneState(input.state);
  let catchup = 0;
  while (next.ledger.length > 0) {
    const row = next.ledger.shift();
    next.pairs = execute(next.pairs, row[0], row[1], row[2], input);
    catchup += 1;
  }
  return { state: next, catchup: catchup };
}
