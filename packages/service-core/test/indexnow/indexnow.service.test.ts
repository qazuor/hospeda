/**
 * @fileoverview
 * Tests for {@link IndexNowService} (HOS-585 G-1).
 *
 * The behaviours worth guarding, in order of how quietly they break:
 *
 * 1. The toggle is read at FLUSH time, not when the event is queued (AC-12).
 *    Reading it early still works in every happy-path test and only fails when
 *    an operator turns it off during the debounce window — i.e. exactly when
 *    they are trying to stop something.
 * 2. Disabled means the adapter is never called, not that its result is ignored.
 * 3. Events with no public page are dropped rather than turned into a URL.
 * 4. Nothing throws. The caller is a hook next to a content write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    IndexNowAdapter,
    NotifiableEntity
} from '../../src/indexnow/adapters/indexnow.adapter.js';
import { IndexNowService, toNotifiableEntity } from '../../src/indexnow/indexnow.service.js';
import type { EntityChangeData } from '../../src/revalidation/entity-change.types.js';

/**
 * A stub adapter whose `notify` is typed with its real parameter, so the tests
 * can assert on `mock.calls[0][0].entities` without casting.
 */
const makeAdapter = () => {
    const notify = vi.fn(
        async (_params: { readonly entities: ReadonlyArray<NotifiableEntity> }) => ({
            success: true,
            submitted: 3,
            durationMs: 5
        })
    );
    return { adapter: { name: 'stub', notify } as unknown as IndexNowAdapter, notify };
};

describe('toNotifiableEntity', () => {
    it.each([
        ['accommodation', { entityType: 'accommodation', slug: 'hotel-x' }, 'accommodation'],
        ['destination', { entityType: 'destination', slug: 'colon' }, 'destination'],
        ['event', { entityType: 'event', slug: 'fiesta' }, 'event'],
        ['post', { entityType: 'post', slug: 'guia' }, 'post'],
        ['gastronomy', { entityType: 'gastronomy', slug: 'parrilla-x' }, 'gastronomy'],
        ['experience', { entityType: 'experience', slug: 'kayak-x' }, 'experience']
    ])('maps a %s to itself', (_label, event, expectedType) => {
        expect(toNotifiableEntity(event as EntityChangeData)?.entityType).toBe(expectedType);
    });

    it('folds an accommodation review into its parent accommodation', () => {
        const entity = toNotifiableEntity({
            entityType: 'accommodation_review',
            accommodationSlug: 'hotel-x'
        } as EntityChangeData);

        expect(entity).toEqual({ entityType: 'accommodation', slug: 'hotel-x' });
    });

    it('folds a destination review into its parent destination', () => {
        const entity = toNotifiableEntity({
            entityType: 'destination_review',
            destinationSlug: 'colon'
        } as EntityChangeData);

        expect(entity).toEqual({ entityType: 'destination', slug: 'colon' });
    });

    it.each(['tag', 'amenity'])('drops %s, which has no page of its own', (entityType) => {
        expect(toNotifiableEntity({ entityType } as EntityChangeData)).toBeUndefined();
    });

    /**
     * These three DO have pages and DO appear in the sitemap — dropping them is
     * a decision, not an omission. None is unconditionally public: a silver
     * partner 404s and a retired gold one answers 410, only POIs carrying
     * `hasOwnPage` render, and an attraction landing is closer to a facet than
     * to a detail page. Announcing a URL that answers 404 is what IndexNow
     * penalizes, and the visibility each needs is not knowable at this hook.
     */
    it.each([
        'attraction',
        'partner',
        'pointOfInterest'
    ])('drops %s, whose page is conditional, even WITH a slug', (entityType) => {
        expect(
            toNotifiableEntity({ entityType, slug: 'algo' } as EntityChangeData)
        ).toBeUndefined();
    });

    /**
     * `slug` is optional on every variant of the union — some call sites only
     * hold a UUID. Without a slug there is no URL to announce.
     */
    it.each([
        'accommodation',
        'destination',
        'event',
        'post',
        'gastronomy',
        'experience'
    ])('drops a slugless %s event', (entityType) => {
        expect(toNotifiableEntity({ entityType, id: 'uuid' } as EntityChangeData)).toBeUndefined();
    });

    /**
     * An accommodation event carries its parent destination, and the listing
     * did change — but announcing it on every edit is the resubmission
     * behaviour IndexNow penalizes.
     */
    it('does not cascade an accommodation event to its parent destination', () => {
        const entity = toNotifiableEntity({
            entityType: 'accommodation',
            slug: 'hotel-x',
            destinationSlug: 'colon'
        } as EntityChangeData);

        expect(entity).toEqual({ entityType: 'accommodation', slug: 'hotel-x' });
    });
});

describe('IndexNowService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('coalesces repeated events for the same entity into one notification', async () => {
        const { adapter, notify } = makeAdapter();
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => true,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);
        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);
        service.scheduleNotification({ entityType: 'event', slug: 'fiesta' } as EntityChangeData);

        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls.at(0)?.[0].entities).toHaveLength(2);
    });

    it('does not notify when nothing notifiable was scheduled', async () => {
        const { adapter, notify } = makeAdapter();
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => true,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'tag' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).not.toHaveBeenCalled();
    });

    it('does not call the adapter at all when the toggle is off', async () => {
        const { adapter, notify } = makeAdapter();
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => false,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).not.toHaveBeenCalled();
    });

    /**
     * AC-12, and the reason `isEnabled` is a function. The toggle flips OFF
     * after the event is queued but before the window elapses; nothing may go
     * out. A service that captured the value at schedule time passes every
     * other test in this file and fails only here.
     */
    it('reads the toggle at flush time, so turning it off mid-window stops the send', async () => {
        const { adapter, notify } = makeAdapter();
        let enabled = true;
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => enabled,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);
        enabled = false;
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).not.toHaveBeenCalled();
    });

    it('reads the toggle again on the next window rather than caching the first answer', async () => {
        const { adapter, notify } = makeAdapter();
        let enabled = false;
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => enabled,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'a' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);
        expect(notify).not.toHaveBeenCalled();

        enabled = true;
        service.scheduleNotification({ entityType: 'post', slug: 'b' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).toHaveBeenCalledTimes(1);
    });

    it('clears its queue after a flush so the next window starts empty', async () => {
        const { adapter, notify } = makeAdapter();
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => true,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'a' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);
        service.scheduleNotification({ entityType: 'post', slug: 'b' } as EntityChangeData);
        await vi.advanceTimersByTimeAsync(1000);

        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify.mock.calls.at(1)?.[0].entities).toEqual([{ entityType: 'post', slug: 'b' }]);
    });

    it('survives an adapter that throws, instead of failing the content write', async () => {
        const notify = vi.fn(async () => {
            throw new Error('boom');
        });
        const service = new IndexNowService({
            adapter: { name: 'exploding', notify } as unknown as IndexNowAdapter,
            isEnabled: async () => true,
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);

        await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow();
    });

    it('survives a toggle read that throws', async () => {
        const { adapter, notify } = makeAdapter();
        const service = new IndexNowService({
            adapter,
            isEnabled: async () => {
                throw new Error('db down');
            },
            debounceMs: 1000
        });

        service.scheduleNotification({ entityType: 'post', slug: 'guia' } as EntityChangeData);

        await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow();
        expect(notify).not.toHaveBeenCalled();
    });
});
