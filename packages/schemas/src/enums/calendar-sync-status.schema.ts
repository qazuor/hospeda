import { z } from 'zod';
import { CalendarSyncStatusEnum } from './calendar-sync-status.enum.js';

export const CalendarSyncStatusEnumSchema = z.nativeEnum(CalendarSyncStatusEnum, {
    error: () => ({ message: 'zodError.enums.calendarSyncStatus.invalid' })
});
export type CalendarSyncStatusSchema = z.infer<typeof CalendarSyncStatusEnumSchema>;
