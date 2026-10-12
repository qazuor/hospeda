import type { CoverageSource } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveAddonSources } from '../../../src/services/billing/coverage/addon-sources';
import { unregisteredListingQuery } from '../../../src/services/billing/coverage/coverage-ports';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    addonPolicyFromTx,
    frozenClock,
    seedCoverageAddon,
    seedCoverageAddonInstance,
    seedCoverageAddonProduct,
    seedCoverageUser
} from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

function portsFor(tx: DrizzleClient) {
    return {
        clock: frozenClock(),
        addonPolicy: addonPolicyFromTx(tx),
        listing: unregisteredListingQuery.listing
    };
}

function addonSource(input: {
    readonly addonVersionId: string;
    readonly scope: CoverageSource['scope'];
    readonly target?: string | null;
    readonly since: Date;
    readonly until: Date | 'NO_KNOWN_DATE';
}): CoverageSource {
    return {
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId: input.addonVersionId },
        scope: input.scope,
        target: input.target ?? null,
        since: input.since,
        until: input.until,
        charged: null,
        floor: null
    };
}

const startsAt = new Date('2026-10-03T10:00:00.000Z');

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B4:6 the real ADDON source answers from the data (AC:B4:7)',
    () => {
        it('a fresh user without addon rows of their own gets no ADDON source', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);

                // Act
                const { sources } = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: portsFor(tx),
                    tx
                });

                // Assert
                expect(sources).toEqual([]);
            });
        });

        it('with seeded rows it returns exactly those, referencing the ANCHORED version', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: the product was re-pointed to a newer version of the same addon.
                const { userId } = await seedCoverageUser(tx);
                const addon = await seedCoverageAddon(tx, {
                    versions: [
                        { validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'USER' },
                        { validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'USER' }
                    ]
                });
                const [anchored, current] = addon.versionIds;
                if (!anchored || !current) throw new Error('two versions expected');
                const { productId } = await seedCoverageAddonProduct(tx, {
                    addonId: addon.addonId,
                    versionId: current,
                    compatibleVerticals: ['accommodation']
                });
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: anchored,
                    ownerId: userId,
                    startsAt
                });

                // Act
                const { sources } = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: portsFor(tx),
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    addonSource({
                        addonVersionId: anchored,
                        scope: 'USER',
                        since: startsAt,
                        until: 'NO_KNOWN_DATE'
                    })
                ]);
            });
        });

        it('since falls back to created_at when the instance has no start', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);
                const addon = await seedCoverageAddon(tx, {
                    versions: [{ validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'GLOBAL' }]
                });
                const versionId = addon.versionIds[0] ?? '';
                const { productId } = await seedCoverageAddonProduct(tx, {
                    addonId: addon.addonId,
                    versionId,
                    compatibleVerticals: ['accommodation']
                });
                const createdAt = new Date('2026-10-04T08:00:00.000Z');
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: versionId,
                    ownerId: userId,
                    startsAt: null,
                    createdAt
                });

                // Act
                const { sources } = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: portsFor(tx),
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    addonSource({
                        addonVersionId: versionId,
                        scope: 'GLOBAL',
                        since: createdAt,
                        until: 'NO_KNOWN_DATE'
                    })
                ]);
            });
        });

        it('a live FIXED_DAYS instance carries its end; an expired one and a pending one do not appear', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);
                const addon = await seedCoverageAddon(tx, {
                    versions: [{ validity: 'FIXED_DAYS', scopeType: 'USER' }]
                });
                const versionId = addon.versionIds[0] ?? '';
                const { productId } = await seedCoverageAddonProduct(tx, {
                    addonId: addon.addonId,
                    versionId,
                    compatibleVerticals: ['accommodation']
                });
                const liveEnd = new Date('2026-11-02T10:00:00.000Z');
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: versionId,
                    ownerId: userId,
                    startsAt,
                    endsAt: liveEnd
                });
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: versionId,
                    ownerId: userId,
                    startsAt: new Date('2026-09-01T10:00:00.000Z'),
                    endsAt: new Date('2026-10-01T10:00:00.000Z')
                });
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: versionId,
                    ownerId: userId,
                    status: 'PENDING_AUTHORIZATION',
                    startsAt,
                    endsAt: liveEnd
                });

                // Act
                const { sources } = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: portsFor(tx),
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    addonSource({
                        addonVersionId: versionId,
                        scope: 'USER',
                        since: startsAt,
                        until: liveEnd
                    })
                ]);
            });
        });

        it('a LISTING instance appears only in the vertical the listing port answers', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);
                const addon = await seedCoverageAddon(tx, {
                    versions: [{ validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'LISTING' }]
                });
                const versionId = addon.versionIds[0] ?? '';
                const { productId } = await seedCoverageAddonProduct(tx, {
                    addonId: addon.addonId,
                    versionId,
                    compatibleVerticals: ['accommodation', 'gastronomy']
                });
                const listingId = crypto.randomUUID();
                await seedCoverageAddonInstance(tx, {
                    productId,
                    addonVersionId: versionId,
                    ownerId: userId,
                    targetId: listingId,
                    startsAt
                });
                const ports = {
                    ...portsFor(tx),
                    listing: async () => ({
                        vertical: VerticalEnum.GASTRONOMY,
                        ownerId: userId,
                        acceptsFeature: true
                    })
                };

                // Act
                const gastronomy = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.GASTRONOMY,
                    ports,
                    tx
                });
                const accommodation = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(gastronomy.sources).toEqual([
                    addonSource({
                        addonVersionId: versionId,
                        scope: 'LISTING',
                        target: listingId,
                        since: startsAt,
                        until: 'NO_KNOWN_DATE'
                    })
                ]);
                expect(accommodation.sources).toEqual([]);
            });
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B4:7 USER and GLOBAL addons only in compatible verticals (AC:B4:8)',
    () => {
        it('a USER and a GLOBAL of a product compatible only with accommodation appear there and not in gastronomy', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);
                const userAddon = await seedCoverageAddon(tx, {
                    versions: [{ validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'USER' }]
                });
                const globalAddon = await seedCoverageAddon(tx, {
                    versions: [{ validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: 'GLOBAL' }]
                });
                const userVersion = userAddon.versionIds[0] ?? '';
                const globalVersion = globalAddon.versionIds[0] ?? '';
                const userProduct = await seedCoverageAddonProduct(tx, {
                    addonId: userAddon.addonId,
                    versionId: userVersion,
                    compatibleVerticals: ['accommodation']
                });
                const globalProduct = await seedCoverageAddonProduct(tx, {
                    addonId: globalAddon.addonId,
                    versionId: globalVersion,
                    compatibleVerticals: ['accommodation']
                });
                await seedCoverageAddonInstance(tx, {
                    productId: userProduct.productId,
                    addonVersionId: userVersion,
                    ownerId: userId,
                    startsAt
                });
                await seedCoverageAddonInstance(tx, {
                    productId: globalProduct.productId,
                    addonVersionId: globalVersion,
                    ownerId: userId,
                    startsAt
                });

                // Act
                const accommodation = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: portsFor(tx),
                    tx
                });
                const gastronomy = await resolveAddonSources({
                    userId,
                    vertical: VerticalEnum.GASTRONOMY,
                    ports: portsFor(tx),
                    tx
                });

                // Assert
                expect(accommodation.sources).toHaveLength(2);
                expect(accommodation.sources).toEqual(
                    expect.arrayContaining([
                        addonSource({
                            addonVersionId: userVersion,
                            scope: 'USER',
                            since: startsAt,
                            until: 'NO_KNOWN_DATE'
                        }),
                        addonSource({
                            addonVersionId: globalVersion,
                            scope: 'GLOBAL',
                            since: startsAt,
                            until: 'NO_KNOWN_DATE'
                        })
                    ])
                );
                expect(gastronomy.sources).toEqual([]);
            });
        });
    }
);
