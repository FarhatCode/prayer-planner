import { describe, expect, it } from 'vitest';
import type { PrayerCache } from '../../shared/types';
import {
  qayluAllowedStarts,
  qayluAutoStart,
  qayluRangesLabel,
  qayluStartValid
} from './qaylulah';

const FX: PrayerCache = {
  fetchedAt: 'x',
  date: '2026-9-18',
  islamicDate: '',
  cityId: 23,
  praytimes: {
    imsak: '3:57',
    bamdat: '4:12',
    kun: '5:33',
    ishraq: '6:16',
    kerahat: '11:39',
    besin: '11:57',
    asriauual: '15:27',
    ekindi: '16:20',
    isfirar: '17:28',
    aqsham: '18:04',
    ishtibaq: '18:51',
    quptan: '19:28',
    ishaisani: '19:39'
  },
  attributes: {} as PrayerCache['attributes']
};

describe('qaylulah bounds', () => {
  it('allowed starts for 45 min: before zuhr, after zuhr, after asr', () => {
    const starts = qayluAllowedStarts(45, FX.praytimes);
    expect(starts).toBeTruthy();
    const s = starts!;
    expect(s[0]).toBe(11 * 60); // 11:00 = час до Зухра (округлено по 5)
    expect(s[s.length - 1]).toBe(17 * 60 + 15); // 17:15 — до Магриба 18:04
    // утро (до 10:59) недоступно
    expect(s.every((v) => v >= 11 * 60)).toBe(true);
    // нет ни одного старта, который бы перекрыл Аср 16:20
    for (const v of s) {
      expect(v + 45 <= 16 * 60 + 20 || v >= 16 * 60 + 20).toBe(true);
    }
  });

  it('auto start is right after zuhr when there is room', () => {
    expect(qayluAutoStart(45, FX.praytimes)).toBe(12 * 60); // 12:00
  });

  it('60 min cannot start before 12:00 (нет места до Зухра на сетке 5 мин)', () => {
    const starts = qayluAllowedStarts(60, FX.praytimes);
    expect(starts![0]).toBe(12 * 60);
  });

  it('validates manual input', () => {
    expect(qayluStartValid('11:00', 45, FX.praytimes).ok).toBe(true);
    expect(qayluStartValid('11:57', 45, FX.praytimes).ok).toBe(true);
    expect(qayluStartValid('15:35', 45, FX.praytimes).ok).toBe(true);
    expect(qayluStartValid('16:30', 45, FX.praytimes).ok).toBe(true);
    expect(qayluStartValid('17:20', 45, FX.praytimes).ok).toBe(false); // до Магриба не хватит 45 мин
    expect(qayluStartValid('16:00', 45, FX.praytimes).ok).toBe(false); // пересекает Аср
    expect(qayluStartValid('10:00', 45, FX.praytimes).ok).toBe(false); // утро
    expect(qayluStartValid('бред', 45, FX.praytimes).ok).toBe(false); // формат
    expect(qayluStartValid('11:00', 90, FX.praytimes).ok).toBe(false); // длина
    expect(qayluRangesLabel(45, FX.praytimes)).toContain('до Зухра');
  });
});