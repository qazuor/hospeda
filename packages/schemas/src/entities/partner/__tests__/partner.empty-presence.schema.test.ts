import { describe, expect, it } from 'vitest';
import {
    PartnerEmptyPresenceParamsSchema,
    PartnerEmptyPresenceRequestSchema,
    PartnerEmptyPresenceResponseSchema
} from '../partner.empty-presence.schema.js';

const id = 'd2719a12-d0c2-4d0b-8e95-f4356c6608dc';

describe('AC:V8b:6 ACC:25 empty presence schemas', () => {
    it('accepts the minimal request and returns a trimmed reason', () => {
        expect(
            PartnerEmptyPresenceRequestSchema.parse({ reason: '  Owner request  ', confirm: true })
        ).toEqual({ reason: 'Owner request', confirm: true });
    });

    it.each([
        { confirm: true },
        { reason: '   ', confirm: true },
        { reason: 'x'.repeat(501), confirm: true },
        { reason: 'owner request' },
        { reason: 'owner request', confirm: false },
        { reason: 'owner request', confirm: 'true' },
        { reason: 'owner request', confirm: true, extra: true }
    ])('rejects invalid request body %#', (input) => {
        expect(PartnerEmptyPresenceRequestSchema.safeParse(input).success).toBe(false);
    });

    it('accepts the parameter and exact response shape', () => {
        expect(PartnerEmptyPresenceParamsSchema.safeParse({ id }).success).toBe(true);
        expect(PartnerEmptyPresenceParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(
            false
        );
        expect(
            PartnerEmptyPresenceResponseSchema.parse({
                id,
                clearedFields: ['description'],
                remoteAssetsDeleted: 0,
                remoteAssetsSkipped: 0
            })
        ).toEqual({
            id,
            clearedFields: ['description'],
            remoteAssetsDeleted: 0,
            remoteAssetsSkipped: 0
        });
    });
});
