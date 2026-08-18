/**
 * @fileoverview
 * AC-4: an entity the site would no longer serve is never announced (HOS-585).
 *
 * The trap this closes is not an oversight, it is a genuine conflict of intent
 * between two consumers of the same hook. A cache purge and a search
 * notification want OPPOSITE things from an unpublish: purging the page that
 * just disappeared is the entire point, so `scheduleRevalidation` fires on
 * `ACTIVE → DRAFT` deliberately (the comment lives at that call site in
 * `accommodation.service.ts`). Riding the same hook means seeing the unpublish
 * too — and announcing a URL that now 404s is precisely what IndexNow
 * penalizes.
 *
 * Checked at FLUSH, not at schedule time, for the same reason the toggle is:
 * the database at send time is the truth, and an entity published and
 * unpublished inside one 30-second window must not go out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    IndexNowAdapter,
    NotifiableEntity
} from '../../src/indexnow/adapters/indexnow.adapter.js';
import { IndexNowService } from '../../src/indexnow/indexnow.service.js';
import type { EntityChangeData } from '../../src/revalidation/entity-change.types.js';

function makeAdapter() {
    const notify = vi.fn(async (_params: { readonly entities: readonly NotifiableEntity[] }) => ({
        success: true,
        submitted: 1,
        durationMs: 1
    }));
    return { adapter: { name: 'test', notify } as unknown as IndexNowAdapter, notify };
}

/** The slugs the fake site considers publicly visible. */
function visibilityOracle(publicSlugs: readonly string[]) {
    return vi.fn(async (entity: NotifiableEntity) => publicSlugs.includes(entity.slug));
}

function makeService(params: {
    readonly adapter: IndexNowAdapter;
    readonly isPubliclyVisible: (entity: NotifiableEntity) => Promise<boolean>;
}) {
    return new IndexNowService({
        adapter: params.adapter,
        isEnabled: async () => true,
        isPubliclyVisible: params.isPubliclyVisible,
        debounceMs: 1000
    });
}

const event = (entityType: string, slug: string) => ({ entityType, slug }) as EntityChangeData;

describe('IndexNow visibility filter (AC-4)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('announces an entity that is still public', async () => {
        const { adapter, notify } = makeAdapter();
        const service = makeService({
            adapter,
            isPubliclyVisible: visibilityOracle(['hotel-x'])
        });

        service.scheduleNotification(event('accommodation', 'hotel-x'));
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls[0]?.[0].entities).toEqual([
            { entityType: 'accommodation', slug: 'hotel-x' }
        ]);
    });

    it('announces NOTHING for an entity that was unpublished before the window closed', async () => {
        const { adapter, notify } = makeAdapter();
        const service = makeService({
            adapter,
            // The site no longer serves it — the exact ACTIVE → DRAFT case the
            // revalidation hook fires on by design.
            isPubliclyVisible: visibilityOracle([])
        });

        service.scheduleNotification(event('accommodation', 'hotel-x'));
        await vi.advanceTimersByTimeAsync(1000);

        // Not "an empty submission" — no request at all.
        expect(notify).not.toHaveBeenCalled();
    });

    it('drops only the invisible entities and still announces the rest', async () => {
        const { adapter, notify } = makeAdapter();
        const service = makeService({
            adapter,
            isPubliclyVisible: visibilityOracle(['guia', 'colon'])
        });

        service.scheduleNotification(event('post', 'guia'));
        service.scheduleNotification(event('accommodation', 'hotel-x'));
        service.scheduleNotification(event('destination', 'colon'));
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls[0]?.[0].entities.map((e) => e.slug)).toEqual(['guia', 'colon']);
    });

    it('is asked about every entity, not just the first', async () => {
        const { adapter } = makeAdapter();
        const isPubliclyVisible = visibilityOracle(['a', 'b']);
        const service = makeService({ adapter, isPubliclyVisible });

        service.scheduleNotification(event('post', 'a'));
        service.scheduleNotification(event('post', 'b'));
        await vi.advanceTimersByTimeAsync(1000);

        expect(isPubliclyVisible).toHaveBeenCalledTimes(2);
    });

    it('fails closed when the check throws, without losing the others', async () => {
        const { adapter, notify } = makeAdapter();
        const isPubliclyVisible = vi.fn(async (entity: NotifiableEntity) => {
            if (entity.slug === 'broken') throw new Error('database unreachable');
            return true;
        });
        const service = makeService({ adapter, isPubliclyVisible });

        service.scheduleNotification(event('post', 'broken'));
        service.scheduleNotification(event('post', 'fine'));
        await vi.advanceTimersByTimeAsync(1000);

        // An unreadable row is not announced — and it does not silence the rest.
        expect(notify.mock.calls[0]?.[0].entities.map((e) => e.slug)).toEqual(['fine']);
    });

    it('is read at flush, so a mid-window unpublish stops the send', async () => {
        const { adapter, notify } = makeAdapter();
        let stillPublic = true;
        const service = makeService({
            adapter,
            isPubliclyVisible: async () => stillPublic
        });

        service.scheduleNotification(event('event', 'fiesta'));
        // The owner unpublishes while the coalescing window is open. A value
        // captured at schedule time would send anyway.
        stillPublic = false;
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).not.toHaveBeenCalled();
    });

    it('never asks when the toggle is off — the cheaper gate runs first', async () => {
        const { adapter } = makeAdapter();
        const isPubliclyVisible = visibilityOracle(['guia']);
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => false,
            isPubliclyVisible,
            debounceMs: 1000
        });

        service.scheduleNotification(event('post', 'guia'));
        await vi.advanceTimersByTimeAsync(1000);

        // Ordering matters for cost, not correctness: the toggle is one cached
        // read, the visibility check is one query per entity.
        expect(isPubliclyVisible).not.toHaveBeenCalled();
    });
});
