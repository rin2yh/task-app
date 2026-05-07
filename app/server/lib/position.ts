export const POSITION_STEP = 1.0;
export const REBALANCE_THRESHOLD = 1e-6;

export type Positioned = { id: string; position: number };

/**
 * 末尾追加: max+STEP / 中間挿入: (prev+next)/2
 * リバランス必要時は null を返す（呼び出し側で1..N再採番）
 */
export function computeInsertPosition(
  prevPos: number | null,
  nextPos: number | null,
  maxPos: number,
): number | null {
  if (prevPos == null && nextPos == null) {
    return POSITION_STEP;
  }
  if (nextPos == null) {
    return (prevPos ?? maxPos) + POSITION_STEP;
  }
  if (prevPos == null) {
    return nextPos / 2;
  }
  const gap = nextPos - prevPos;
  if (gap < REBALANCE_THRESHOLD) {
    return null;
  }
  return prevPos + gap / 2;
}

/** 既存の position 列を 1..N で再採番した新値配列を返す */
export function rebalance(items: Positioned[]): Positioned[] {
  return items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => ({ id: item.id, position: (idx + 1) * POSITION_STEP }));
}

/** 末尾追加用 */
export function tailPosition(maxPos: number | null): number {
  if (maxPos == null) return POSITION_STEP;
  return maxPos + POSITION_STEP;
}
