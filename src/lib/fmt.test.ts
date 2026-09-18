import { describe, expect, it } from 'vitest';
import { parseHHMM, toHHMM, todayStr } from './fmt';

describe('fmt', () => {
  it('parses single-digit and two-digit times', () => {
    expect(parseHHMM('4:12')).toBe(252);
    expect(parseHHMM('04:12')).toBe(252);
    expect(parseHHMM('11:57')).toBe(717);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('24:00')).toBe(1440);
  });

  it('formats times padded', () => {
    expect(toHHMM(252)).toBe('04:12');
    expect(toHHMM(0)).toBe('00:00');
    expect(toHHMM(1440)).toBe('00:00');
    expect(toHHMM(1490)).toBe('00:50');
  });

  it('formats today yyyy-mm-dd', () => {
    expect(todayStr(new Date(2026, 8, 18))).toBe('2026-09-18');
  });
});