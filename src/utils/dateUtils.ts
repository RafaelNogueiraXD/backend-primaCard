export function addDays(date: Date, days: number, hours = 0, minutes = 0): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(result.getHours() + hours);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000);
}

export function differenceInMinutes(date1: Date, date2: Date): number {
  return Math.floor((date1.getTime() - date2.getTime()) / 60000);
}

export function differenceInHours(date1: Date, date2: Date): number {
  return Math.floor((date1.getTime() - date2.getTime()) / 3600000);
}

export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function formatToISO(date: Date): string {
  return date.toISOString();
}
