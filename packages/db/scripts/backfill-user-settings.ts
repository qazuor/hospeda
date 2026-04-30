/**
 * Backfill script: copy legacy `darkMode` / `language` user settings into the
 * new per-surface fields introduced for SPEC-096 / REQ-096-05.
 *
 * For each user where `settings.darkMode` and/or `settings.language` are set
 * AND the corresponding new field (`themeWeb`, `themeAdmin`, `languageWeb`,
 * `languageAdmin`) is null/undefined, the legacy value is copied into BOTH
 * the web and admin surface fields:
 *
 *   - `darkMode: true`  → `themeWeb = 'dark'`,  `themeAdmin = 'dark'`
 *   - `darkMode: false` → `themeWeb = 'light'`, `themeAdmin = 'light'`
 *   - `language: 'es'`  → `languageWeb = 'es'`, `languageAdmin = 'es'`
 *
 * Usage:
 *   pnpm tsx packages/db/scripts/backfill-user-settings.ts            # dry-run (default)
 *   pnpm tsx packages/db/scripts/backfill-user-settings.ts --apply    # commit changes
 *
 * REQ-096-05 / SPEC-096 (T-012)
 */

import { createLogger } from '@repo/logger';
import type { UserSettings } from '@repo/schemas';
import { isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import 'dotenv/config';
import { Pool } from 'pg';
import * as schema from '../src/schemas/index.ts';
import { users } from '../src/schemas/user/user.dbschema.ts';

const logger = createLogger('backfill-user-settings');

const DRY_RUN = !process.argv.includes('--apply');

// =============================================================================
// Pure backfill logic (extracted so it can be unit tested without a DB)
// =============================================================================

/**
 * Result of computing a backfill for a single user's settings object.
 */
export type BackfillResult = {
    /** Whether the settings would change (true → write back). */
    changed: boolean;
    /** Updated settings object (same shape as input when `changed === false`). */
    settings: UserSettings;
    /** Per-field annotations describing what (if anything) was copied. */
    appliedFields: ReadonlyArray<keyof UserSettings>;
};

/**
 * Maps legacy `darkMode` boolean → ThemeEnum string.
 * `true`  → `'dark'`
 * `false` → `'light'`
 */
const mapDarkModeToTheme = (darkMode: boolean): 'dark' | 'light' => (darkMode ? 'dark' : 'light');

/**
 * Compute the backfill for a single user's settings.
 *
 * Only copies a legacy value into a new field when:
 *   1. The legacy field is non-null (`darkMode` or `language` is set), AND
 *   2. The destination field is null/undefined (do NOT clobber existing values).
 *
 * Pure function: does not mutate the input.
 */
export const computeUserSettingsBackfill = (
    settings: UserSettings | null | undefined
): BackfillResult => {
    // Treat missing settings as the default shape — nothing to backfill.
    if (!settings) {
        return {
            changed: false,
            settings: settings as unknown as UserSettings,
            appliedFields: []
        };
    }

    const next = { ...settings };
    const applied: Array<keyof UserSettings> = [];

    // darkMode → themeWeb / themeAdmin
    if (typeof settings.darkMode === 'boolean') {
        const theme = mapDarkModeToTheme(settings.darkMode);
        if (settings.themeWeb == null) {
            next.themeWeb = theme;
            applied.push('themeWeb');
        }
        if (settings.themeAdmin == null) {
            next.themeAdmin = theme;
            applied.push('themeAdmin');
        }
    }

    // language → languageWeb / languageAdmin
    if (typeof settings.language === 'string' && settings.language.length > 0) {
        // Only the supported locales survive; everything else is left as-is for
        // a follow-up cleanup pass (we do not want to silently lose data).
        const supported: ReadonlyArray<'es' | 'en' | 'pt'> = ['es', 'en', 'pt'];
        const lang = settings.language as 'es' | 'en' | 'pt';
        if (supported.includes(lang)) {
            if (settings.languageWeb == null) {
                next.languageWeb = lang;
                applied.push('languageWeb');
            }
            if (settings.languageAdmin == null) {
                next.languageAdmin = lang;
                applied.push('languageAdmin');
            }
        }
    }

    return {
        changed: applied.length > 0,
        settings: next,
        appliedFields: applied
    };
};

// =============================================================================
// Script entrypoint
// =============================================================================

async function main(): Promise<void> {
    if (DRY_RUN) {
        logger.info('Running in DRY-RUN mode. Pass --apply to execute updates.');
    } else {
        logger.info('Running in APPLY mode. Updates will be committed to the database.');
    }

    const dbUrl = process.env.HOSPEDA_DATABASE_URL;
    if (!dbUrl) {
        logger.error('HOSPEDA_DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: dbUrl });
    const db = drizzle(pool, { schema });

    try {
        // Fetch all live users; the JSONB `settings` column is small so we can
        // page in-memory rather than streaming.
        const rows = await db
            .select({
                id: users.id,
                settings: users.settings
            })
            .from(users)
            .where(isNull(users.deletedAt));

        logger.info({ count: rows.length }, 'Users scanned');

        let updated = 0;
        let skipped = 0;

        for (const row of rows) {
            const result = computeUserSettingsBackfill(row.settings as UserSettings);

            if (!result.changed) {
                skipped++;
                continue;
            }

            if (DRY_RUN) {
                logger.info(
                    {
                        userId: row.id,
                        appliedFields: result.appliedFields
                    },
                    '[dry-run] Would update user settings'
                );
                updated++;
                continue;
            }

            await db
                .update(users)
                .set({
                    settings: result.settings,
                    updatedAt: new Date()
                })
                .where(sql`${users.id} = ${row.id}`);

            logger.info(
                {
                    userId: row.id,
                    appliedFields: result.appliedFields
                },
                'Updated user settings'
            );
            updated++;
        }

        logger.info(
            { updated, skipped, dryRun: DRY_RUN },
            DRY_RUN ? 'Dry-run complete' : 'Backfill complete'
        );
    } finally {
        await pool.end();
    }
}

// Only run when invoked directly (not when imported by tests).
const isMainModule = (() => {
    try {
        // tsx/node ESM: import.meta.url matches process.argv[1] when run directly
        // CJS fallback: require.main === module
        return (
            typeof process !== 'undefined' &&
            process.argv[1] !== undefined &&
            import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')
        );
    } catch {
        return false;
    }
})();

if (isMainModule) {
    main().catch((err) => {
        logger.error({ err }, 'Backfill script failed');
        process.exit(1);
    });
}
