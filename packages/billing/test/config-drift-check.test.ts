import { describe, expect, it } from 'vitest';
import { ALL_ADDONS } from '../src/config/addons.config.js';
import { ALL_PLANS } from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';
import { checkConfigDrift, formatDriftReport } from '../src/utils/config-drift-check.js';

describe('Config Drift Check', () => {
    const allEntitlementKeys = Object.values(EntitlementKey);
    const allLimitKeys = Object.values(LimitKey);

    describe('checkConfigDrift', () => {
        it('should return no drift when config and DB are in sync', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ALL_PLANS.map((p) => p.slug),
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            expect(result.hasDrift).toBe(false);
            expect(result.totalDrifts).toBe(0);
            expect(result.errorCount).toBe(0);
            expect(result.warningCount).toBe(0);
            expect(result.items).toHaveLength(0);
            expect(result.checkedAt).toBeInstanceOf(Date);
        });

        it('should detect plans missing in DB', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ['owner-basico'], // missing most plans
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            expect(result.hasDrift).toBe(true);
            expect(result.errorCount).toBe(8); // 9 plans - 1 = 8 missing
            const planDrifts = result.items.filter((i) => i.entityType === 'plan');
            expect(planDrifts).toHaveLength(8);
            for (const drift of planDrifts) {
                expect(drift.driftType).toBe('missing_in_db');
                expect(drift.severity).toBe('error');
            }
        });

        it('should detect addons missing in DB', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ALL_PLANS.map((p) => p.slug),
                    addonSlugs: [], // no addons seeded
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            expect(result.hasDrift).toBe(true);
            const addonDrifts = result.items.filter((i) => i.entityType === 'addon');
            expect(addonDrifts).toHaveLength(5); // 5 addons missing
        });

        it('should detect orphaned records in DB', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: [...ALL_PLANS.map((p) => p.slug), 'orphaned-plan'],
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            expect(result.hasDrift).toBe(true);
            expect(result.warningCount).toBe(1);
            const orphan = result.items.find((i) => i.identifier === 'orphaned-plan');
            expect(orphan).toBeDefined();
            expect(orphan?.driftType).toBe('missing_in_config');
            expect(orphan?.severity).toBe('warning');
        });

        it('should detect empty DB state as full drift', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: [],
                    addonSlugs: [],
                    entitlementKeys: [],
                    limitKeys: []
                }
            });

            expect(result.hasDrift).toBe(true);
            const expectedDrifts =
                ALL_PLANS.length +
                ALL_ADDONS.length +
                allEntitlementKeys.length +
                allLimitKeys.length;
            expect(result.totalDrifts).toBe(expectedDrifts);
            expect(result.errorCount).toBe(expectedDrifts);
            expect(result.warningCount).toBe(0);
        });

        it('should detect mixed drift (missing + orphaned)', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ['owner-basico', 'legacy-plan'],
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            expect(result.hasDrift).toBe(true);
            expect(result.errorCount).toBe(8); // 8 plans missing in DB
            expect(result.warningCount).toBe(1); // 1 orphaned plan
        });
    });

    describe('formatDriftReport', () => {
        it('should return sync message when no drift', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ALL_PLANS.map((p) => p.slug),
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            const report = formatDriftReport({ result });
            expect(report).toContain('No drift detected');
        });

        it('should format drift items grouped by entity type', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: ['owner-basico'],
                    addonSlugs: [],
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            const report = formatDriftReport({ result });
            expect(report).toContain('drift(s) detected');
            expect(report).toContain('plans:');
            expect(report).toContain('addons:');
            expect(report).toContain('[ERR]');
        });

        it('should show warning items with WARN prefix', () => {
            const result = checkConfigDrift({
                plans: ALL_PLANS,
                addons: ALL_ADDONS,
                entitlementKeys: allEntitlementKeys,
                limitKeys: allLimitKeys,
                dbState: {
                    planSlugs: [...ALL_PLANS.map((p) => p.slug), 'orphaned-plan'],
                    addonSlugs: ALL_ADDONS.map((a) => a.slug),
                    entitlementKeys: allEntitlementKeys,
                    limitKeys: allLimitKeys
                }
            });

            const report = formatDriftReport({ result });
            expect(report).toContain('[WARN]');
            expect(report).toContain('orphaned-plan');
        });
    });
});
