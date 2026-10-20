/** 确定性随机。每次抽取后把 next 写回存档，刷新不会重抽。 */
export function nextRng(state: number): { value: number; next: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const next = (t ^ (t >>> 14)) >>> 0;
  return { value: next / 4294967296, next: next || 1 };
}

export function rollInt(state: number, count: number): { index: number; next: number } {
  const rolled = nextRng(state);
  const index = Math.min(count - 1, Math.floor(rolled.value * count));
  return { index, next: rolled.next };
}
