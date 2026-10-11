import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    DAILY_COVERAGE_RECONCILER_JOB,
    runDailyCoverageReconciler
} from '../../src/publication/coverage-reconciler';
import type { ReconcilerPorts } from '../../src/publication/coverage-reconciler-types';
import type {
    PublicationTransaction,
    PublicationVertical
} from '../../src/publication/publication-types';

function ports(overrides: Partial<ReconcilerPorts> = {}) {
    const ping = vi.fn(async () => {});
    const invalidate = vi.fn(async () => {});
    const base: ReconcilerPorts = {
        population: {
            listOwnerVerticals: vi.fn(async () => ({ items: [], next: null })),
            listPartnerUsers: vi.fn(async () => ({ items: [], next: null }))
        },
        reader: {
            summarize: vi.fn(async () => ({ published: 0, unpublishedByBilling: 0, archived: 0 }))
        },
        liveLimit: vi.fn(async () => 2),
        billing: { coverage: vi.fn(async () => ({ covered: true, sources: [] })) },
        presence: {
            liveKeys: vi.fn(async () => []),
            cachedKeys: vi.fn(async () => null),
            invalidate
        },
        unitOfWork: {
            runLocked: async (_key, work) =>
                work({
                    listByOwner: async () => [],
                    readDeclaredPublishLimit: async () => 2,
                    readPublicationInstants: async () => new Map(),
                    stampInactiveSince: async () => {},
                    setPublicationStatus: async () => false,
                    insertStatusChangedEvent: async () => {},
                    countPublished: async () => 0,
                    enqueueRestitutionNotice: async () => {}
                } as unknown as PublicationTransaction)
        },
        afterCommit: {
            emitCoverageChanged: async () => {},
            invalidateUser: async () => {},
            revalidate: async () => {}
        },
        clock: { now: () => new Date('2026-10-11T00:00:00Z') },
        monitor: { ping }
    };
    return { ports: { ...base, ...overrides }, ping, invalidate };
}

describe('TEST:V6:7 daily coverage reconciler', () => {
    it.each([
        {
            label: 'PB2 coverage loss',
            covered: false,
            published: 2,
            unpublishedByBilling: 0,
            limit: null
        },
        { label: 'PB2 surplus', covered: true, published: 3, unpublishedByBilling: 0, limit: 2 },
        { label: 'PB3 restoration', covered: true, published: 1, unpublishedByBilling: 1, limit: 2 }
    ])('runs the $label row after the unlocked decision', async (scenario) => {
        const pair: { readonly userId: string; readonly vertical: PublicationVertical } = {
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        };
        const h = ports({
            population: {
                listOwnerVerticals: async () => ({ items: [pair], next: null }),
                listPartnerUsers: async () => ({ items: [], next: null })
            },
            reader: {
                summarize: async () => ({
                    published: scenario.published,
                    unpublishedByBilling: scenario.unpublishedByBilling,
                    archived: 0
                })
            },
            liveLimit: async () => scenario.limit,
            billing: { coverage: async () => ({ covered: scenario.covered, sources: [] }) }
        });
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        expect(result.ran).toBe(1);
        expect(result.complete).toBe(true);
    });

    it('does no writes for unchanged coverage and pings only after full completion', async () => {
        const h = ports({
            population: {
                listOwnerVerticals: async () => ({
                    items: [{ userId: 'unchanged', vertical: VerticalEnum.ACCOMMODATION }],
                    next: null
                }),
                listPartnerUsers: async () => ({ items: [], next: null })
            },
            reader: {
                summarize: async () => ({ published: 2, unpublishedByBilling: 0, archived: 0 })
            }
        });
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        expect(result).toMatchObject({ complete: true, pinged: true, ran: 0 });
        expect(h.ping).toHaveBeenCalledWith({ job: DAILY_COVERAGE_RECONCILER_JOB });
    });

    it('continues after a pair fails and withholds the ping', async () => {
        const pair: { readonly userId: string; readonly vertical: PublicationVertical } = {
            userId: 'u1',
            vertical: VerticalEnum.ACCOMMODATION
        };
        const page = vi.fn(
            async ({ after }: { readonly after: typeof pair | null; readonly limit: number }) =>
                after ? { items: [], next: null } : { items: [pair], next: null }
        );
        const h = ports({
            population: {
                listOwnerVerticals: page,
                listPartnerUsers: async () => ({ items: [], next: null })
            },
            reader: {
                summarize: async () => {
                    throw new Error('read failed');
                }
            }
        });
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        expect(result).toMatchObject({ complete: false, pinged: false, pairsRead: 1 });
        expect(result.failures).toHaveLength(1);
        expect(h.ping).not.toHaveBeenCalled();
    });

    it('invalidates only cached Partner entries whose live presence keys differ', async () => {
        const h = ports({
            population: {
                listOwnerVerticals: async () => ({ items: [], next: null }),
                listPartnerUsers: async () => ({ items: ['diff', 'same', 'miss'], next: null })
            },
            presence: {
                liveKeys: async ({ userId }) => (userId === 'diff' ? ['partner_public_page'] : []),
                cachedKeys: async ({ userId }) =>
                    userId === 'miss' ? null : userId === 'diff' ? [] : [],
                invalidate: hInvalidate
            }
        });
        function hInvalidate() {
            return Promise.resolve();
        }
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        expect(result).toMatchObject({ partnerChecked: 3, partnerInvalidated: 1 });
    });

    it('counts paginated owners and tolerates a failed monitor ping', async () => {
        const pair: { readonly userId: string; readonly vertical: PublicationVertical } = {
            userId: 'u1',
            vertical: VerticalEnum.GASTRONOMY
        };
        let calls = 0;
        const h = ports({
            population: {
                listOwnerVerticals: async () =>
                    ++calls === 1 ? { items: [pair], next: pair } : { items: [], next: null },
                listPartnerUsers: async () => ({ items: [], next: null })
            },
            monitor: {
                ping: async () => {
                    throw new Error('monitor offline');
                }
            }
        });
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        expect(result).toMatchObject({ pairsRead: 1, complete: true, pinged: false });
    });
});
