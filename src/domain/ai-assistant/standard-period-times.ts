export interface StandardPeriodTime {
  period: number;
  session: 'morning' | 'afternoon';
  periodInSession: number;
  startTime: string;
  endTime: string;
}

export const STANDARD_PERIOD_TIMES: readonly StandardPeriodTime[] = [
  // Morning: Tiết 1..5
  { period: 1, session: 'morning', periodInSession: 1, startTime: '07:00', endTime: '07:45' },
  { period: 2, session: 'morning', periodInSession: 2, startTime: '07:50', endTime: '08:35' },
  { period: 3, session: 'morning', periodInSession: 3, startTime: '08:50', endTime: '09:35' },
  { period: 4, session: 'morning', periodInSession: 4, startTime: '09:40', endTime: '10:25' },
  { period: 5, session: 'morning', periodInSession: 5, startTime: '10:30', endTime: '11:15' },
  // Afternoon: Tiết 1/6..5/10
  { period: 6, session: 'afternoon', periodInSession: 1, startTime: '13:30', endTime: '14:15' },
  { period: 7, session: 'afternoon', periodInSession: 2, startTime: '14:20', endTime: '15:05' },
  { period: 8, session: 'afternoon', periodInSession: 3, startTime: '15:20', endTime: '16:05' },
  { period: 9, session: 'afternoon', periodInSession: 4, startTime: '16:10', endTime: '16:55' },
  { period: 10, session: 'afternoon', periodInSession: 5, startTime: '17:00', endTime: '17:45' },
];

export function getStandardPeriodTime(
  period: number,
  session?: 'morning' | 'afternoon',
): StandardPeriodTime | undefined {
  if (session === 'afternoon' && period >= 1 && period <= 5) {
    return STANDARD_PERIOD_TIMES.find(
      (p) => p.session === 'afternoon' && p.periodInSession === period,
    );
  }
  return STANDARD_PERIOD_TIMES.find((p) => p.period === period);
}

export function formatStandardPeriodTimesTable(): string {
  const morningLines = STANDARD_PERIOD_TIMES.filter((p) => p.session === 'morning')
    .map((p) => `- Tiết ${p.period} (Sáng): ${p.startTime}–${p.endTime}`)
    .join('\n');
  const afternoonLines = STANDARD_PERIOD_TIMES.filter((p) => p.session === 'afternoon')
    .map(
      (p) =>
        `- Tiết ${p.periodInSession} Chiều / Tiết ${p.period}: ${p.startTime}–${p.endTime}`,
    )
    .join('\n');
  return `Sáng:\n${morningLines}\nChiều:\n${afternoonLines}`;
}
