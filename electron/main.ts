import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AlarmPayload, DayPlan, PrayerFetchResult, RegisterResult, Settings, Task, UpdateState } from '../shared/types';
import { toHHMM } from '../src/lib/fmt';
import { fetchPrayerTimes, searchCities, type CacheStore } from '../src/lib/prayerTimes';
import { buildDayPlan } from '../src/lib/scheduler';
import { AlarmEngine } from './alarmEngine';
import { storage, todayStr } from './storage';
import { listTaskNames, registerDayTasks, type LaunchInfo } from './taskScheduler';

app.setAppUserModelId('com.moyden.app');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const devServer = process.env.VITE_DEV_SERVER_URL || '';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
const alarmWindows = new Set<BrowserWindow>();

const prayerCacheStore: CacheStore = {
  read: () => storage.prayerCache(),
  write: (c) => storage.setPrayerCache(c)
};

function preloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function rendererIndex(): string {
  return path.join(app.getAppPath(), 'dist', 'index.html');
}

function showMain(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    show: false,
    title: 'Мой день',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: path.join(app.getAppPath(), 'resources', 'icon.png'),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (devServer) win.loadURL(devServer);
  else win.loadFile(rendererIndex());
  win.once('ready-to-show', () => {
    if (!quitting) win.show();
  });
  win.on('close', (e) => {
    if (!quitting && storage.settings().closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

function positionAlarm(win: BrowserWindow): void {
  const wa = (
    mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  ).workArea;
  const [w, h] = win.getSize();
  win.setPosition(wa.x + wa.width - w - 16, wa.y + wa.height - h - 16);
}

function openAlarm(payload: AlarmPayload): void {
  const data = Buffer.from(
    JSON.stringify({ ...payload, volume: storage.settings().volume }),
    'utf8'
  ).toString('base64url');
  const win = new BrowserWindow({
    width: 480,
    height: 240,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (devServer) {
    win.loadURL(`${devServer.replace(/\/$/, '')}/?route=alarm&payload=${data}`);
  } else {
    win.loadFile(rendererIndex(), { query: { route: 'alarm', payload: data } });
  }
  win.once('ready-to-show', () => {
    positionAlarm(win);
    win.show();
  });
  win.on('closed', () => alarmWindows.delete(win));
  alarmWindows.add(win);
}

function createTray(): void {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip('Мой день — планировщик');
  const menu = Menu.buildFromTemplate([
    { label: 'Открыть', click: () => showMain() },
    {
      label: 'Проверить звук',
      click: () =>
        openAlarm({
          entry: {
            time: toHHMM(new Date().getHours() * 60 + new Date().getMinutes()),
            type: 'study',
            title: 'Тест будильника',
            text: 'Это проверка громкого звука. Закройте окно, чтобы остановить звук.',
            desc: ''
          },
          test: true
        })
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => showMain());
}

function launchInfo(): LaunchInfo {
  if (app.isPackaged) {
    return { exe: process.execPath, prefixArgs: [] };
  }
  return { exe: process.execPath, prefixArgs: [app.getAppPath()] };
}

function alarmAudioUrl(): string {
  if (devServer) return `${devServer.replace(/\/$/, '')}/alarm.wav`;
  return pathToFileURL(path.join(process.resourcesPath, 'alarm.wav')).href;
}

function lookupPrayer(cityId: number): PrayerFetchResult {
  const c = storage.prayerCache();
  if (c && c.cityId === cityId) {
    return {
      ok: true,
      offline: true,
      fromCache: true,
      sourceDate: c.date,
      fetchedAt: c.fetchedAt,
      prayers: c.praytimes,
      attributes: c.attributes
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
    error: 'нет кэша намазов'
  };
}

async function refreshPrayersBestEffort(): Promise<void> {
  try {
    const s = storage.settings();
    const cache = storage.prayerCache();
    if (!cache || cache.date !== todayStr()) {
      await fetchPrayerTimes(s.cityId, prayerCacheStore);
    }
  } catch {
    /* offline — keep cache */
  }
}

function parseCliAlarm(argv: string[]): AlarmPayload | null {
  const idx = argv.indexOf('--alarm');
  if (idx === -1 || idx + 1 >= argv.length) return null;
  try {
    const payload = JSON.parse(Buffer.from(argv[idx + 1], 'base64url').toString('utf8')) as AlarmPayload;
    if (payload && payload.entry && payload.entry.time) return payload;
  } catch {
    return null;
  }
  return null;
}

function setupIpc(): void {
  ipcMain.handle('settings:get', () => storage.settings());
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => storage.setSettings(patch));

  ipcMain.handle('tasks:get', () => storage.tasks());
  ipcMain.handle('tasks:set', (_e, tasks: Task[]) => {
    storage.setTasks(tasks);
    return true;
  });

  ipcMain.handle('state:get', (): UpdateState => {
    const settings = storage.settings();
    return { settings, tasks: storage.tasks(), prayer: lookupPrayer(settings.cityId) };
  });

  ipcMain.handle('prayer:refresh', async (): Promise<PrayerFetchResult> => {
    const s = storage.settings();
    const res = await fetchPrayerTimes(s.cityId, prayerCacheStore);
    if (res.ok && res.attributes && res.attributes.CityName && s.cityName !== res.attributes.CityName) {
      storage.setSettings({ cityName: res.attributes.CityName });
    }
    return res;
  });

  ipcMain.handle('cities:get', () => storage.cities());
  ipcMain.handle('cities:search', async (_e, q: string) => {
    try {
      return await searchCities(String(q ?? '').trim());
    } catch {
      return [];
    }
  });

  ipcMain.handle('schedule:build', async (_e, date?: string): Promise<DayPlan> => {
    const settings = storage.settings();
    let cache = storage.prayerCache();
    let fromCache = cache !== null;
    if (!cache) {
      const res = await fetchPrayerTimes(settings.cityId, prayerCacheStore);
      fromCache = res.fromCache;
      cache = storage.prayerCache();
    }
    if (!cache) {
      throw new Error(
        'Нет времен намазов (офлайн и нет кэша). Подключитесь к интернету один раз или укажите город в настройках.'
      );
    }
    const plan = buildDayPlan({ settings, tasks: storage.tasks(), prayers: cache, date: date ?? todayStr() });
    plan.fromCache = fromCache;
    plan.sourceDate = cache.date;
    storage.setPlan(plan.date, plan);
    return plan;
  });

  ipcMain.handle('plan:get', () => storage.todayPlan());

  ipcMain.handle('alarms:register', async (): Promise<RegisterResult> => {
    const settings = storage.settings();
    const plan = storage.todayPlan();
    if (!plan) throw new Error('Сначала постройте расписание на сегодня.');
    if (settings.useTaskScheduler) {
      return registerDayTasks(plan, launchInfo());
    }
    engine.reset();
    return { mode: 'tray', registered: 0, skipped: 0, taskNames: [] };
  });

  ipcMain.handle('alarms:list', () => listTaskNames());

  ipcMain.handle('alarm:test', () =>
    openAlarm({
      entry: {
        time: toHHMM(new Date().getHours() * 60 + new Date().getMinutes()),
        type: 'study',
        title: 'Тест будильника',
        text: 'Это проверка громкого звука. Закройте окно, чтобы остановить звук.',
        desc: ''
      },
      test: true
    })
  );

  ipcMain.handle('alarm:url', () => alarmAudioUrl());
}

const engine = new AlarmEngine({
  getSettings: () => storage.settings(),
  getPlan: (d) => storage.plan(d),
  openAlarm
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    showMain();
    const cli = parseCliAlarm(argv);
    if (cli) openAlarm(cli);
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createTray();
    setupIpc();
    engine.start();
    refreshPrayersBestEffort();
    const cli = parseCliAlarm(process.argv);
    if (cli) openAlarm(cli);
    else createMainWindow();
  });

  app.on('window-all-closed', () => {
    if (quitting) app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('will-quit', () => {
    engine.stop();
    for (const w of alarmWindows) w.destroy();
  });
}