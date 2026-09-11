/**
 * HOS-1012 T-036 — the snapshot-vs-composition guard (spec §6.8).
 *
 * > **The snapshot is for showing. The composition is for gating.** If the two
 * > ever diverge, what goes stale is a screen, never a door.
 *
 * Every fixture in this file is a **ROW**, not a config constant, and that is
 * the whole point. A guard that compared `OWNER_TRIAL_PLAN.entitlements` with
 * `OWNER_PRO_PLAN.entitlements` would agree with itself by construction: those
 * two ARE the same array in `trial-plans.config.ts`. The drift this guard exists
 * to catch is an operator raising a limit or granting an entitlement through the
 * admin `PlanDialog` — a change that, under HOS-39's Model C, lives ONLY in the
 * database and never touches the repo.
 *
 * So the rows below start from the config (that is what a freshly-seeded
 * database holds) and are then EDITED the way an operator would, which is what
 * makes the positive control a real control.
 */
import { describe, expect, it } from 'vitest';
import {
    ALL_TRIAL_PLANS,
    describeTrialSnapshotDivergences,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    findTrialSnapshotDivergences,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    type PlanDefinition,
    TRIAL_COMPOSITION_METADATA_KEY,
    type TrialSnapshotPlanRow
} from '../src/index.js';

/** Turns a `PlanDefinition` into the row shape the database would hold. */
function asRow(plan: PlanDefinition, metadata?: Record<string, unknown>): TrialSnapshotPlanRow {
    return {
        slug: plan.slug,
        entitlements: [...plan.entitlements],
        limits: Object.fromEntries(plan.limits.map((l) => [l.key, l.value])),
        metadata: metadata ?? { slug: plan.slug }
    };
}

/** A trial plan row, carrying its composition in metadata like the seed writes it. */
function trialRow(index: number): TrialSnapshotPlanRow {
    const entry = ALL_TRIAL_PLANS[index];
    if (!entry) throw new Error(`no trial plan at index ${index}`);
    return asRow(entry.plan, {
        slug: entry.plan.slug,
        [TRIAL_COMPOSITION_METADATA_KEY]: entry.composition
    });
}

/** The full set of rows a freshly-seeded database holds for these six + three plans. */
function freshlySeededRows(): TrialSnapshotPlanRow[] {
    return [
        asRow(OWNER_PRO_PLAN),
        asRow(OWNER_BASICO_PLAN),
        asRow(GASTRONOMY_PRO_PLAN),
        asRow(GASTRONOMY_BASICO_PLAN),
        asRow(EXPERIENCE_PRO_PLAN),
        asRow(EXPERIENCE_BASICO_PLAN),
        trialRow(0),
        trialRow(1),
        trialRow(2)
    ];
}

describe('trial snapshot guard — the aligned state', () => {
    it('reports nothing when every snapshot matches what its composition resolves', () => {
        expect(findTrialSnapshotDivergences({ rows: freshlySeededRows() })).toEqual([]);
    });

    it('covers all three verticals, not just accommodation', () => {
        // The rows include three trial plans. If the guard only ever looked at
        // one of them, the positive controls below would still pass for that one
        // and silently say nothing about the other two.
        const rows = freshlySeededRows();
        const trialRows = rows.filter(
            (r) => (r.metadata as Record<string, unknown>)[TRIAL_COMPOSITION_METADATA_KEY]
        );
        expect(trialRows.map((r) => r.slug)).toEqual([
            'owner-trial',
            'gastronomy-trial',
            'experience-trial'
        ]);
    });

    it('says nothing about ordinary plans', () => {
        expect(
            findTrialSnapshotDivergences({
                rows: [asRow(OWNER_PRO_PLAN), asRow(OWNER_BASICO_PLAN)]
            })
        ).toEqual([]);
    });
});

