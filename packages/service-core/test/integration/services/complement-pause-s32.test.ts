import {
    and,
    eq,
    getDb,
    isNull,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { pauseComplementsS32 } from '../../../src/services/billing/subscription/complement-pause-s32.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';

const clock = { now: () => complementNow };
afterEach(retireComplementRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:22 AC:B7:21 S32 pausa complementos recurrentes',
    () => {
        it('pausa el complemento confirmado y abre una pausa CUSTOMER_REQUEST sin fin previsto', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'SUSPENDED',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const result = await pauseComplementsS32(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results.map(({ outcome }) => outcome)).toEqual(['PAUSED']);
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('PAUSED');
            const pauses = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, seeded.complementId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                );
            expect(pauses).toHaveLength(1);
            expect(pauses[0]).toMatchObject({
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: null,
                expectedEndAt: null
            });
            if (!seeded.authorizationId) throw new Error('provider authorization was not seeded');
            const providerRead = await harness.fake.readAuthorization({
                authorizationId: seeded.authorizationId
            });
            expect(providerRead.snapshot.status).toBe('paused');
        });

        it('deja ACTIVE y abre una sola marca 22 cuando el PUT fue aceptado pero no aplicado', async () => {
            const harness = providerHarness({ pauseAcknowledgesOnly: true });
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'SUSPENDED',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const input = {
                principalSubscriptionId: seeded.principalId,
                trigger: 'PRINCIPAL_SUSPENDED' as const
            };
            const first = await pauseComplementsS32(input, {
                provider: harness.provider,
                clock,
                policy: seeded.policy
            });
            const second = await pauseComplementsS32(input, {
                provider: harness.provider,
                clock,
                policy: seeded.policy
            });
            expect(first.results[0]).toMatchObject({
                outcome: 'NOT_APPLIED',
                markOutcome: 'OPENED'
            });
            expect(second.results[0]).toMatchObject({
                outcome: 'NOT_APPLIED',
                markOutcome: 'ACCUMULATED'
            });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('ACTIVE');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, seeded.complementId))
            ).toHaveLength(0);
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'PAUSA_NO_APLICADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(marks).toHaveLength(1);
        });

        it('no llama al proveedor si el trigger no coincide con el estado de la principal', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            const result = await pauseComplementsS32(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result).toEqual({ results: [] });
            expect(harness.calls).toEqual([]);
        });

        it('el tercer evento pausa USER aunque la compatible esté SUSPENDED y no pausa si sigue ACTIVE', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'CANCELLED',
                otherStatus: 'SUSPENDED',
                scopeType: 'USER'
            });
            const result = await pauseComplementsS32(
                {
                    principalSubscriptionId: seeded.principalId,
                    trigger: 'PRINCIPAL_LEFT_LIVE_ROWS'
                },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({
                outcome: 'PAUSED',
                complementSubscriptionId: seeded.complementId
            });
            const activeHarness = providerHarness();
            const active = await seedCommittedComplement({
                fake: activeHarness.fake,
                principalStatus: 'CANCELLED',
                otherStatus: 'ACTIVE',
                scopeType: 'USER'
            });
            const noPause = await pauseComplementsS32(
                {
                    principalSubscriptionId: active.principalId,
                    trigger: 'PRINCIPAL_LEFT_LIVE_ROWS'
                },
                { provider: activeHarness.provider, clock, policy: active.policy }
            );
            expect(noPause).toEqual({ results: [] });
        });

        it('saltea una fila sin vínculo sin escribir pausa ni marca', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'SUSPENDED',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                withLink: false
            });
            const result = await pauseComplementsS32(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({ outcome: 'SKIPPED_NO_LINK' });
            expect(harness.calls).toEqual([]);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, seeded.complementId))
            ).toHaveLength(0);
        });

        it('pierde la carrera si la principal cambia después del PUT y abre TRANSICION_NO_DECLARADA', async () => {
            let principalId = '';
            const harness = providerHarness({
                onPause: async () => {
                    await getDb()
                        .update(subscriptions)
                        .set({ status: 'ACTIVE' })
                        .where(eq(subscriptions.id, principalId));
                }
            });
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'SUSPENDED',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            });
            principalId = seeded.principalId;
            const result = await pauseComplementsS32(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({
                outcome: 'LOST_RACE',
                markOutcome: 'OPENED'
            });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('ACTIVE');
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'TRANSICION_NO_DECLARADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(marks).toHaveLength(1);
        });

        it('cuenta FAILED si falla la inserción de pausa abierta, y continúa el flujo', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'SUSPENDED',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                openPause: true
            });
            const result = await pauseComplementsS32(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({ outcome: 'FAILED' });
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('ACTIVE');
        });
    }
);
