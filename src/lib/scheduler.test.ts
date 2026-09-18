import { describe, expect, it } from 'vitest';
import { buildDayPlan, BLOCK_LABELS } from './scheduler';
import { parseHHMM } from './fmt';
import { DEFAULT_SETTINGS, PRAYER_LABELS, type AnchorKey, type PrayerCache, type Task } from '../../shared/types';

const FX: PrayerCache = {
  fetchedAt: '2026-09-18T00:00:00.000Z',
  date: '2026-9-18',
  islamicDate: '1448-4-7',
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
  attributes: {
    ID: '23',
    countryID: '1',
    CityName: 'Ханабад',
    Latitude_1: '36',
    Latitude_2: '43',
    Latitude_3: 'N',
    Longitude_1: '68',
    Longitude_2: '59',
    Longitude_3: 'E',
    QiblaDir: '246.93',
    MagnetDev: '3.97',
    TimeZone: ''
  }
};

const anchors: Record<AnchorKey, number> = {
  wake: parseHHMM(DEFAULT_SETTINGS.wake),
  fajr: parseHHMM(FX.praytimes.bamdat),
  dhuhr: parseHHMM(FX.praytimes.besin),
  asr: parseHHMM(FX.praytimes.ekindi),
  maghrib: parseHHMM(FX.praytimes.aqsham),
  isha: parseHHMM(FX.praytimes.quptan),
  sleep: 1440
};

const DEFAULT_TASKS_3: Task[] = [
  { id: 't1', name: 'Курс Ильнура', hours: 3, desc: 'd1', color: '#4c86f5', canMove: false },
  { id: 't2', name: 'Вопрос Динару', hours: 1, desc: 'd2', color: '#9b6cf0', canMove: true },
  { id: 't3', name: 'edX CS', hours: 3, desc: 'd3', color: '#2bb391', canMove: true }
];

function windowRanges(): Array<{ idx: number; from: number; to: number }> {
  return DEFAULT_SETTINGS.windows.map((w, idx) => ({
    idx,
    from: anchors[w.from] + w.startPadMin,
    to: anchors[w.to] - w.endPadMin
  }));
}

function assertInside(plan: ReturnType<typeof buildDayPlan>): void {
  const ranges = windowRanges();
  for (const e of plan.entries) {
    if (e.type === 'wake' || e.type === 'sleep' || e.type === 'prayer') continue;
    const m = parseHHMM(e.time);
    const atOrBeforeEnd = e.type === 'prep';
    const inside = ranges.filter((r) => m >= r.from && (atOrBeforeEnd ? m <= r.to : m < r.to));
    expect(inside.length).toBe(1);
  }
}

describe('scheduler', () => {
  it('builds a plan with prayer anchors and wake/sleep', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX, date: '2026-09-18' });
    expect(plan.date).toBe('2026-09-18');
    expect(plan.entries[0].type).toBe('prayer'); // фаджр 04:12 раньше подъёма
    expect(plan.entries.some((e) => e.type === 'wake')).toBe(true);
    expect(plan.entries[plan.entries.length - 1].type).toBe('sleep');
    const prayers = plan.entries.filter((e) => e.type === 'prayer');
    expect(prayers.length).toBe(5);
    expect(prayers[1].title).toBe(PRAYER_LABELS.besin);
  });

  it('creates expected number of study slots (4+2+4=10)', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX });
    const studies = plan.entries.filter((e) => e.type === 'study');
    expect(studies.length).toBe(10);
  });

  it('keeps every entry inside its window range (no overrun)', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX });
    assertInside(plan);
  });

  it('produces unique times per entry', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX });
    const times = plan.entries.map((e) => e.time);
    expect(new Set(times).size).toBe(times.length);
  });

  it('puts remaining-tasks info into break entries', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX });
    const breaks = plan.entries.filter((e) => e.type === 'break');
    expect(breaks.length).toBeGreaterThan(0);
    const withRem = breaks.filter((e) => (e.text || '').includes('Осталось по плану'));
    expect(withRem.length).toBeGreaterThan(0);
  });

  it('warns when tasks cannot fit (never silently trims)', () => {
    const huge: Task[] = [
      { id: 'h1', name: 'Огромная задача', hours: 16, desc: '', color: '#f87171', canMove: true }
    ];
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: huge, prayers: FX });
    const hasWarn = plan.warnings.some((w) => w.includes('Не поместились'));
    expect(hasWarn).toBe(true);
  });

  it('drops pinned tasks that do not fit and warns (never silently trims)', () => {
    const pinnedBig: Task[] = [
      { id: 'p1', name: 'Фикс-задача', hours: 8, desc: '', color: '#f87171', canMove: false, pinnedWindow: 1 }
    ];
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: pinnedBig, prayers: FX });
    expect(plan.warnings.some((w) => w.includes('Не поместились'))).toBe(true);
    expect(plan.entries.filter((e) => e.type === 'study' && e.title.includes('Фикс-задача')).length).toBe(0);
    assertInside(plan);
  });

  it('labels windows with block names', () => {
    const plan = buildDayPlan({ settings: DEFAULT_SETTINGS, tasks: DEFAULT_TASKS_3, prayers: FX });
    expect(plan.windows.length).toBe(DEFAULT_SETTINGS.windows.length);
    expect(plan.windows[0].name).toContain(BLOCK_LABELS.fajr);
  });
});