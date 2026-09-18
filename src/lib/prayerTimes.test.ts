import { describe, expect, it } from 'vitest';
import { fetchPrayerTimes, type CacheStore, type HttpLike } from './prayerTimes';
import type { PrayerCache } from '../../shared/types';

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

function memCache(initial: PrayerCache | null = null): CacheStore {
  let v = initial;
  return { read: () => v, write: (c) => { v = c; } };
}

function okHttp(): HttpLike {
  return {
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ...FX, date: '2026-9-18' })
    })
  };
}

function failingHttp(): HttpLike {
  return {
    fetch: async () => {
      throw new Error('network down');
    }
  };
}

describe('prayerTimes', () => {
  it('fetches and caches', async () => {
    const cache = memCache();
    const res = await fetchPrayerTimes(23, cache, okHttp());
    expect(res.ok).toBe(true);
    expect(res.offline).toBe(false);
    expect(res.sourceDate).toBe('2026-9-18');
    expect(res.prayers?.bamdat).toBe('4:12');
    expect(cache.read()).not.toBeNull();
  });

  it('falls back to cache when offline', async () => {
    const cache = memCache(FX);
    const res = await fetchPrayerTimes(23, cache, failingHttp());
    expect(res.ok).toBe(true);
    expect(res.offline).toBe(true);
    expect(res.fromCache).toBe(true);
    expect(res.prayers?.quptan).toBe('19:28');
  });

  it('reports failure when offline and no cache', async () => {
    const cache = memCache();
    const res = await fetchPrayerTimes(23, cache, failingHttp());
    expect(res.ok).toBe(false);
    expect(res.prayers).toBeNull();
  });

  it('ignores cache from another city', async () => {
    const cache = memCache(FX);
    const res = await fetchPrayerTimes(9999, cache, failingHttp());
    expect(res.ok).toBe(false);
  });
});