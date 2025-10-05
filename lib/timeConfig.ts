export function getGlobalTimezone(): string {
  return process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
}

export function getGlobalReminderHour(): number {
  const raw = process.env.GLOBAL_REMINDER_HOUR || '9';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 9;
}


