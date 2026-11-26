/**
 * Coverage-changed gallery revalidation (HOS-2495 AC-18).
 */
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: { readonly userId: string; readonly vertical: string }) => void;

const mocks = vi.hoisted(() => ({
    listeners: [] as Listener[],
    error: vi.fn()
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            onCoverageChanged: (listener: Listener) => {
                mocks.listeners.push(listener);
                return () => {
                    mocks.listeners.splice(mocks.listeners.indexOf(listener), 1);
                };
            }
        }
    })
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: mocks.error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import {
    drainListingGalleryRevalidations,
    type GalleryRevalidationPorts,
    revalidateOwnerListingGalleries,
    subscribeListingGalleryRevalidation
} from '../../../src/utils/listing-media/gallery-coverage-revalidation';

function fakePorts(ids: readonly string[] = ['l-1', 'l-2']) {
    const calls: string[] = [];
    const ports = {
        invalidateUser: vi.fn(async ({ userId }: { userId: string }) => {
            calls.push(`invalidate:${userId}`);
        }),
        listPublishedListingIds: vi.fn(
            async ({ ownerId, vertical }: { ownerId: string; vertical: string }) => {
                calls.push(`list:${ownerId}:${vertical}`);
                return ids;
            }
        ),
        revalidate: vi.fn(
            async ({
                vertical,
                listingIds
            }: {
                vertical: string;
                listingIds: readonly string[];
            }) => {
                calls.push(`revalidate:${vertical}:${listingIds.join(',')}`);
            }
        )
    } satisfies GalleryRevalidationPorts;
    return { ports, calls };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('revalidateOwnerListingGalleries', () => {
    it('invalidates the snapshots first, then purges the published listings', async () => {
        // Arrange
        const { ports, calls } = fakePorts();

        // Act
        const result = await revalidateOwnerListingGalleries({
            userId: 'owner',
            vertical: VerticalEnum.VENUE,
            ports
        });

        // Assert
        expect(result).toEqual({ revalidated: ['l-1', 'l-2'] });
        expect(calls).toEqual(['invalidate:owner', 'list:owner:venue', 'revalidate:venue:l-1,l-2']);
    });

    it('skips the purge when the owner has no published listing', async () => {
        // Arrange
        const { ports, calls } = fakePorts([]);

        // Act
        const result = await revalidateOwnerListingGalleries({
            userId: 'owner',
            vertical: VerticalEnum.EXPERIENCE,
            ports
        });

        // Assert
        expect(result).toEqual({ revalidated: [] });
        expect(calls).toEqual(['invalidate:owner', 'list:owner:experience']);
    });

    it('logs and swallows a failure, never purging from a stale snapshot', async () => {
        // Arrange
        const { ports } = fakePorts();
        ports.invalidateUser.mockRejectedValueOnce(new Error('redis down'));

        // Act
        const result = await revalidateOwnerListingGalleries({
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION,
            ports
        });

        // Assert
        expect(result).toEqual({ revalidated: [] });
        expect(ports.revalidate).not.toHaveBeenCalled();
        expect(mocks.error).toHaveBeenCalledTimes(1);
        expect(mocks.error.mock.calls[0]?.[1]).toBe(
            'Listing gallery revalidation after a coverage change failed'
        );
    });

    it('logs and swallows a purge failure', async () => {
        // Arrange
        const { ports } = fakePorts();
        ports.revalidate.mockRejectedValueOnce(new Error('cloudflare down'));

        // Act
        const result = await revalidateOwnerListingGalleries({
            userId: 'owner',
            vertical: VerticalEnum.VENUE,
            ports
        });

        // Assert
        expect(result).toEqual({ revalidated: [] });
        expect(mocks.error).toHaveBeenCalledTimes(1);
    });
});

describe('subscribeListingGalleryRevalidation', () => {
    it('handles the three listing verticals and ignores tourist and partner', async () => {
        // Arrange
        const { ports, calls } = fakePorts(['l-1']);
        const unsubscribe = subscribeListingGalleryRevalidation({ ports });

        // Act
        for (const vertical of ['accommodation', 'venue', 'experience', 'tourist', 'partner']) {
            for (const listener of [...mocks.listeners]) listener({ userId: 'owner', vertical });
        }
        await drainListingGalleryRevalidations();
        unsubscribe();

        // Assert
        expect(calls.filter((call) => call.startsWith('revalidate:'))).toEqual([
            'revalidate:accommodation:l-1',
            'revalidate:venue:l-1',
            'revalidate:experience:l-1'
        ]);
        expect(mocks.listeners).toHaveLength(0);
    });

    it('registers a single listener however many times it is subscribed', () => {
        // Arrange
        const { ports } = fakePorts();

        // Act
        const first = subscribeListingGalleryRevalidation({ ports });
        const second = subscribeListingGalleryRevalidation({ ports });

        // Assert
        expect(mocks.listeners).toHaveLength(1);
        second();
        first();
        expect(mocks.listeners).toHaveLength(0);
    });
});

describe('the listener is wired at the composition root', () => {
    it('index.ts subscribes and unsubscribes it outside comments', async () => {
        // Arrange
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(new URL('../../../src/index.ts', import.meta.url), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');

        // Act
        const subscribed =
            /const (\w+) = subscribeListingGalleryRevalidation\(\);/.exec(source)?.[1] ?? null;

        // Assert
        expect(subscribed).toBe('unsubscribeListingGalleryRevalidation');
        expect(source).toContain('unsubscribeListingGalleryRevalidation?.();');
    });
});
