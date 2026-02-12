/**
 * Configuration drift detection utility for the billing system.
 *
 * Compares static billing configuration (plans, addons, entitlements, limits)
 * against database state to detect inconsistencies. Designed to be run at
 * application startup in development or as a CI/CD check.
 */

import type { AddonDefinition } from '../types/addon.types.js';
import type { EntitlementKey } from '../types/entitlement.types.js';
import type { LimitKey, PlanDefinition } from '../types/plan.types.js';

/** Drift severity level */
export type DriftSeverity = 'error' | 'warning' | 'info';

/** A single drift item describing a mismatch between config and database */
export interface DriftItem {
    /** The entity type that has drifted */
    entityType: 'plan' | 'addon' | 'entitlement' | 'limit';
    /** Unique identifier (slug or key) */
    identifier: string;
    /** What kind of drift was detected */
    driftType: 'missing_in_db' | 'missing_in_config' | 'value_mismatch';
    /** Human-readable description of the drift */
    message: string;
    /** Severity level */
    severity: DriftSeverity;
    /** Expected value from config (if applicable) */
    expected?: unknown;
    /** Actual value from database (if applicable) */
    actual?: unknown;
}

/** Result of a drift check */
export interface DriftCheckResult {
    /** Whether any drift was detected */
    hasDrift: boolean;
    /** Total number of drift items */
    totalDrifts: number;
    /** Number of errors */
    errorCount: number;
    /** Number of warnings */
    warningCount: number;
    /** Individual drift items */
    items: readonly DriftItem[];
    /** Timestamp of the check */
    checkedAt: Date;
}

/** Database records to compare against config */
export interface DatabaseState {
    /** Plan slugs present in the database */
    planSlugs: readonly string[];
    /** Addon slugs present in the database */
    addonSlugs: readonly string[];
    /** Entitlement keys present in the database */
    entitlementKeys: readonly string[];
    /** Limit keys present in the database */
    limitKeys: readonly string[];
}

/**
 * Checks for drift between static billing config and database state.
 *
 * Compares plans, addons, entitlements, and limits defined in
 * static configuration against what exists in the database.
 *
 * @param params - The check parameters
 * @param params.plans - Static plan definitions from config
 * @param params.addons - Static addon definitions from config
 * @param params.entitlementKeys - Static entitlement keys from config
 * @param params.limitKeys - Static limit keys from config
 * @param params.dbState - Current database state
 * @returns DriftCheckResult with all detected mismatches
 *
 * @example
 * ```ts
 * const result = checkConfigDrift({
 *     plans: ALL_PLANS,
 *     addons: ALL_ADDONS,
 *     entitlementKeys: Object.values(EntitlementKey),
 *     limitKeys: Object.values(LimitKey),
 *     dbState: {
 *         planSlugs: ['owner-basico', 'owner-pro'],
 *         addonSlugs: ['visibility-boost-7d'],
 *         entitlementKeys: ['PUBLISH_ACCOMMODATIONS'],
 *         limitKeys: ['max_accommodations']
 *     }
 * });
 *
 * if (result.hasDrift) {
 *     console.warn(`Config drift detected: ${result.totalDrifts} items`);
 *     for (const item of result.items) {
 *         console.warn(`[${item.severity}] ${item.message}`);
 *     }
 * }
 * ```
 */
export function checkConfigDrift({
    plans,
    addons,
    entitlementKeys,
    limitKeys,
    dbState
}: {
    plans: readonly PlanDefinition[];
    addons: readonly AddonDefinition[];
    entitlementKeys: readonly EntitlementKey[];
    limitKeys: readonly LimitKey[];
    dbState: DatabaseState;
}): DriftCheckResult {
    const items: DriftItem[] = [];

    // Check plans
    checkEntityDrift({
        entityType: 'plan',
        configIdentifiers: plans.map((p) => p.slug),
        dbIdentifiers: dbState.planSlugs,
        items
    });

    // Check addons
    checkEntityDrift({
        entityType: 'addon',
        configIdentifiers: addons.map((a) => a.slug),
        dbIdentifiers: dbState.addonSlugs,
        items
    });

    // Check entitlements
    checkEntityDrift({
        entityType: 'entitlement',
        configIdentifiers: entitlementKeys as readonly string[],
        dbIdentifiers: dbState.entitlementKeys,
        items
    });

    // Check limits
    checkEntityDrift({
        entityType: 'limit',
        configIdentifiers: limitKeys as readonly string[],
        dbIdentifiers: dbState.limitKeys,
        items
    });

    const errorCount = items.filter((i) => i.severity === 'error').length;
    const warningCount = items.filter((i) => i.severity === 'warning').length;

    return {
        hasDrift: items.length > 0,
        totalDrifts: items.length,
        errorCount,
        warningCount,
        items,
        checkedAt: new Date()
    };
}

/**
 * Checks drift for a single entity type by comparing config identifiers against DB identifiers
 */
function checkEntityDrift({
    entityType,
    configIdentifiers,
    dbIdentifiers,
    items
}: {
    entityType: DriftItem['entityType'];
    configIdentifiers: readonly string[];
    dbIdentifiers: readonly string[];
    items: DriftItem[];
}): void {
    const dbSet = new Set(dbIdentifiers);
    const configSet = new Set(configIdentifiers);

    // Items in config but not in DB (missing seeds)
    for (const id of configIdentifiers) {
        if (!dbSet.has(id)) {
            items.push({
                entityType,
                identifier: id,
                driftType: 'missing_in_db',
                message: `${entityType} "${id}" exists in config but not in database. Run seeds to fix.`,
                severity: 'error'
            });
        }
    }

    // Items in DB but not in config (orphaned records)
    for (const id of dbIdentifiers) {
        if (!configSet.has(id)) {
            items.push({
                entityType,
                identifier: id,
                driftType: 'missing_in_config',
                message: `${entityType} "${id}" exists in database but not in config. May be orphaned.`,
                severity: 'warning'
            });
        }
    }
}

/**
 * Formats a DriftCheckResult as a human-readable string for logging
 *
 * @param params - The format parameters
 * @param params.result - The drift check result to format
 * @returns Formatted string suitable for console output
 */
export function formatDriftReport({ result }: { result: DriftCheckResult }): string {
    if (!result.hasDrift) {
        return 'Config drift check: No drift detected. Config and database are in sync.';
    }

    const lines: string[] = [
        `Config drift check: ${result.totalDrifts} drift(s) detected (${result.errorCount} errors, ${result.warningCount} warnings)`,
        ''
    ];

    const grouped = new Map<string, DriftItem[]>();
    for (const item of result.items) {
        const key = item.entityType;
        const existing = grouped.get(key) ?? [];
        existing.push(item);
        grouped.set(key, existing);
    }

    for (const [entityType, entityItems] of grouped) {
        lines.push(`  ${entityType}s:`);
        for (const item of entityItems) {
            const icon = item.severity === 'error' ? 'ERR' : 'WARN';
            lines.push(`    [${icon}] ${item.message}`);
        }
    }

    return lines.join('\n');
}
