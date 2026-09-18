import type { CityItem, CityMap, DayPlan, PrayerFetchResult, RegisterResult, Settings, Task, UpdateState } from '../shared/types';

declare global {
  interface Window {
    api: {
      getSettings(): Promise<Settings>;
      setSettings(p: Partial<Settings>): Promise<Settings>;
      getTasks(): Promise<Task[]>;
      setTasks(t: Task[]): Promise<boolean>;
      getState(): Promise<UpdateState>;
      refreshPrayers(): Promise<PrayerFetchResult>;
      getCities(): Promise<CityMap>;
      searchCities(q: string): Promise<CityItem[]>;
      buildSchedule(date?: string): Promise<DayPlan>;
      getPlan(): Promise<DayPlan | null>;
      registerAlarms(): Promise<RegisterResult>;
      listAlarms(): Promise<string[]>;
      testAlarm(): Promise<void>;
      alarmUrl: string;
    };
  }
}

export {};