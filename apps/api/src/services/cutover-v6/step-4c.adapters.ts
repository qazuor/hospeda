import type { RevalidationService } from '@repo/service-core';
import type { PagePurger } from './step-4c.service.js';

/** Raised when step 4c would report a purge from a no-op service adapter. */
export class Step4cNoOpAdapterError extends Error {
    constructor() {
        super('Step 4c refuses to run with NoOpRevalidationAdapter.');
        this.name = 'Step4cNoOpAdapterError';
    }
}

/** Adapts the application revalidation service to the step 4c purge port. */
export function createRevalidationPagePurger({
    service
}: {
    readonly service: RevalidationService;
}): PagePurger {
    if (service.getAdapterName() === 'NoOpRevalidationAdapter') {
        throw new Step4cNoOpAdapterError();
    }
    return {
        async purge({ tags }) {
            const results = await service.revalidateTags({
                tags,
                triggeredBy: 'system',
                trigger: 'manual',
                reason: 'cutover step 4c',
                entityType: 'cutover'
            });
            if (results.length === 0) return { ok: false, failed: tags };
            const failed = results.flatMap((result, index) =>
                result.success ? [] : [tags[index] ?? result.target]
            );
            return { ok: failed.length === 0, failed };
        }
    };
}
