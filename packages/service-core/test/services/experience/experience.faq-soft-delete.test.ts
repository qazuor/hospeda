/**
 * HOS-2663 regression: a soft-deleted experience FAQ must not come back in the
 * `faqs` relation that `getById` / `getBySlug` hand to the owner editor.
 *
 * `findOneWithRelations` loads relations regardless of `deletedAt` (ADR-023),
 * so the service has to strip them in `_afterGetByField`.
 */
import type { Experience } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import type { Actor } from '../../../src/types';

const actor: Actor = { id: '00000000-0000-4000-a000-000000000002', roles: [], permissions: [] };

function makeService(): ExperienceService {
    // biome-ignore lint/suspicious/noExplicitAny: test access to protected instance fields
    const service: any = new ExperienceService({});
    service._experienceMediaModelInstance = {
        findByExperiences: vi.fn().mockResolvedValue(new Map())
    };
    return service as ExperienceService;
}

const experienceWithFaqs = (faqs: unknown[]): Experience =>
    ({ id: '00000000-0000-4000-a000-000000000001', faqs }) as unknown as Experience;

describe('ExperienceService._afterGetByField - soft-deleted FAQs (HOS-2663)', () => {
    it('drops FAQs that carry a deletedAt', async () => {
        const service = makeService();
        const entity = experienceWithFaqs([
            { id: 'live', question: 'q1', deletedAt: null },
            { id: 'gone', question: 'q2', deletedAt: new Date('2026-11-26') }
        ]);

        const result = await (service as any)._afterGetByField(entity, actor, {});

        const ids = (result.faqs as { id: string }[]).map((f) => f.id);
        expect(ids).toEqual(['live']);
    });

    it('keeps an empty faqs array and a experience without the relation untouched', async () => {
        const service = makeService();
        const hook = (service as any)._afterGetByField.bind(service);

        expect((await hook(experienceWithFaqs([]), actor, {})).faqs).toEqual([]);
        expect(
            (await hook({ id: '00000000-0000-4000-a000-000000000001' } as Experience, actor, {}))
                .faqs
        ).toBeUndefined();
    });
});
