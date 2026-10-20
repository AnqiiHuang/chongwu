import { EMPLOYEES } from '../content/world';
import type { GameCalendar, Season, Weather } from './types';

export const ACTION_TIMES = ['09:00', '11:00', '13:30', '16:00', '18:30', '22:30'] as const;

export function timeLabel(actionIndex: number): string {
  return ACTION_TIMES[Math.max(0, Math.min(5, actionIndex))] ?? '22:30';
}

export function actionsLeft(actionIndex: number): number {
  return Math.max(0, 5 - actionIndex);
}

export function minutesOf(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function onDuty(employeeId: string, actionIndex: number): boolean {
  const employee = EMPLOYEES[employeeId];
  if (!employee) return false;
  const now = minutesOf(timeLabel(actionIndex));
  return now >= minutesOf(employee.shiftStart) && now < minutesOf(employee.shiftEnd);
}

export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

export const WEATHER_LABEL: Record<Weather, string> = {
  sunny: '晴',
  cloudy: '阴',
  rain: '小雨',
};

export function absoluteDay(year: number, month: number, day: number): number {
  return (year - 1) * 360 + (month - 1) * 30 + day;
}

export function makeCalendar(year: number, month: number, day: number, weather: Weather): GameCalendar {
  return {
    year,
    month,
    day,
    absoluteDay: absoluteDay(year, month, day),
    dayId: `${year}-${month}-${day}`,
    weather,
  };
}

export function nextDate(calendar: GameCalendar): { year: number; month: number; day: number } {
  let { year, month, day } = calendar;
  day += 1;
  if (day > 30) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return { year, month, day };
}

export function dateLabel(calendar: GameCalendar): string {
  return `第${calendar.year}年 ${calendar.month}月${calendar.day}日`;
}

export function isWeekend(calendar: GameCalendar): boolean {
  const mod = calendar.absoluteDay % 7;
  return mod === 0 || mod === 6;
}

export function isOpeningDay(calendar: GameCalendar | null): boolean {
  return !!calendar && calendar.year === 1 && calendar.month === 3 && calendar.day === 1;
}

export function xpToNext(level: number): number {
  return 60 + 20 * (level - 1);
}
