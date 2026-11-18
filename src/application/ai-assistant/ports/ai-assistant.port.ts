import { AiScheduleDraftItem } from '../../../domain/ai-assistant/ai-schedule-draft.vo';
import { StandardPeriodTime } from '../../../domain/ai-assistant/standard-period-times';
import { ScheduleCategory } from '../../../domain/timetable/schedule-category.vo';

export const AI_ASSISTANT_PORT = Symbol('AI_ASSISTANT_PORT');

export interface AiAssistantTimetableSlotContext {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  category: ScheduleCategory;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface AiAssistantClassSessionContext {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  grade?: string | null;
  room?: string | null;
  category: ScheduleCategory;
  topic?: string | null;
  cancelled: boolean;
  isAdHoc: boolean;
}

export interface AiAssistantTaskContext {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  category: string;
  priority: string;
  completed: boolean;
  notes?: string | null;
}

export interface AiAssistantNoteContext {
  id: string;
  title: string;
  content?: string | null;
  dueDate?: string | null;
  remindTime?: string | null;
  completed: boolean;
}

export interface AiAssistantContext {
  accountId?: string;
  today: string;
  weekday: number;
  timeZone: string;
  locale: string;
  windowFrom: string;
  windowTo: string;
  standardPeriodTimes: readonly StandardPeriodTime[];
  timetableSlots: AiAssistantTimetableSlotContext[];
  classSessions: AiAssistantClassSessionContext[];
  tasks: AiAssistantTaskContext[];
  notes: AiAssistantNoteContext[];
}

export interface GenerateAiReplyInput {
  message?: string;
  image?: {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  };
  history?: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  context: AiAssistantContext;
}

export interface GenerateAiReplyOutput {
  reply: string;
  draftItems?: AiScheduleDraftItem[];
}

export interface AiAssistantPort {
  generateReply(input: GenerateAiReplyInput): Promise<GenerateAiReplyOutput>;
}
