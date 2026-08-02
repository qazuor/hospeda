/**
 * Exhaustiveness guard for the plan-editor entitlement picker (HOS-331).
 *
 * `ENTITLEMENT_GROUP_KEYS` drives which entitlements the plan create/edit
 * dialog renders. It is a hand-maintained list, so every entitlement added to
 * `EntitlementKey` since the list was written stayed invisible in the admin —
 * the whole AI suite plus five tourist entitlements were ungrantable through
 * the UI. Nothing failed, because nothing checked.
 *
 * This asserts the list against the enum itself, so the next added key fails
 * CI until it is grouped.
 *
 * @module test/billing-plans/plan-entitlement-groups.test
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENTITLEMENT_DEFINITIONS, EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_GROUP_KEYS } from '@/features/billing-plans/components/plan-entitlement-groups';

const ALL_KEYS = Object.values(EntitlementKey);
const GROUPED_KEYS = ENTITLEMENT_GROUP_KEYS.flatMap((group) => group.keys);

const LOCALES = ['es', 'en', 'pt'] as const;
const LOCALES_DIR = resolve(__dirname, '../../../../packages/i18n/src/locales');

describe('ENTITLEMENT_GROUP_KEYS — exhaustiveness (HOS-331)', () => {
    it('groups every entitlement key the catalog defines', () => {
        const grouped = new Set<string>(GROUPED_KEYS);
        const ungrouped = ALL_KEYS.filter((key) => !grouped.has(key));
        expect(ungrouped).toEqual([]);
    });

    it('never lists a key twice, in the same group or across groups', () => {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const key of GROUPED_KEYS) {
            if (seen.has(key)) duplicates.push(key);
            seen.add(key);
        }
        expect(duplicates).toEqual([]);
    });

    it('lists no key that the catalog does not define', () => {
        const known = new Set<string>(ALL_KEYS);
        expect(GROUPED_KEYS.filter((key) => !known.has(key))).toEqual([]);
    });

    it('resolves a display name for every grouped key', () => {
        // A key with no `ENTITLEMENT_DEFINITIONS` entry renders as a humanized
        // slug, which reads like a bug to the operator.
        const defined = new Set<string>(ENTITLEMENT_DEFINITIONS.map((def) => def.key));
        expect(GROUPED_KEYS.filter((key) => !defined.has(key))).toEqual([]);
    });

    it('has a translated header for every group, in every locale', () => {
        // `PlanDialog` renders each group header via
        // `admin-billing.plans.dialog.entitlementGroups.<labelKey>`. A missing
        // key surfaces as the raw dotted key in the dialog — the visible
        // failure mode of adding a group without its label.
        const missing: string[] = [];
        for (const locale of LOCALES) {
            const file = resolve(LOCALES_DIR, locale, 'admin-billing.json');
            const dict = JSON.parse(readFileSync(file, 'utf8')) as {
                plans?: { dialog?: { entitlementGroups?: Record<string, string> } };
            };
            const labels = dict.plans?.dialog?.entitlementGroups ?? {};
            for (const group of ENTITLEMENT_GROUP_KEYS) {
                if (!labels[group.labelKey]?.trim()) {
                    missing.push(`${locale}: ${group.labelKey}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('has more than one group, each non-empty', () => {
        // Guards the guard: a single catch-all group would make the
        // exhaustiveness assertion above pass without organizing anything.
        expect(ENTITLEMENT_GROUP_KEYS.length).toBeGreaterThan(1);
        for (const group of ENTITLEMENT_GROUP_KEYS) {
            expect(group.keys.length).toBeGreaterThan(0);
        }
    });
});
