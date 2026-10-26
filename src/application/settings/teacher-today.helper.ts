import { Clock } from '../shared/ports/clock.port';
import {
  calculateTeacherToday,
  TeacherToday,
} from '../../domain/settings/teacher-today.helper';

export { TeacherToday };

export function getTeacherToday(clockOrDate: Clock | Date, timeZone: string): TeacherToday {
  const date = 'now' in clockOrDate ? clockOrDate.now() : clockOrDate;
  return calculateTeacherToday(date, timeZone);
}
