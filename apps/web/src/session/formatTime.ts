const timeFormat = new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "11:42 am" today, otherwise "10 Oct 2026, 11:42 am". */
export function formatWhen(at: number | string, now: number = Date.now()): string {
  const date = new Date(at);
  return new Date(now).toDateString() === date.toDateString()
    ? timeFormat.format(date)
    : dateTimeFormat.format(date);
}
