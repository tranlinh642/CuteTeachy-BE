import { TimetableSlot } from '../timetable/timetable-slot.entity';
import { Tone } from '../timetable/tone.vo';

export interface GeneratedClassSession {
  id: string;
  timetableSlotId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string;
  room?: string;
  tone: Tone;
  topic?: string;
  prepItems: { id: string; label: string; done: boolean }[];
  cancelled: boolean;
  updatedAt: string;
}

export function getWeekdayFromIsoDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const jsDay = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  return jsDay === 0 ? 7 : jsDay; // 1 = Monday ... 7 = Sunday
}

export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const [fY, fM, fD] = from.split('-').map(Number);
  const [tY, tM, tD] = to.split('-').map(Number);
  const current = new Date(Date.UTC(fY, fM - 1, fD));
  const end = new Date(Date.UTC(tY, tM - 1, tD));

  while (current.getTime() <= end.getTime()) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export function generateClassSessions(
  slots: readonly TimetableSlot[],
  from: string,
  to: string,
): GeneratedClassSession[] {
  const dates = enumerateDates(from, to);
  const sessions: GeneratedClassSession[] = [];

  for (const dateStr of dates) {
    const dayOfWeek = getWeekdayFromIsoDate(dateStr);

    for (const slot of slots) {
      if (slot.isDeleted()) {
        continue;
      }
      if (slot.weekday !== dayOfWeek) {
        continue;
      }

      const isEffective =
        slot.effectiveFrom <= dateStr &&
        (slot.effectiveTo === null || dateStr <= slot.effectiveTo);

      if (!isEffective) {
        continue;
      }

      const session: GeneratedClassSession = {
        id: `${slot.id}:${dateStr}`,
        timetableSlotId: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        tone: slot.tone,
        prepItems: [],
        cancelled: false,
        updatedAt: slot.updatedAt.toISOString(),
      };

      if (slot.grade !== null) {
        session.grade = slot.grade;
      }
      if (slot.room !== null) {
        session.room = slot.room;
      }

      sessions.push(session);
    }
  }

  sessions.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });

  return sessions;
}
