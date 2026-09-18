# Мой день

Персональный планировщик дня вокруг времён намаза для Windows (Electron + Vite + React + TypeScript).

[![Build Windows](https://github.com/anomalyco/prayer-planner/actions/workflows/build-windows.yml/badge.svg)](https://github.com/anomalyco/prayer-planner/actions/workflows/build-windows.yml)

## Возможности

- **Задачи → слоты**: каждая задача нарезается на слоты по 45 минут с перерывами между ними. Слот учёбы никогда не ужимается.
- **Умное размещение**: при нехватке места сначала сокращаются перерывы (но не меньше заданного минимума), затем переносятся помеченные «переносить» задачи в окна с наибольшим запасом, иначе задача попадает в примечания — молча ничего не обрезается.
- **Окна между намазами** (Фаджр→Зухр, Зухр→Аср, Аср→Магриб, Магриб→Иша, Иша→Отбой) с настраиваемыми падами «перед»/«после», отдыхом в хвосте окна и подготовкой к следующему намазу.
- **Будильники на каждый слот** — громкий звуковой сигнал и окно-плашık, которое закрывается только вручную. Звонят даже когда окно свёрнуто или приложение закрыто (одноразовые задачи Windows Task Scheduler).
- **Офлайн**: времена намазов кэшируются; без интернета использовадается последний кэш с пометкой «офлайн» на экране.
- **Локальное хранение**: настройки, задачи и кэш хранятся в `%APPDATA%\prayer-planner`.

## Возможности из данных

Времена намазов и справочник городов — `https://namaztimes.kz` (по умолчанию Ханабад, id=23, но можно выбрать любой город).

## Запуск

```bash
npm.cmd install
npm run dev        # разработка (Electron + Vite, hot reload)
npm run build      # typecheck + сборка electron и renderer
npm test           # vitest (планировщик, формат времени, парсер API)
npm run dist       # сборка установщика/portable в release/
```

## Структура

```
shared/types.ts          # типы, DEFAULT_SETTINGS, DEFAULT_TASKS
src/lib/fmt.ts           # время HH:MM / минуты, даты, склонения
src/lib/prayerTimes.ts   # API намазов, кэш, офлайн
src/lib/scheduler.ts     # алгоритм расписания
src/screens/             # Задачи, Расписание, Настройки
src/components/          # CityPicker, TaskEditor, AlarmPopup
electron/                # main, preload, storage, Task Scheduler, будильник
```

## Лицензия

MIT