/**
 * Static guard: every relation/junction model's `getTableName()` must return
 * the SAME identifier as the Drizzle table it was constructed with (HOS-598).
 *
 * ## Why this exists
 *
 * `BaseModelImpl.findAllWithRelations` / `findOneWithRelations` resolve the
 * Drizzle relational query builder via `db.query[this.getTableName()]`. That
 * object's keys come directly from the export names in
 * `packages/db/src/schemas/index.ts` (the barrel imported as `* as
 * hospedaSchema` and spread into the combined schema passed to `drizzle()` —
 * see `packages/db/src/client.ts`). So `getTableName()` MUST return exactly
 * the identifier the model's own `table` field was assigned from — anything
 * else throws `Invalid table configuration for: <wrong name>` the moment a
 * caller requests a populated relation, regardless of the query's input.
 *
 * HOS-598 found this live in production:
 * `RAccommodationFeatureModel.getTableName()` returned the pluralized
 * `'rAccommodationFeatures'` while the schema module exports the table as
 * the singular `rAccommodationFeature`, so
 * `GET /api/v1/public/features/accommodation/{id}` 500'd unconditionally.
 * `RAccommodationAmenityModel` carried the exact same defect. Both are fixed
 * alongside this guard; see
 * `packages/db/test/integration/r-accommodation-feature-amenity.model.integration.test.ts`
 * for the DB-backed regression test proving the fix against a real schema.
 *
 * ## Why a static text scan instead of instantiating each model
 *
 * This mirrors the existing repo convention for "N places forgot X" bugs
 * (see `apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts` and
 * `apps/api/test/services/inv1-cache-invalidation.guard.test.ts`): no DB, no
 * module resolution, no app boot — just source text, so the guard is fast
 * and cannot itself flake on an unrelated import failure elsewhere in the
 * dependency graph.
 *
 * ## Scope
 *
 * Scoped to relation/junction models — the class of bug HOS-598 describes
 * ("algún otro modelo de tabla de relación") — identified by the repo's own
 * naming convention: a model class named `R<PascalCase>Model` extending
 * `BaseModelImpl`. There are 13 today; all pass after the HOS-598 fix with
 * zero exceptions needed.
 *
 * A broader, PRE-EXISTING mismatch of the same shape (`getTableName()`
 * returning a snake_case SQL table name instead of the camelCase export
 * identifier) exists on ~18 NON-relation models (billing, audit-log,
 * exchange-rate, content-moderation, revalidation-config, platform-settings,
 * cron, user-identity/push-tokens, app-log). That is a real latent bug but a
 * different, larger-blast-radius fix outside HOS-598's scope (relation
 * tables specifically) — tracked as a separate follow-up rather than folded
 * in here. Do NOT widen this guard's file glob to "every model with
 * getTableName()" without first fixing (or deliberately, visibly
 * allowlisting with a tracked issue) those 18 — an unscoped widening would
 * turn this guard red on unrelated pre-existing debt.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODELS_ROOT = join(__dirname, '../../src/models');

/** Recursively collects every `.model.ts` file under `packages/db/src/models`. */
function collectModelFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...collectModelFiles(fullPath));
        } else if (entry.endsWith('.model.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * A relation/junction model file: exports a class named `R<PascalCase>Model`
 * extending `BaseModelImpl` — the repo's established naming convention for
 * junction-table models (e.g. `RAccommodationFeatureModel`,
 * `RDestinationAttractionModel`, `RUserPermissionModel`).
 */
const RELATION_MODEL_CLASS_PATTERN = /export class (R[A-Z]\w*Model) extends BaseModelImpl/;

/** Extracts the identifier assigned to `protected table = <identifier>;`. */
const TABLE_FIELD_PATTERN = /protected(?: override)? table\s*=\s*([A-Za-z0-9_]+)\s*;/;

/** Extracts the string literal returned by `getTableName(): string { return '<name>'; }`. */
const GET_TABLE_NAME_PATTERN = /getTableName\(\):\s*string\s*\{\s*return\s*'([^']+)'\s*;/;

const modelFiles = collectModelFiles(MODELS_ROOT);

const relationModels = modelFiles
    .map((filePath) => {
        const source = readFileSync(filePath, 'utf-8');
        const classMatch = source.match(RELATION_MODEL_CLASS_PATTERN);
        if (!classMatch) return null;
        return { filePath, className: classMatch[1], source };
    })
    .filter((entry): entry is { filePath: string; className: string; source: string } =>
        Boolean(entry)
    );

describe('Relation model getTableName() registration guard (HOS-598)', () => {
    it('finds relation models to check — a guard with nothing to check is not a guard', () => {
        // Sanity check on the discovery mechanism itself: if this drops to zero,
        // the glob/regex broke silently and every other assertion below would
        // vacuously pass. 13 relation models exist at the time this guard was
        // written; assert a stable floor rather than an exact count so adding a
        // 14th doesn't require touching this file.
        expect(relationModels.length).toBeGreaterThanOrEqual(13);
    });

    it.each(relationModels)('$className: getTableName() matches the assigned table identifier', ({
        filePath,
        className,
        source
    }) => {
        const tableFieldMatch = source.match(TABLE_FIELD_PATTERN);
        expect(
            tableFieldMatch,
            `${className} (${filePath}) has no "protected table = <identifier>;" field — cannot verify getTableName() registration`
        ).not.toBeNull();
        const tableIdentifier = tableFieldMatch?.[1];

        const getTableNameMatch = source.match(GET_TABLE_NAME_PATTERN);
        expect(
            getTableNameMatch,
            `${className} (${filePath}) has no getTableName() override — required by BaseModelImpl`
        ).not.toBeNull();
        const registeredName = getTableNameMatch?.[1];

        expect(
            registeredName,
            `${className} (${filePath}): getTableName() returns '${registeredName}' but the model's ` +
                `table field is assigned from '${tableIdentifier}'. db.query[getTableName()] is looked ` +
                `up by this exact string against the schema module's export names — a mismatch throws ` +
                `"Invalid table configuration for: ${registeredName}" the instant findAllWithRelations() ` +
                `or findOneWithRelations() is called with any relation requested, independent of the ` +
                `query input (HOS-598). Fix: return '${tableIdentifier}' instead.`
        ).toBe(tableIdentifier);
    });
});
