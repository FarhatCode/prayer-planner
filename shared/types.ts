export type PrayerKey =
  | 'imsak'
  | 'bamdat'
  | 'kun'
  | 'ishraq'
  | 'kerahat'
  | 'besin'
  | 'asriauual'
  | 'ekindi'
  | 'isfirar'
  | 'aqsham'
  | 'ishtibaq'
  | 'quptan'
  | 'ishaisani';

export type PrayTimesData = Record<PrayerKey, string>;

export interface PrayerAttributes {
  ID: string;
  countryID: string;
  CityName: string;
  Latitude_1: string;
  Latitude_2: string;
  Latitude_3: string;
  Longitude_1: string;
  Longitude_2: string;
  Longitude_3: string;
  QiblaDir: string;
  MagnetDev: string;
  TimeZone: string;
}

export interface PrayerCache {
  fetchedAt: string; // ISO
  date: string; // server date e.g. 2026-9-18
  islamicDate: string;
  cityId: number;
  praytimes: PrayTimesData;
  attributes: PrayerAttributes;
}

export type AnchorKey = 'wake' | 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'sleep';

export const PRAYER_LABELS: Record<string, string> = {
  bamdat: 'Фаджр',
  besin: 'Зухр',
  ekindi: 'Аср',
  aqsham: 'Магриб',
  quptan: 'Иша'
};

export const SHORT_LABELS: Record<string, string> = {
  wake: 'Подъем',
  fajr: 'Фаджр',
  dhuhr: 'Зухр',
  asr: 'Аср',
  maghrib: 'Магриб',
  isha: 'Иша',
  sleep: 'Отбой'
};

export interface FixedWindow {
  from: AnchorKey;
  to: AnchorKey;
  startPadMin: number;
  endPadMin: number;
  restLabel: string;
}

export interface Settings {
  cityId: number;
  cityName: string;
  slotMin: number; // standard study slot, never shrunk
  breakMin: number; // minimum break duration
  wake: string; // "HH:MM"
  sleep: string; // "HH:MM", "00:00" = end of day
  windows: FixedWindow[];
  volume: number; // 0..1
  closeToTray: boolean;
  useTaskScheduler: boolean;
}

export interface Task {
  id: string;
  name: string;
  hours: number;
  desc: string;
  color: string;
  pinnedWindow?: number; // index into settings.windows
  canMove: boolean;
}

export type PEntryType = 'wake' | 'prayer' | 'study' | 'break' | 'rest' | 'prep' | 'sleep';

export interface PEntry {
  time: string; // "HH:MM"
  end?: string; // "HH:MM" — до какого времени длится пункт (для панели)
  type: PEntryType;
  taskId?: string;
  title: string;
  text: string;
  desc: string;
  remaining?: Record<string, number>;
}

export interface PlanWindow {
  name: string;
  from: AnchorKey;
  to: AnchorKey;
  startPadMin: number;
  endPadMin: number;
  restLabel: string;
  breakUsed: number; // breaks shrunk to this duration for this window
  entriesCount: number;
}

export interface DayPlan {
  date: string; // yyyy-mm-dd
  sourceDate: string; // prayer times source date
  fromCache: boolean;
  cityId: number;
  cityName: string;
  windows: PlanWindow[];
  entries: PEntry[];
  warnings: string[];
}

export type CityMap = Record<string, string>;

export interface CityItem {
  id: string;
  name: string;
  region?: string;
}

export interface PrayerFetchResult {
  ok: boolean;
  offline: boolean;
  fromCache: boolean;
  sourceDate: string;
  fetchedAt: string;
  prayers: PrayTimesData | null;
  attributes: PrayerAttributes | null;
  error?: string;
}

export interface ScheduleResult {
  plan: DayPlan;
}

export interface RegisterResult {
  mode: 'scheduler' | 'tray';
  registered: number;
  skipped: number;
  taskNames: string[];
}

export interface UpdateState {
  settings: Settings;
  tasks: Task[];
  prayer: PrayerFetchResult;
}

export interface AlarmPayload {
  entry: PEntry;
  test: boolean;
  volume?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  cityId: 23,
  cityName: 'Ханабад',
  slotMin: 45,
  breakMin: 5,
  wake: '04:30',
  sleep: '00:00',
  windows: [
    { from: 'fajr', to: 'dhuhr', startPadMin: 20, endPadMin: 0, restLabel: 'Отдых / Прогулка / Личные дела перед полуденным намазом' },
    { from: 'dhuhr', to: 'asr', startPadMin: 35, endPadMin: 15, restLabel: 'Отдых / Подготовка к Асру' },
    { from: 'asr', to: 'maghrib', startPadMin: 30, endPadMin: 20, restLabel: 'Отдых / Подготовка к Магрибу' },
    { from: 'maghrib', to: 'isha', startPadMin: 25, endPadMin: 20, restLabel: 'Отдых / Подготовка к Иша' },
    { from: 'isha', to: 'sleep', startPadMin: 25, endPadMin: 0, restLabel: 'Отдых' }
  ],
  volume: 1,
  closeToTray: true,
  useTaskScheduler: true
};

export const DEFAULT_TASKS: Task[] = [
  { id: 't1', name: 'Курс Ильнура', hours: 3, desc: 'Мок-собеседования, подготовка резюме, Angular, AI-инженерия.', color: '#4c86f5', canMove: false },
  { id: 't2', name: 'Вопрос Динару', hours: 1, desc: 'Разбор финансовых вопросов, подготовка ответов и задач.', color: '#9b6cf0', canMove: true },
  { id: 't3', name: 'edX CS', hours: 3, desc: 'Лекции, алгоритмы, практика и задачи.', color: '#2bb391', canMove: true }
];