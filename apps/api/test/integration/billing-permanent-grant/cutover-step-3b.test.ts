import { randomUUID } from 'node:crypto';
import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import {
    and,
    eq,
    getDb,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    trials,
    userRole
} from '@repo/db';
import { RoleEnum, VerticalEnum } from '@repo/schemas';
import { type Actor, createSystemActor } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    composeStep3bProcess,
    resolveCutoverOperatorActor
} from '../../../src/services/cutover-b9a/step-3b.compose.js';
import {
    runStep3b,
    Step3bTrialMissingError
} from '../../../src/services/cutover-b9a/step-3b.service.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database';
import { routeClock, routeFake } from '../billing-subscription/revocation-route-fixtures';
import {
    createTrial,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';
import { seedGrantPlan, seedGrantUser } from './grant-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const beneficiaries: string[] = [];
const operatorIds: string[] = [];
const clock = routeClock();
let composition: ReturnType<typeof composeStep3bProcess>;
let operatorId = '';
let operator: Actor | undefined;
let floor: Awaited<ReturnType<typeof seedGrantPlan>>;

async function user(label: string): Promise<string> {
    const id = await seedGrantUser(`step3b-${label}-${randomUUID()}`);
    return id;
}
async function trialUser(label: string): Promise<string> {
    const id = await user(label);
    beneficiaries.push(id);
    await createTrial({ userId: id, status: 'TRIAL_ACTIVE' });
    return id;
}
async function args(
    ids: readonly string[],
    options: { dryRun?: boolean; includesAddons?: boolean; plan?: typeof floor } = {}
) {
    const selectedFloor = options.plan ?? floor;
    return runStep3b({
        actor: currentOperator(),
        beneficiaryUserIds: ids,
        planId: selectedFloor.planId,
        floorPlanVersionId: selectedFloor.floorPlanVersionId,
        includesAddons: options.includesAddons ?? false,
        dryRun: options.dryRun ?? false,
        ports: composition.ports
    });
}
function currentOperator(): Actor {
    if (!operator) throw new Error('Test operator not initialized');
    return operator;
}
async function state(userId: string) {
    const grants = await getDb()
        .select({
            id: permanentGrants.id,
            grantedBy: permanentGrants.grantedBy,
            includesAddons: permanentGrants.includesAddons,
            vertical: permanentGrantVerticals.vertical,
            planId: permanentGrantVerticals.planId,
            floorPlanVersionId: permanentGrantVerticals.floorPlanVersionId
        })
        .from(permanentGrants)
        .innerJoin(
            permanentGrantVerticals,
            eq(permanentGrantVerticals.permanentGrantId, permanentGrants.id)
        )
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, userId),
                eq(permanentGrantVerticals.vertical, VerticalEnum.ACCOMMODATION)
            )
        );
    const [trial] = await getDb()
        .select({ status: trials.status })
        .from(trials)
        .where(eq(trials.userId, userId));
    return { grants, status: trial?.status };
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    await ensureAccommodationCatalog();
    composition = composeStep3bProcess({ clock, provider: routeFake(clock) });
    operatorId = await user('operator');
    operatorIds.push(operatorId);
    await getDb().insert(userRole).values({ userId: operatorId, role: RoleEnum.SUPER_ADMIN });
    operator = await resolveCutoverOperatorActor({ userId: operatorId });
    floor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
});

afterAll(async () => {
    composition?.stop();
    const rows = await getDb()
        .select({ id: permanentGrants.id })
        .from(permanentGrants)
        .where(inArray(permanentGrants.beneficiaryUserId, beneficiaries));
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
        await getDb()
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, ids));
        await getDb().delete(permanentGrants).where(inArray(permanentGrants.id, ids));
    }
    if (operatorIds.length > 0)
        await getDb().delete(userRole).where(inArray(userRole.userId, operatorIds));
});

