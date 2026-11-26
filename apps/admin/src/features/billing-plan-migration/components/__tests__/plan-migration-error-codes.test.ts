// @vitest-environment jsdom
import en from '@repo/i18n/locales/en/admin-pages.json';
import es from '@repo/i18n/locales/es/admin-pages.json';
import pt from '@repo/i18n/locales/pt/admin-pages.json';
import { PLAN_MIGRATION_REJECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PLAN_MIGRATION_ERROR_KEYS } from '../PlanMigrationScreen';

/** Resolves an `admin-pages.<path>` key against a locale JSON object. */
function resolve(node: unknown, path: string): unknown {
    return path
        .split('.')
        .reduce<unknown>(
            (current, segment) =>
                typeof current === 'object' && current !== null
                    ? (current as Record<string, unknown>)[segment]
                    : undefined,
            node
        );
}

const LOCALES: Readonly<Record<string, unknown>> = { en, es, pt };

describe('HOS-2110 plan migration error codes', () => {
    it('types the copy map over the shared tuple', () => {
        // Arrange + Act + Assert
        expect(Object.keys(PLAN_MIGRATION_ERROR_KEYS).sort()).toEqual(
            [...PLAN_MIGRATION_REJECTIONS].sort()
        );
        expect(Object.keys(PLAN_MIGRATION_ERROR_KEYS).length).toBe(
            PLAN_MIGRATION_REJECTIONS.length
        );
    });

    it.each(
        Object.entries(LOCALES)
    )('every tuple code has an admin-pages.planMigration.errors text in %s', (_locale, catalog) => {
        // Arrange
        const missing = PLAN_MIGRATION_REJECTIONS.filter(
            (code) => typeof resolve(catalog, `planMigration.errors.${code}`) !== 'string'
        );

        // Act + Assert
        expect(missing).toEqual([]);
    });
});
