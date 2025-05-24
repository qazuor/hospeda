import type { RecurrenceTypeEnum } from '../../enums/recurrence.enum.js';

export interface EventDateType {
    start: Date;
    end?: Date;
    isAllDay?: boolean;
    recurrence?: RecurrenceTypeEnum;
}
