// kvrun.js：按处理预算处理事件并留账，收尾时补齐
import { setOf } from "./kv.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function codeOf(spec, key, fallback) {
  return isNonEmptyString(spec[key]) ? spec[key] : fallback;
}

function makeError(spec, key, fallback, message) {
  const error = new Error(message);
  error.code = codeOf(spec, key, fallback);
  return error;
}

// 归一化成账上的元组：set -> [kind,key,value]，unset -> [kind,key]
function normalize(event) {
  if (event.kind === "set") {
    return ["set", event.key, event.value];
  }
  return ["unset", event.key];
}

function signatureOf(entry) {
  return JSON.stringify(entry);
}

// 结构校验：与预算无关，整批先判
function validate(events, spec) {
  if (!Array.isArray(events)) {
    throw makeError(spec, "event_error_code", "E_BAD_EVENT", "events must be an array");
  }
  events.forEach(function (event) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw makeError(spec, "event_error_code", "E_BAD_EVENT", "event must be an object");
    }
    if (event.kind !== "set" && event.kind !== "unset") {
      throw makeError(spec, "event_error_code", "E_BAD_EVENT", "unknown event kind: " + event.kind);
    }
    if (!isNonEmptyString(event.key)) {
      throw makeError(spec, "key_error_code", "E_BAD_KEY", "key must be a non-empty string");
    }
    if (event.kind === "set" && !isNonEmptyString(event.value)) {
      throw makeError(spec, "event_error_code", "E_BAD_EVENT", "value must be a non-empty string");
    }
  });
}

// 把一条账项应用到映射上；unset 命中不存在的键按当前映射判 E_MISSING
function applyEntry(pairs, entry, spec) {
  const kind = entry[0];
  const key = entry[1];
  if (kind === "set") {
    return setOf(pairs, key, entry[2]);
  }
  const found = pairs.some(function (pair) { return pair[0] === key; });
  if (!found) {
    throw makeError(spec, "missing_error_code", "E_MISSING", "key not in map: " + key);
  }
  return pairs.filter(function (pair) { return pair[0] !== key; });
}

function cloneState(state) {
  return {
    pairs: (state.pairs || []).map(function (pair) { return pair.slice(); }),
    ledger: (state.ledger || []).map(function (entry) { return entry.slice(); }),
    applied: (state.applied || []).slice()
  };
}

// 顺序处理一条队列（先压账后新事件），共用预算
function runQueue(queue, state, budget, spec) {
  let pairs = state.pairs;
  const applied = state.applied.slice();
  const ledger = [];
  let remaining = budget;
  let served = 0;
  let judged = 0;

  queue.forEach(function (entry) {
    judged += 1;
    const signature = signatureOf(entry);
    if (applied.indexOf(signature) >= 0) {
      return; // 已处理过：重放不再处理，也不占预算
    }
    if (remaining <= 0) {
      ledger.push(entry);
      return;
    }
    pairs = applyEntry(pairs, entry, spec);
    applied.push(signature);
    remaining -= 1;
    served += 1;
  });

  return { pairs, ledger, applied, served, judged };
}

export function step(spec) {
  validate(spec.events, spec);
  const incoming = cloneState(spec.state || {});
  const budget = Number.isFinite(spec.budget) && spec.budget > 0 ? Math.floor(spec.budget) : 0;
  const carried = incoming.ledger;
  const fresh = spec.events.map(normalize);
  const queue = carried.concat(fresh);
  const bound = queue.length;

  const result = runQueue(queue, incoming, budget, spec);

  return {
    state: { pairs: result.pairs, ledger: result.ledger, applied: result.applied },
    served: result.served,
    ledger_before: result.ledger.length,
    ledger: result.ledger,
    judged: result.judged,
    judged_bound: bound
  };
}

export function close(spec) {
  const incoming = cloneState(spec.state || {});
  const result = runQueue(incoming.ledger, incoming, Infinity, spec);
  return {
    state: { pairs: result.pairs, ledger: result.ledger, applied: result.applied },
    catchup: result.served
  };
}