describe('trial snapshot guard — POSITIVE CONTROLS (diverge a source, guard must fire)', () => {
    it('fires when an operator grants the ENTITLEMENTS source a new entitlement', () => {
        const rows = freshlySeededRows();
        // Exactly the supported admin action: edit owner-pro's entitlements.
        // Nothing in the repo changes; only this row does.
        const pro = rows.find((r) => r.slug === 'owner-pro');
        if (!pro) throw new Error('fixture missing owner-pro');
        rows[rows.indexOf(pro)] = {
            ...pro,
            entitlements: [...(pro.entitlements ?? []), 'custom_branding']
        };

        const divergences = findTrialSnapshotDivergences({ rows });

        expect(divergences).toHaveLength(1);
        expect(divergences[0]).toMatchObject({
            trialPlanSlug: 'owner-trial',
            kind: 'entitlements',
            sourceSlug: 'owner-pro'
        });
        // And it says which side gates: the composed set, not the snapshot.
        expect(divergences[0]?.composed).toContain('custom_branding');
        expect(divergences[0]?.snapshot).not.toContain('custom_branding');
    });

    it('fires when an operator raises the LIMITS source cap', () => {
        const rows = freshlySeededRows();
        const basico = rows.find((r) => r.slug === 'owner-basico');
        if (!basico) throw new Error('fixture missing owner-basico');
        rows[rows.indexOf(basico)] = {
            ...basico,
            limits: { ...(basico.limits ?? {}), max_photos_per_accommodation: 40 }
        };

        const divergences = findTrialSnapshotDivergences({ rows });

        expect(divergences).toHaveLength(1);
        expect(divergences[0]).toMatchObject({
            trialPlanSlug: 'owner-trial',
            kind: 'limits',
            sourceSlug: 'owner-basico'
        });
    });

    it('fires per vertical — a gastronomy edit is not reported as an accommodation one', () => {
        const rows = freshlySeededRows();
        const gastroPro = rows.find((r) => r.slug === 'gastronomy-pro');
        if (!gastroPro) throw new Error('fixture missing gastronomy-pro');
        rows[rows.indexOf(gastroPro)] = {
            ...gastroPro,
            entitlements: ['featured_listing']
        };

        const divergences = findTrialSnapshotDivergences({ rows });

        expect(divergences).toHaveLength(1);
        expect(divergences[0]?.trialPlanSlug).toBe('gastronomy-trial');
    });

    it('fires when the snapshot itself was hand-edited away from its sources', () => {
        // The other direction of the same divergence, and the one T-038 exists
        // to make impossible: someone editing the TRIAL plan row directly.
        const rows = freshlySeededRows();
        const trial = rows.find((r) => r.slug === 'owner-trial');
        if (!trial) throw new Error('fixture missing owner-trial');
        rows[rows.indexOf(trial)] = {
            ...trial,
            limits: { ...(trial.limits ?? {}), max_accommodations: 10 }
        };

        const divergences = findTrialSnapshotDivergences({ rows });

        expect(divergences).toHaveLength(1);
        expect(divergences[0]).toMatchObject({ kind: 'limits', trialPlanSlug: 'owner-trial' });
    });

    it('reports a composition whose source plan does not exist at all', () => {
        const rows = [trialRow(0), asRow(OWNER_BASICO_PLAN)];

        const divergences = findTrialSnapshotDivergences({ rows });

        expect(divergences).toEqual([
            { trialPlanSlug: 'owner-trial', kind: 'missing-source', sourceSlug: 'owner-pro' }
        ]);
    });

    it('is insensitive to ORDERING, so a reordered row is not a false positive', () => {
        const rows = freshlySeededRows();
        const pro = rows.find((r) => r.slug === 'owner-pro');
        if (!pro) throw new Error('fixture missing owner-pro');
        rows[rows.indexOf(pro)] = {
            ...pro,
            entitlements: [...(pro.entitlements ?? [])].reverse()
        };

        expect(findTrialSnapshotDivergences({ rows })).toEqual([]);
    });
});

describe('describeTrialSnapshotDivergences', () => {
    it('says which side gates', () => {
        const lines = describeTrialSnapshotDivergences([
            {
                trialPlanSlug: 'owner-trial',
                kind: 'limits',
                sourceSlug: 'owner-basico',
                composed: [['max_accommodations', 1]],
                snapshot: [['max_accommodations', 10]]
            }
        ]);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('gating uses');
        expect(lines[0]).toContain('owner-trial');
    });

    it('names the absent plan for a missing source', () => {
        const lines = describeTrialSnapshotDivergences([
            { trialPlanSlug: 'owner-trial', kind: 'missing-source', sourceSlug: 'owner-pro' }
        ]);
        expect(lines[0]).toContain('owner-pro');
        expect(lines[0]).toContain('was not found');
    });
});
