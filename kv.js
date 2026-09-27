// kv.js：键值映射与序列化
export function escapeText(text) {
  return String(text).replace(/[\\,=]/g, function (ch) {
    return "\\" + ch;
  });
}

export function setOf(pairs, key, value) {
  const next = pairs.map(function (pair) { return pair.slice(); });
  const found = next.findIndex(function (pair) { return pair[0] === key; });
  if (found >= 0) {
    next[found] = [key, value];
    return next;
  }
  let insertAt = 0;
  while (insertAt < next.length && next[insertAt][0] < key) {
    insertAt += 1;
  }
  next.splice(insertAt, 0, [key, value]);
  return next;
}
