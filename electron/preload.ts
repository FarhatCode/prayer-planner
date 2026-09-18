import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  setTasks: (tasks: unknown) => ipcRenderer.invoke('tasks:set', tasks),
  getState: () => ipcRenderer.invoke('state:get'),
  refreshPrayers: () => ipcRenderer.invoke('prayer:refresh'),
  getCities: () => ipcRenderer.invoke('cities:get'),
  fetchCities: () => ipcRenderer.invoke('cities:fetch'),
  buildSchedule: (date?: string) => ipcRenderer.invoke('schedule:build', date),
  getPlan: () => ipcRenderer.invoke('plan:get'),
  registerAlarms: () => ipcRenderer.invoke('alarms:register'),
  listAlarms: () => ipcRenderer.invoke('alarms:list'),
  testAlarm: () => ipcRenderer.invoke('alarm:test'),
  alarmUrl: ipcRenderer.sendSync('alarm:url') as string
};

export type ApiType = typeof api;

contextBridge.exposeInMainWorld('api', api);