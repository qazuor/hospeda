import {
    and,
    eq,
    isNull,
    reconciliationMarks,
    SYSTEM_USER_EMAIL,
    SYSTEM_USER_ID,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resumeComplementsS33 } from '../../../src/services/billing/subscription/complement-resume-s33.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';

const clock = { now: () => complementNow };
const ensureSystemUser = async () => {
    await getServiceTestDb()
        .insert(users)
        .values({
            id: SYSTEM_USER_ID,
            slug: 'system-user',
            email: SYSTEM_USER_EMAIL,
            displayName: 'System',
            emailVerified: true,
            lifecycleState: 'ACTIVE',
            isSystemAccount: true
        })
        .onConflictDoNothing();
};
const honestProvider = (harness: ReturnType<typeof providerHarness>) =>
    new Proxy(harness.fake as PaymentProvider, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
afterEach(retireComplementRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:23 S33 reanuda complementos pausados',
    () => {
        it('reanuda el proveedor y la fila, cierra su pausa y conserva la instancia', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results).toMatchObject([
                { outcome: 'REACTIVATED', complementSubscriptionId: seeded.complementId }
            ]);
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            const pauses = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, seeded.complementId));
            expect(row?.status).toBe('ACTIVE');
            expect(pauses).toHaveLength(1);
            expect(pauses[0]?.actualEndAt).toEqual(complementNow);
            expect(
                (await harness.fake.readAuthorization({ authorizationId: seeded.authorizationId }))
                    .snapshot.status
            ).toBe('active');
        });

        it('no aplica el PUT: conserva PAUSED y la pausa, y abre una sola marca 8', async () => {
            const harness = providerHarness({ resumeAcknowledgesOnly: true });
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({
                outcome: 'NOT_APPLIED',
                markOutcome: 'OPENED'
            });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            const pauses = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, seeded.complementId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                );
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(row?.status).toBe('PAUSED');
            expect(pauses).toHaveLength(1);
            expect(marks).toHaveLength(1);
        });

        it('levanta la marca REANUDACION_NO_APLICADA al confirmarse el reintento', async () => {
            await ensureSystemUser();
            const harness = providerHarness({ resumeAcknowledgesOnly: true });
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const input = {
                principalSubscriptionId: seeded.principalId,
                trigger: 'PRINCIPAL_ACTIVE' as const
            };
            const failed = await resumeComplementsS33(input, {
                provider: harness.provider,
                clock,
                policy: seeded.policy
            });
            expect(failed.results[0]).toMatchObject({
                outcome: 'NOT_APPLIED',
                markOutcome: 'OPENED'
            });
            const open = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA'),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
            expect(open).toHaveLength(1);
            const resumed = await resumeComplementsS33(input, {
                provider: honestProvider(harness),
                clock,
                policy: seeded.policy
            });
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA')
                    )
                );
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(resumed.results[0]).toMatchObject({
                outcome: 'REACTIVATED',
                complementSubscriptionId: seeded.complementId
            });
            expect(row?.status).toBe('ACTIVE');
            expect(marks).toHaveLength(1);
            expect(marks[0]?.liftedAt).toEqual(complementNow);
            expect(marks[0]?.liftedBy).toBe(SYSTEM_USER_ID);
            expect(marks[0]?.version).toBe((open[0]?.version ?? 0) + 1);
        });

        it('no levanta una marca de otro motivo al reanudar el complemento', async () => {
            await ensureSystemUser();
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            await getServiceTestDb()
                .insert(reconciliationMarks)
                .values([
                    {
                        subscriptionId: seeded.complementId,
                        reason: 'REANUDACION_NO_APLICADA',
                        placedAt: complementNow
                    },
                    {
                        subscriptionId: seeded.complementId,
                        reason: 'PAUSA_NO_APLICADA',
                        placedAt: complementNow
                    }
                ]);
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, seeded.complementId));
            const byReason = new Map(marks.map((mark) => [mark.reason, mark]));
            expect(result.results[0]).toMatchObject({ outcome: 'REACTIVATED' });
            expect(byReason.get('REANUDACION_NO_APLICADA')?.liftedAt).toEqual(complementNow);
            expect(byReason.get('REANUDACION_NO_APLICADA')?.liftedBy).toBe(SYSTEM_USER_ID);
            expect(byReason.get('PAUSA_NO_APLICADA')?.liftedAt).toBeNull();
            expect(byReason.get('PAUSA_NO_APLICADA')?.liftedBy).toBeNull();
        });

        it('USER compatible reanuda cuando la principal ACTIVE es la de otra vertical', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                otherStatus: 'ACTIVE',
                scopeType: 'USER',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId || !seeded.otherPrincipalId)
                throw new Error('fixture authorization or other principal missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.otherPrincipalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({
                outcome: 'REACTIVATED',
                complementSubscriptionId: seeded.complementId
            });
        });

        it('no llama al proveedor si la principal no está ACTIVE', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result).toEqual({ results: [] });
            expect(harness.calls).toEqual([]);
        });

        it('es idempotente y no selecciona por segunda vez la fila ya reanudada', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const input = {
                principalSubscriptionId: seeded.principalId,
                trigger: 'PRINCIPAL_ACTIVE' as const
            };
            await resumeComplementsS33(input, {
                provider: harness.provider,
                clock,
                policy: seeded.policy
            });
            const second = await resumeComplementsS33(input, {
                provider: harness.provider,
                clock,
                policy: seeded.policy
            });
            expect(second).toEqual({ results: [] });
            expect(harness.calls.filter((call) => call.startsWith('resume:'))).toHaveLength(1);
        });

        it('pierde la carrera si la principal deja ACTIVE después del PUT', async () => {
            let principalId = '';
            const harness = providerHarness({
                onResume: async () => {
                    await getServiceTestDb()
                        .update(subscriptions)
                        .set({ status: 'CANCELLED' })
                        .where(eq(subscriptions.id, principalId));
                }
            });
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: true
            });
            principalId = seeded.principalId;
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({ outcome: 'LOST_RACE' });
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

        it('levanta la marca REANUDACION_NO_APLICADA al reanudar PAUSED sin pausa abierta', async () => {
            await ensureSystemUser();
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: false
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const [open] = await getServiceTestDb()
                .insert(reconciliationMarks)
                .values({
                    subscriptionId: seeded.complementId,
                    reason: 'REANUDACION_NO_APLICADA',
                    placedAt: complementNow
                })
                .returning();
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            const [mark] = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, seeded.complementId),
                        eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA')
                    )
                );
            expect(result.results[0]).toMatchObject({ outcome: 'REACTIVATED' });
            expect(mark?.liftedAt).toEqual(complementNow);
            expect(mark?.liftedBy).toBe(SYSTEM_USER_ID);
            expect(mark?.version).toBe((open?.version ?? 0) + 1);
        });

        it('reanuda PAUSED inconsistente sin pausa abierta', async () => {
            const harness = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: harness.fake,
                principalStatus: 'ACTIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION',
                complementStatus: 'PAUSED',
                openPause: false
            });
            if (!seeded.authorizationId) throw new Error('authorization missing');
            await harness.fake.pause({ authorizationId: seeded.authorizationId });
            const result = await resumeComplementsS33(
                { principalSubscriptionId: seeded.principalId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: harness.provider, clock, policy: seeded.policy }
            );
            expect(result.results[0]).toMatchObject({ outcome: 'REACTIVATED' });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(row?.status).toBe('ACTIVE');
        });
    }
);