describe('TEST:B9a:16 — la herramienta del 3b, dos veces', () => {
    it('(a) escribe dos grants, convierte ambos trials y audita ACC_2', async () => {
        const first = await trialUser('a1');
        const second = await trialUser('a2');
        const untouched = await trialUser('a3');
        const before = audit.mock.calls.length;
        const result = await args([first, second]);
        expect(result.status).toBe('completed');
        expect(result.beneficiaries.map(({ outcome }) => outcome)).toEqual(['written', 'written']);
        for (const id of [first, second]) {
            const current = await state(id);
            expect(current.grants).toHaveLength(1);
            expect(current.grants[0]).toMatchObject({
                grantedBy: operatorId,
                includesAddons: false,
                vertical: VerticalEnum.ACCOMMODATION,
                planId: floor.planId,
                floorPlanVersionId: floor.floorPlanVersionId
            });
            expect(current.status).toBe('TRIAL_CONVERTED');
        }
        expect((await state(untouched)).status).toBe('TRIAL_ACTIVE');
        expect(audit.mock.calls.length - before).toBe(2);
        expect(
            audit.mock.calls.slice(before).every(([entry]) => {
                if (typeof entry !== 'object' || entry === null || !('metadata' in entry))
                    return false;
                const metadata = entry.metadata;
                return (
                    typeof metadata === 'object' &&
                    metadata !== null &&
                    'administrativeAction' in metadata &&
                    metadata.administrativeAction === 'ACC_2' &&
                    'tool' in metadata &&
                    metadata.tool === 'cutover-step-3b'
                );
            })
        ).toBe(true);
    });
    it('(b) skips the two existing anchors on the second run', async () => {
        const rows = beneficiaries.slice(0, 2);
        const before = audit.mock.calls.length;
        const result = await args(rows);
        expect(result.status).toBe('completed');
        expect(result.beneficiaries.map(({ outcome }) => outcome)).toEqual(['skipped', 'skipped']);
        expect(audit.mock.calls.length).toBe(before);
        for (const id of rows) expect((await state(id)).grants).toHaveLength(1);
    });
    it('(c) skips existing anchors before checking an obsolete floor', async () => {
        const old = await seedGrantPlan(VerticalEnum.ACCOMMODATION, { current: false });
        const result = await args(beneficiaries.slice(0, 2), { plan: old });
        expect(result.beneficiaries.map(({ outcome }) => outcome)).toEqual(['skipped', 'skipped']);
    });
    it('(d) dry-run reports would_write without rows and skips live anchors', async () => {
        const fresh = [await trialUser('d1'), await trialUser('d2')];
        const firstFresh = fresh[0];
        if (!firstFresh) throw new Error('Expected first fresh beneficiary');
        const before = audit.mock.calls.length;
        const result = await args(fresh, { dryRun: true });
        expect(result.beneficiaries.map(({ outcome }) => outcome)).toEqual([
            'would_write',
            'would_write'
        ]);
        expect((await state(firstFresh)).grants).toHaveLength(0);
        expect((await state(firstFresh)).status).toBe('TRIAL_ACTIVE');
        expect(audit.mock.calls.length).toBe(before);
        expect(
            (await args(beneficiaries.slice(0, 2), { dryRun: true })).beneficiaries.map(
                ({ outcome }) => outcome
            )
        ).toEqual(['skipped', 'skipped']);
    });
    it('(e) rejects a stale floor from the real plan policy before writing', async () => {
        const fresh = [await trialUser('e1'), await trialUser('e2')];
        const old = await seedGrantPlan(VerticalEnum.ACCOMMODATION, { current: false });
        for (const dryRun of [false, true]) {
            await expect(args(fresh, { plan: old, dryRun })).rejects.toMatchObject({
                reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT'
            });
        }
        for (const id of fresh) {
            expect((await state(id)).grants).toHaveLength(0);
            expect((await state(id)).status).toBe('TRIAL_ACTIVE');
        }
    });
    it('(f) TEST:B9a:11 (3b) follows simulator floor policy and stores its version reference', async () => {
        const fresh = [await trialUser('f1'), await trialUser('f2')];
        const firstFresh = fresh[0];
        if (!firstFresh) throw new Error('Expected first fresh beneficiary');
        const simulatorPlan = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const simulator = new VerticalsForBillingSimulator({ clock });
        simulator.setPlanPolicy({
            planVersionId: simulatorPlan.floorPlanVersionId,
            policy: { graceDays: 0, allowsPause: false, current: false, sellable: false }
        });
        const ports = {
            ...composition.ports,
            planPolicy: (input: Parameters<typeof simulator.planPolicy>[0]) =>
                simulator.planPolicy(input)
        };
        await expect(
            runStep3b({
                actor: currentOperator(),
                beneficiaryUserIds: fresh,
                planId: simulatorPlan.planId,
                floorPlanVersionId: simulatorPlan.floorPlanVersionId,
                includesAddons: false,
                dryRun: false,
                ports
            })
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' });
        expect((await state(firstFresh)).grants).toHaveLength(0);
        simulator.setPlanPolicy({
            planVersionId: simulatorPlan.floorPlanVersionId,
            policy: { graceDays: 0, allowsPause: false, current: true, sellable: false }
        });
        const accepted = await runStep3b({
            actor: currentOperator(),
            beneficiaryUserIds: fresh,
            planId: simulatorPlan.planId,
            floorPlanVersionId: simulatorPlan.floorPlanVersionId,
            includesAddons: false,
            dryRun: false,
            ports
        });
        expect(accepted.status).toBe('completed');
        const firstResult = accepted.beneficiaries[0];
        if (!firstResult?.permanentGrantId) throw new Error('Expected first written grant');
        const anchors = await getDb()
            .select({ versionId: permanentGrantVerticals.floorPlanVersionId })
            .from(permanentGrantVerticals)
            .where(eq(permanentGrantVerticals.permanentGrantId, firstResult.permanentGrantId));
        expect(anchors[0]?.versionId).toBe(simulatorPlan.floorPlanVersionId);
    });
    it('(g) refuses the pair before writing if one trial is missing', async () => {
        const present = await trialUser('g1');
        const missing = await user('g2');
        await expect(args([present, missing])).rejects.toBeInstanceOf(Step3bTrialMissingError);
        expect((await state(present)).grants).toHaveLength(0);
    });
    it('(h1) refuses when operator is the second beneficiary before the first write', async () => {
        const first = await trialUser('h1a');
        await createTrial({ userId: operatorId, status: 'TRIAL_ACTIVE' });
        await expect(args([first, operatorId])).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect((await state(first)).grants).toHaveLength(0);
    });
    it('(h2) refuses a USER actor', async () => {
        const target = await trialUser('h2');
        const plainUser = await user('plain');
        await getDb().insert(userRole).values({ userId: plainUser, role: RoleEnum.USER });
        operatorIds.push(plainUser);
        const actor = await resolveCutoverOperatorActor({ userId: plainUser });
        await expect(
            runStep3b({
                actor,
                beneficiaryUserIds: [target, await trialUser('h2b')],
                planId: floor.planId,
                floorPlanVersionId: floor.floorPlanVersionId,
                includesAddons: false,
                dryRun: false,
                ports: composition.ports
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        expect((await state(target)).grants).toHaveLength(0);
    });
    it('(h3) refuses a system actor', async () => {
        const target = await trialUser('h3');
        const systemActor = createSystemActor({ jobId: 'cutover-test-system', permissions: [] });
        await expect(
            runStep3b({
                actor: systemActor,
                beneficiaryUserIds: [target, await trialUser('h3b')],
                planId: floor.planId,
                floorPlanVersionId: floor.floorPlanVersionId,
                includesAddons: false,
                dryRun: false,
                ports: composition.ports
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        expect((await state(target)).grants).toHaveLength(0);
    });
    it('(i) does not anchor a live grant whose only anchor is gastronomy', async () => {
        const first = await trialUser('i1');
        const second = await trialUser('i2');
        const { seedGrant } = await import('./grant-fixtures');
        const gastronomy = await seedGrantPlan(VerticalEnum.GASTRONOMY);
        await seedGrant({ beneficiaryUserId: first, grantedBy: operatorId, anchor: gastronomy });
        await expect(args([first, second])).rejects.toMatchObject({
            reason: 'PERMANENT_GRANT_ALREADY_LIVE'
        });
        expect((await state(first)).grants).toHaveLength(0);
        expect((await state(second)).grants).toHaveLength(0);
    });
    it('(k) persists includesAddons=true', async () => {
        const fresh = [await trialUser('k1'), await trialUser('k2')];
        const firstFresh = fresh[0];
        if (!firstFresh) throw new Error('Expected first fresh beneficiary');
        await args(fresh, { includesAddons: true });
        const result = await state(firstFresh);
        expect(result.grants[0]?.includesAddons).toBe(true);
    });
    it('(j) concurrent runs each write once and skip once per beneficiary', async () => {
        const fresh = [await trialUser('j1'), await trialUser('j2')];
        const [first, second] = await Promise.all([args(fresh), args(fresh)]);
        for (const userId of fresh) {
            expect((await state(userId)).grants).toHaveLength(1);
            const outcomes = [first, second]
                .map((result) => result.beneficiaries.find((row) => row.userId === userId)?.outcome)
                .sort();
            expect(outcomes).toEqual(['skipped', 'written']);
        }
    });
    it('(h4) fails closed when operator role resolution returns no roles', async () => {
        const noRoles = await user('no-roles');
        await expect(resolveCutoverOperatorActor({ userId: noRoles })).rejects.toHaveProperty(
            'name',
            'Step3bOperatorUnresolvedError'
        );
    });
});
