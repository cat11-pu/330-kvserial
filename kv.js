// kv.js：键值映射与序列化
export function escapeText(text) {
  return String(text).replace(/[\\,=]/g, function (ch) { return "\\" + ch; });
}

export function setOf(pairs, key, value) {
  const next = (pairs || []).map(function (pair) { return [pair[0], pair[1]]; });
  for (let i = 0; i < next.length; i += 1) {
    if (next[i][0] === key) {
      next[i] = [key, value];
      return next;
    }
  }
  let pos = 0;
  while (pos < next.length && next[pos][0] < key) { pos += 1; }
  next.splice(pos, 0, [key, value]);
  return next;
}
