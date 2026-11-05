import { addDays, endOfWeek, format, startOfMonth, startOfWeek, endOfMonth } from "date-fns";
import type { Milestone } from "./milestones";

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export function calendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Only patch the existing milestone deadline; task dates and actual history are untouched. */
export function deadlineMove(milestone: Pick<Milestone, "id" | "version" | "targetDate">, target: string | null) {
  if (target !== null && !/^\d{4}-\d{2}-\d{2}$/.test(target)) return null;
  if ((milestone.targetDate ?? null) === target) return null;
  return { id: milestone.id, data: { expectedVersion: milestone.version, targetDate: target } };
}