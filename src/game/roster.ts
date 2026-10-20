import { EMPLOYEES } from '../content/world';
import { onDuty } from './time';
import type { EmployeeState, GameState } from './types';

export const HIRE_IDS = ['su_tao', 'lin_xu', 'tang_li'] as const;
export type HireId = (typeof HIRE_IDS)[number];

export const WAGE_BY_ID: Record<HireId, number> = {
  su_tao: 130,
  lin_xu: 120,
  tang_li: 100,
};

export const STAFF_FRAME: Record<HireId, string> = {
  su_tao: 'sutao.front',
  lin_xu: 'linxu.front',
  tang_li: 'tangli.front',
};

export function isHireId(id: string): id is HireId {
  return (HIRE_IDS as readonly string[]).includes(id);
}

export function dailyWage(employees: Record<string, EmployeeState>): number {
  return Object.keys(employees).reduce((sum, id) => sum + (isHireId(id) ? WAGE_BY_ID[id] : 0), 0);
}

export function activeEmployees(state: GameState): HireId[] {
  return HIRE_IDS.filter((id) => !!state.employees[id]);
}

export function primaryHelper(state: GameState): string {
  const first = activeEmployees(state)[0];
  return first ? EMPLOYEES[first].name : '店主';
}

export function staffGate(state: GameState, employeeId: string, label: string, actionIndex: number, blockTrained = false): string | null {
  if (!state.employees[employeeId]) return `${label}没有加入这家店。可以用不需要这位员工的办法。`;
  if (!onDuty(employeeId, actionIndex)) return `${label}这个时段不在店里，可以改选不需要当班员工的办法。`;
  if (blockTrained && state.employees[employeeId]?.trainedToday) return `${label}今天在培训，不能同时做这项服务。`;
  return null;
}

export function morningCrew(state: GameState): string {
  const names = activeEmployees(state).map((id) => EMPLOYEES[id].name);
  if (!names.length) return '店主把水和饭准备好了。';
  return `${names.join('、')}把水和饭准备好了。`;
}
