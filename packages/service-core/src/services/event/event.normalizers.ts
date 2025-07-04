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
    };
};

/**
 * Normalizes input data for updating an event.
 * Converts date fields from string to Date and IDs to branded types for compatibility with the model/domain type.
 * @param input - The raw input for event update (schema type)
 * @returns The normalized input as Partial<EventType>
 */
export const normalizeUpdateInput = (input: z.infer<typeof EventSchema>): Partial<EventType> => {
    const adminInfo = normalizeAdminInfo(input.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = input;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        date: input.date
            ? {
                  ...input.date,
                  start: new Date(input.date.start),
                  end: input.date.end ? new Date(input.date.end) : undefined
              }
            : undefined,
        locationId: input.locationId as EventType['locationId'],
        organizerId: input.organizerId as EventType['organizerId']
    };
};
