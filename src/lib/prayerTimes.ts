import type { CityMap, PrayerCache, PrayerFetchResult, PrayTimesData } from '../../shared/types';
import { PRAYER_LABELS } from '../../shared/types';

export const API = {
  praytimes: (cityId: number) => `https://namaztimes.kz/api/praytimes?id=${cityId}&type=json`,
  cities: 'https://namaztimes.kz/ru/api/cities?type=json'
};

export interface HttpLike {
  fetch(url: string, init?: { signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>;
}

export function defaultHttp(): HttpLike {
  return {
    fetch: (url, init) => globalThis.fetch(url, init as RequestInit) as never
  };
}

export interface CacheStore {
  read(): PrayerCache | null;
  write(c: PrayerCache): void;
}

const PRAYER_KEYS: (keyof PrayTimesData)[] = [
  'imsak', 'bamdat', 'kun', 'ishraq', 'kerahat', 'besin', 'asriauual',
  'ekindi', 'isfirar', 'aqsham', 'ishtibaq', 'quptan', 'ishaisani'
];

function parsePrayerResponse(json: unknown, cityId: number, fetchedAt: string): PrayerCache {
  const root = json as {
    date?: unknown;
    islamic_date?: unknown;
    praytimes?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
  };
  if (!root || typeof root !== 'object') throw new Error('invalid response');
  const pt = root.praytimes;
  if (!pt || typeof pt !== 'object') throw new Error('praytimes missing');
  const praytimes = {} as PrayTimesData;
  for (const k of PRAYER_KEYS) {
    const v = pt[k];
    praytimes[k] = typeof v === 'string' ? v : '';
  }
  const attrs = (root.attributes ?? {}) as Record<string, unknown>;
  return {
    fetchedAt,
    date: typeof root.date === 'string' ? root.date : '',
    islamicDate: typeof root.islamic_date === 'string' ? root.islamic_date : '',
    cityId,
    praytimes,
    attributes: {
      ID: String(attrs.ID ?? cityId),
      countryID: String(attrs.countryID ?? ''),
      CityName: String(attrs.CityName ?? ''),
      Latitude_1: String(attrs.Latitude_1 ?? ''),
      Latitude_2: String(attrs.Latitude_2 ?? ''),
      Latitude_3: String(attrs.Latitude_3 ?? ''),
      Longitude_1: String(attrs.Longitude_1 ?? ''),
      Longitude_2: String(attrs.Longitude_2 ?? ''),
      Longitude_3: String(attrs.Longitude_3 ?? ''),
      QiblaDir: String(attrs.QiblaDir ?? ''),
      MagnetDev: String(attrs.MagnetDev ?? ''),
      TimeZone: String(attrs.TimeZone ?? '')
    }
  };
}

function validCache(cache: PrayerCache | null, cityId: number): PrayerCache | null {
  if (!cache) return null;
  if (cache.cityId !== cityId) return null;
  if (!cache.praytimes || !cache.praytimes.bamdat) return null;
  return cache;
}

export async function fetchPrayerTimes(
  cityId: number,
  cache: CacheStore,
  http: HttpLike = defaultHttp(),
  timeoutMs = 20000
): Promise<PrayerFetchResult> {
  const offlineCache = validCache(cache.read(), cityId);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await http.fetch(API.praytimes(cityId), { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const json = JSON.parse(text);
    const parsed = parsePrayerResponse(json, cityId, new Date().toISOString());
    cache.write(parsed);
    return {
      ok: true,
      offline: false,
      fromCache: false,
      sourceDate: parsed.date,
      fetchedAt: parsed.fetchedAt,
      prayers: parsed.praytimes,
      attributes: parsed.attributes
    };
  } catch (err) {
    if (offlineCache) {
      return {
        ok: true,
        offline: true,
        fromCache: true,
        sourceDate: offlineCache.date,
        fetchedAt: offlineCache.fetchedAt,
        prayers: offlineCache.praytimes,
        attributes: offlineCache.attributes,
        error: err instanceof Error ? err.message : String(err)
      };
    }
    return {
      ok: false,
      offline: true,
      fromCache: false,
      sourceDate: '',
      fetchedAt: '',
      prayers: null,
      attributes: null,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function fetchCities(
  http: HttpLike = defaultHttp(),
  timeoutMs = 20000
): Promise<CityMap> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await http.fetch(API.cities, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.text()).trim();
    const obj = JSON.parse(json) as Record<string, unknown>;
    const map: CityMap = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') map[k] = v;
    }
    return map;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function prayerLabel(key: keyof PrayTimesData): string {
  return PRAYER_LABELS[key] ?? key;
}

export function anchorPrayerKey(anchor: string): keyof PrayTimesData | null {
  switch (anchor) {
    case 'fajr': return 'bamdat';
    case 'dhuhr': return 'besin';
    case 'asr': return 'ekindi';
    case 'maghrib': return 'aqsham';
    case 'isha': return 'quptan';
    default: return null;
  }
}