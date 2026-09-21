import type { PrayTimesData } from '../../shared/types';
import { parseHHMM, toHHMM } from './fmt';

export const QAYLU_HOURS_BEFORE = 60;
export const QAYLU_MIN_MIN = 40;
export const QAYLU_MIN_MAX = 60;

export interface QayluMins {
  zuhr: number;
  asr: number;
  maghrib: number;
}

export function qayluMins(pt: PrayTimesData | null | undefined): QayluMins | null {
  if (!pt) return null;
  try {
    const zuhr = parseHHMM(pt.besin);
    const asr = parseHHMM(pt.ekindi);
    const maghrib = parseHHMM(pt.aqsham);
    if (![zuhr, asr, maghrib].every((x) => Number.isFinite(x))) return null;
    return { zuhr, asr, maghrib };
  } catch {
    return null;
  }
}

// допустимые интервалы времени НАЧАЛА блока длиной `minutes`:
// 1) до Зухра (не раньше часа до Зухра, утро не подходит);
// 2) после Зухра, чтобы закончить до Асра;
// 3) после Асра, чтобы закончить до Магриба.
// Блок никогда не перекрывает время намаза.
export function qayluIntervals(minutes: number, m: QayluMins): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const a1 = m.zuhr - QAYLU_HOURS_BEFORE;
  const e1 = m.zuhr - minutes;
  if (e1 > a1) out.push([a1, e1]);
  const a2 = m.zuhr;
  const e2 = m.asr - minutes;
  if (e2 > a2) out.push([a2, e2]);
  const a3 = m.asr;
  const e3 = m.maghrib - minutes;
  if (e3 > a3) out.push([a3, e3]);
  return out;
}

export function qayluAllowedStarts(minutes: number, pt: PrayTimesData | null | undefined): number[] | null {
  const m = qayluMins(pt);
  if (!m) return null;
  const out: number[] = [];
  for (const [a, e] of qayluIntervals(minutes, m)) {
    for (let s = Math.ceil(a / 5) * 5; s <= e; s += 5) out.push(s);
  }
  return out.length ? out : null;
}

export function qayluAutoStart(minutes: number, pt: PrayTimesData | null | undefined): number | null {
  const m = qayluMins(pt);
  if (!m) return null;
  const ints = qayluIntervals(minutes, m);
  const afterZuhr = ints[1];
  if (afterZuhr) {
    const s = Math.ceil(m.zuhr / 5) * 5;
    if (s <= afterZuhr[1]) return s;
  }
  const first = ints[0];
  return first ? Math.ceil(first[0] / 5) * 5 : null;
}

export function qayluRangesLabel(minutes: number, pt: PrayTimesData | null | undefined): string | null {
  const m = qayluMins(pt);
  if (!m) return null;
  const names = ['до Зухра', 'после Зухра', 'после Асра'];
  const label = qayluIntervals(minutes, m)
    .map(([a, e], i) => `${toHHMM(a)}–${toHHMM(e)} (${names[i]})`)
    .join('; ');
  return label || null;
}

export const QAYLU_HHMM_RE = /^(\d{1,2}):(\d{2})$/;

export function qayluStartValid(
  start: string,
  minutes: number,
  pt: PrayTimesData | null | undefined
): { ok: boolean; error?: string } {
  if (!Number.isFinite(minutes) || minutes < QAYLU_MIN_MIN || minutes > QAYLU_MIN_MAX) {
    return { ok: false, error: `Длительность къайлюли — от ${QAYLU_MIN_MIN} до ${QAYLU_MIN_MAX} минут.` };
  }
  const m = qayluMins(pt);
  if (!m) return { ok: false, error: 'Нет времён намазов — сначала обновите намазы.' };
  const match = QAYLU_HHMM_RE.exec((start || '').trim());
  if (!match) {
    return {
      ok: false,
      error: `Введите время в формате ЧЧ:ММ, например «${toHHMM(qayluAutoStart(minutes, pt) ?? m.zuhr)}».`
    };
  }
  const s = Number(match[1]) * 60 + Number(match[2]);
  const ok = qayluIntervals(minutes, m).some(([a, e]) => s >= a && s <= e);
  if (!ok) {
    return { ok: false, error: `Можно ставить только в диапазоны: ${qayluRangesLabel(minutes, pt)}.` };
  }
  return { ok: true };
}

export function qayluClampMinutes(n: number): number {
  const v = Math.round(Number(n) || QAYLU_MIN_MIN);
  return Math.max(QAYLU_MIN_MIN, Math.min(QAYLU_MIN_MAX, v));
}