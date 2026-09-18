export function parseHHMM(s: string): number {
  const p = s.split(':');
  if (p.length !== 2) throw new Error(`bad time: ${s}`);
  const h = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error(`bad time: ${s}`);
  return h * 60 + m;
}

export function toHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function nowHHMM(): string {
  return toHHMM(new Date().getHours() * 60 + new Date().getMinutes());
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateRu(dateStr: string): string {
  const p = dateStr.split('-');
  if (p.length !== 3) return dateStr;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (Number.isNaN(d.getTime())) return dateStr;
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function hoursLabel(h: number): string {
  const s = hoursRu(h);
  return s;
}

export function hoursRu(h: number): string {
  const v = Math.round(h * 10) / 10;
  let n = v;
  const last = Math.floor(n) % 10;
  const prelast = Math.floor(n / 10) % 10;
  let w: string;
  if (n >= 2 && n <= 4 && (prelast !== 1)) w = 'часа';
  else if (n === 1) w = 'час';
  else if (prelast === 1 || last >= 5 || last === 0) w = 'часов';
  else w = 'часов';
  const s = String(v).replace('.', ',').replace(',0', '');
  return `${s} ${w}`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}