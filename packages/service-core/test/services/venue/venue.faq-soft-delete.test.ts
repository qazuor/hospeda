/**
 * HOS-2663 regression: a soft-deleted venue FAQ must not come back in the
 * `faqs` relation that `getById` / `getBySlug` hand to the owner editor.
 *
 * `findOneWithRelations` loads relations regardless of `deletedAt` (ADR-023),
 * so the service has to strip them in `_afterGetByField`.
 */
import type { Venue } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor } from '../../../src/types';

const actor: Actor = { id: '00000000-0000-4000-a000-000000000002', roles: [], permissions: [] };

function makeService(): VenueService {
    // biome-ignore lint/suspicious/noExplicitAny: test access to protected instance fields
    const service: any = new VenueService({});
    service._venueMediaModelInstance = {
        findByVenues: vi.fn().mockResolvedValue(new Map())
    };
    return service as VenueService;
}

const venueWithFaqs = (faqs: unknown[]): Venue =>
    ({ id: '00000000-0000-4000-a000-000000000001', faqs }) as unknown as Venue;

describe('VenueService._afterGetByField - soft-deleted FAQs (HOS-2663)', () => {
    it('drops FAQs that carry a deletedAt', async () => {
        const service = makeService();
        const entity = venueWithFaqs([
            { id: 'live', question: 'q1', deletedAt: null },
            { id: 'gone', question: 'q2', deletedAt: new Date('2026-11-26') }
        ]);

        const result = await (service as any)._afterGetByField(entity, actor, {});

        const ids = (result.faqs as { id: string }[]).map((f) => f.id);
        expect(ids).toEqual(['live']);
    });

    it('keeps an empty faqs array and a venue without the relation untouched', async () => {
        const service = makeService();
        const hook = (service as any)._afterGetByField.bind(service);

        expect((await hook(venueWithFaqs([]), actor, {})).faqs).toEqual([]);
        expect(
            (await hook({ id: '00000000-0000-4000-a000-000000000001' } as Venue, actor, {})).faqs
        ).toBeUndefined();
    });
});
