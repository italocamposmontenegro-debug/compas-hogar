// ============================================
// Casa Clara — Fechas Chile (America/Santiago)
// ============================================

const TIMEZONE = 'America/Santiago';
const LOCALE = 'es-CL';

/**
 * Formatea una fecha en dd-mm-aaaa
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formatea fecha larga: "15 de marzo de 2026"
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
}

/**
 * Formatea fecha corta: "15 mar"
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: TIMEZONE,
  });
}

/**
 * Nombre del mes: "Marzo 2026"
 */
export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const monthName = d.toLocaleDateString(LOCALE, { month: 'long', timeZone: TIMEZONE });
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

/**
 * Obtener mes y año actual en Chile
 */
export function getCurrentMonthYear(): { year: number; month: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
  return { year, month };
}

/**
 * Primer y último día del mes
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // último día del mes
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Días restantes en el mes actual
 */
export function daysRemainingInMonth(): number {
  const { year, month } = getCurrentMonthYear();
  const lastDay = new Date(year, month, 0).getDate();
  const today = new Date().getDate();
  return Math.max(0, lastDay - today);
}

/**
 * ¿La fecha es de hoy?
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

/**
 * ¿La fecha ya pasó?
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
