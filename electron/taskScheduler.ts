import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DayPlan, RegisterResult } from '../shared/types';

export const ALARM_PREFIX = 'MoyDen-';

function ps(script: string): { code: number; out: string; err: string } {
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true }
  );
  return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function psFile(file: string): { code: number; out: string; err: string } {
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true }
  );
  return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function sq(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function listTaskNames(): string[] {
  const r = ps(
    "Get-ScheduledTask | Where-Object { $_.TaskName -like 'MoyDen-*' } | Select-Object -ExpandProperty TaskName"
  );
  if (r.code !== 0 && !r.out.trim()) return [];
  return r.out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clearTasks(): void {
  ps("Get-ScheduledTask | Where-Object { $_.TaskName -like 'MoyDen-*' } | Unregister-ScheduledTask -Confirm:$false");
}

function parsePlanWhen(date: string, time: string): Date | null {
  const dp = date.split('-');
  const tp = time.split(':');
  if (dp.length !== 3 || tp.length !== 2) return null;
  const y = Number(dp[0]);
  const m = Number(dp[1]) - 1;
  const d = Number(dp[2]);
  const h = Number(tp[0]);
  const min = Number(tp[1]);
  if ([y, m, d, h, min].some((x) => !Number.isFinite(x))) return null;
  return new Date(y, m, d, h, min);
}

function whenStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

export interface LaunchInfo {
  exe: string;
  prefixArgs: string[];
}

export function registerDayTasks(plan: DayPlan, launch: LaunchInfo, now = new Date()): RegisterResult {
  clearTasks();

  const items: Array<{ name: string; when: string; arg: string }> = [];
  let skipped = 0;
  for (const e of plan.entries) {
    const when = parsePlanWhen(plan.date, e.time);
    if (!when) {
      skipped++;
      continue;
    }
    if (when.getTime() <= now.getTime()) {
      skipped++;
      continue;
    }
    const payload = b64url(JSON.stringify({ entry: e, test: false }));
    const prefix = [launch.exe, ...launch.prefixArgs].filter(Boolean).map((p) => `"${p.replace(/"/g, '')}"`).join(' ');
    const arg = `${prefix} --alarm "${payload}"`;
    items.push({ name: `${ALARM_PREFIX}${whenStr(when).replace(/[-: ]/g, '')}`, when: whenStr(when), arg })
  }

  if (items.length === 0) {
    return { mode: 'scheduler', registered: 0, skipped, taskNames: [] };
  }

  const scriptPath = path.join(os.tmpdir(), `moyden-alarms-${Date.now()}.ps1`);
  const lines: string[] = [
    `$items = @(`,
    ...items.map((it) => `  @{ Name = ${sq(it.name)}; When = ${sq(it.when)}; Arg = ${sq(it.arg)} }`),
    `)`,
    `$exe = ${sq(launch.exe)}`,
    `foreach ($it in $items) {`,
    `  try {`,
    `    $t = [datetime]::ParseExact($it.When, 'yyyy-MM-dd HH:mm', [Globalization.CultureInfo]::InvariantCulture)`,
    `    $action = New-ScheduledTaskAction -Execute $exe -Argument $it.Arg`,
    `    $trig = New-ScheduledTaskTrigger -Once -At $t`,
    `    $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun`,
    `    Register-ScheduledTask -TaskName $it.Name -Action $action -Trigger $trig -Settings $set -Force | Out-Null`,
    `    Write-Output ('OK ' + $it.Name)`,
    `  } catch {`,
    `    Write-Output ('FAIL ' + $it.Name + ' ' + $_.Exception.Message)`,
    `  }`,
    `}`
  ];
  try {
    fs.writeFileSync(scriptPath, lines.join('\n'), 'utf8');
    const res = psFile(scriptPath);
    const okCount = (res.out.match(/^OK /gm) ?? []).length;
    return {
      mode: 'scheduler',
      registered: okCount,
      skipped,
      taskNames: listTaskNames()
    };
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
  }
}