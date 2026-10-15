import { subscriptionPauses } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    pauseEndForUserWide,
    selectComplementTargets
} from '../../../src/services/billing/subscription/complement-selection.js';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import {
    ORPHAN_VERTICAL,
    orphanPorts,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures.js';

afterAll(closeServiceTestPool);
const OTHER_VERTICAL = VerticalEnum.GASTRONOMY;

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:22 AC:B7:21 la selección de complementos',
    () => {
        it('selecciona sólo un complemento ACTIVE de la instancia ligada a la principal y nunca una PRINCIPAL', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const principal = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'SUSPENDED'
                });
                const selected = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const inactive = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'PAUSED'
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId: principal.subscriptionId,
                    complementSubscriptionId: selected.subscriptionId
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId: principal.subscriptionId,
                    complementSubscriptionId: inactive.subscriptionId
                });
                const result = await selectComplementTargets(
                    {
                        tx,
                        principal: {
                            id: principal.subscriptionId,
                            userId,
                            vertical: ORPHAN_VERTICAL
                        },
                        rule: 'PAUSE',
                        complementStatus: 'ACTIVE'
                    },
                    orphanPorts(tx).ports
                );
                expect(
                    result.targets.map(({ complementSubscriptionId }) => complementSubscriptionId)
                ).toEqual([selected.subscriptionId]);
            });
        });

        it('descarta una fila PRINCIPAL aunque una instancia la enlace como complemento', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const principal = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'SUSPENDED'
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId: principal.subscriptionId,
                    complementSubscriptionId: principal.subscriptionId
                });
                const result = await selectComplementTargets(
                    {
                        tx,
                        principal: {
                            id: principal.subscriptionId,
                            userId,
                            vertical: ORPHAN_VERTICAL
                        },
                        rule: 'PAUSE',
                        complementStatus: 'ACTIVE'
                    },
                    orphanPorts(tx).ports
                );
                expect(result.targets).toEqual([]);
            });
        });

        it('USER entra si otra vertical sólo tiene principal PAUSED o SUSPENDED, pero no si está ACTIVE o PENDING_AUTHORIZATION', async () => {
            for (const otherStatus of ['PAUSED', 'SUSPENDED', 'ACTIVE', 'PENDING_AUTHORIZATION']) {
                await withServiceTestTransaction(async (tx) => {
                    const { userId } = await seedOrphanOwner(tx);
                    const principal = await seedPrincipal(tx, {
                        userId,
                        vertical: ORPHAN_VERTICAL,
                        status: 'SUSPENDED'
                    });
                    await seedPrincipal(tx, {
                        userId,
                        vertical: OTHER_VERTICAL,
                        status: otherStatus
                    });
                    const complement = await seedComplement(tx, {
                        userId,
                        vertical: ORPHAN_VERTICAL,
                        status: 'ACTIVE'
                    });
                    await seedOrphanInstance(tx, {
                        ownerId: userId,
                        scopeType: 'USER',
                        compatibleVerticals: [ORPHAN_VERTICAL, OTHER_VERTICAL],
                        status: 'ACTIVE',
                        targetId: null,
                        complementSubscriptionId: complement.subscriptionId
                    });
                    const result = await selectComplementTargets(
                        {
                            tx,
                            principal: {
                                id: principal.subscriptionId,
                                userId,
                                vertical: ORPHAN_VERTICAL
                            },
                            rule: 'PAUSE',
                            complementStatus: 'ACTIVE'
                        },
                        orphanPorts(tx).ports
                    );
                    expect(result.targets.length).toBe(
                        ['PAUSED', 'SUSPENDED'].includes(otherStatus) ? 1 : 0
                    );
                });
            }
        });

        it('CANCEL incluye USER con otra principal CANCEL_SCHEDULED y PAUSE la excluye; onlyUserWide descarta la vertical', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const principal = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'CANCELLED'
                });
                await seedPrincipal(tx, {
                    userId,
                    vertical: OTHER_VERTICAL,
                    status: 'CANCEL_SCHEDULED'
                });
                const user = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const vertical = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [ORPHAN_VERTICAL, OTHER_VERTICAL],
                    status: 'ACTIVE',
                    complementSubscriptionId: user.subscriptionId
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId: principal.subscriptionId,
                    complementSubscriptionId: vertical.subscriptionId
                });
                const ports = orphanPorts(tx).ports;
                const cancel = await selectComplementTargets(
                    {
                        tx,
                        principal: {
                            id: principal.subscriptionId,
                            userId,
                            vertical: ORPHAN_VERTICAL
                        },
                        rule: 'CANCEL',
                        complementStatus: 'ACTIVE'
                    },
                    ports
                );
                expect(
                    cancel.targets
                        .map(({ complementSubscriptionId }) => complementSubscriptionId)
                        .sort()
                ).toEqual([user.subscriptionId, vertical.subscriptionId].sort());
                const pause = await selectComplementTargets(
                    {
                        tx,
                        principal: {
                            id: principal.subscriptionId,
                            userId,
                            vertical: ORPHAN_VERTICAL
                        },
                        rule: 'PAUSE',
                        complementStatus: 'ACTIVE',
                        onlyUserWide: true
                    },
                    ports
                );
                expect(
                    pause.targets.map(({ complementSubscriptionId }) => complementSubscriptionId)
                ).toEqual([]);
            });
        });

        it('devuelve null de autorización cuando falta vínculo y calcula el fin abierto más tardío', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const principal = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'SUSPENDED'
                });
                const complement = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE',
                    withLink: false
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId: principal.subscriptionId,
                    complementSubscriptionId: complement.subscriptionId
                });
                const result = await selectComplementTargets(
                    {
                        tx,
                        principal: {
                            id: principal.subscriptionId,
                            userId,
                            vertical: ORPHAN_VERTICAL
                        },
                        rule: 'PAUSE',
                        complementStatus: 'ACTIVE'
                    },
                    orphanPorts(tx).ports
                );
                expect(result.targets[0]?.authorizationId).toBeNull();
                const other = await seedPrincipal(tx, {
                    userId,
                    vertical: OTHER_VERTICAL,
                    status: 'PAUSED'
                });
                const expectedEndAt = new Date('2026-10-20T12:00:00.000Z');
                await tx.insert(subscriptionPauses).values({
                    subscriptionId: other.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: new Date('2026-10-01T00:00:00.000Z'),
                    expectedEndAt
                });
                expect(
                    await pauseEndForUserWide({
                        tx,
                        userId,
                        compatibleVerticals: [OTHER_VERTICAL],
                        exceptVertical: ORPHAN_VERTICAL
                    })
                ).toEqual(expectedEndAt);
            });
        });
    }
);
