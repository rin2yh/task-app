import { describe, expect, it } from 'vitest';
import {
  POSITION_STEP,
  computeInsertPosition,
  rebalance,
  tailPosition,
} from '../../../server/lib/position';

describe('position helpers', () => {
  it('returns STEP for empty list', () => {
    expect(computeInsertPosition(null, null, 0)).toBe(POSITION_STEP);
  });

  it('returns prev+STEP for tail insert', () => {
    expect(tailPosition(5)).toBe(6);
    expect(tailPosition(null)).toBe(POSITION_STEP);
  });

  it('returns midpoint between prev and next', () => {
    expect(computeInsertPosition(2, 4, 4)).toBe(3);
  });

  it('returns half of next when prev is null', () => {
    expect(computeInsertPosition(null, 2, 2)).toBe(1);
  });

  it('returns null when gap below threshold', () => {
    expect(computeInsertPosition(1, 1.0000001, 1.0000001)).toBe(null);
  });

  it('rebalance returns 1..N positions', () => {
    const items = [
      { id: 'a', position: 0.1 },
      { id: 'b', position: 0.2 },
      { id: 'c', position: 5 },
    ];
    const reb = rebalance(items);
    expect(reb).toEqual([
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ]);
  });
});
