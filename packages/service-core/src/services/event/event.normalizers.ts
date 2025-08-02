import type { EventSchema } from '@repo/schemas';
import type { EventType } from '@repo/types';
import type { z } from 'zod';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes input data for creating an event.
 * Converts date fields from string to Date and IDs to branded types for compatibility with the model/domain type.
 * @param input - The raw input for event creation (schema type)
 * @returns The normalized input as Partial<EventType>
 */
export const normalizeCreateInput = (input: z.infer<typeof EventSchema>): Partial<EventType> => {
    const adminInfo = normalizeAdminInfo(input.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = input;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        date: {
            ...input.date,
            start: new Date(input.date.start),
            end: input.date.end ? new Date(input.date.end) : undefined
        },
        locationId: input.locationId as EventType['locationId'],
        organizerId: input.organizerId as EventType['organizerId']
    } as Partial<EventType>;
};

/**
 * Normalizes input data for updating an event.
 * Converts date fields from string to Date and IDs to branded types for compatibility with the model/domain type.
 * @param input - The raw input for event update (schema type)
 * @returns The normalized input as Partial<EventType>
 */
export const normalizeUpdateInput = (
    input: { id: string } & Partial<z.infer<typeof EventSchema>>
): Partial<EventType> => {
    const adminInfo = normalizeAdminInfo(input.adminInfo);
    // Exclude the original date property from rest
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { adminInfo: _adminInfo, date: _date, id, ...rest } = input;
    let date: EventType['date'] | undefined = undefined;
    if (input.date?.start) {
        date = {
            ...input.date,
            start: new Date(input.date.start),
            end: input.date.end ? new Date(input.date.end) : undefined,
            isAllDay: input.date.isAllDay,
            recurrence: input.date.recurrence
        };
    }
    // Remove locationId and organizerId from rest to avoid type conflicts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locationId, organizerId, ...restWithoutIds } = rest;
    return {
        id,
        ...restWithoutIds,
        ...(adminInfo ? { adminInfo } : {}),
        ...(date ? { date } : {}),
        ...(locationId ? { locationId: locationId as EventType['locationId'] } : {}),
        ...(organizerId ? { organizerId: organizerId as EventType['organizerId'] } : {})
    } as Partial<EventType>;
};
