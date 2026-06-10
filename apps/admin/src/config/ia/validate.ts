/**
 * Admin IA Config — Boot Validation Entry Point (T-019)
 *
 * Imports the raw assembled config from `./index` and validates it against
 * {@link AdminIAConfigSchema}. Validation runs **at module load**: the moment
 * any module in the app imports `validatedConfig` (directly or transitively),
 * the IIFE executes and either:
 *
 * - Returns the parsed, defaults-applied `AdminIAConfig` object — the app
 *   continues normally.
 * - Throws an `Error` with a multi-line message listing every validation issue
 *   with its full dot-path — the app refuses to start.
 *
 * This early-exit behaviour is intentional: a misconfigured IA config produces
 * a broken UI that is harder to debug than a clear boot-time crash.
 *
 * @see apps/admin/src/config/ia/index.ts  — raw config assembly (T-017)
 * @see apps/admin/src/config/ia/schema.ts — cross-reference validations (T-018)
 * @see .claude/audit/admin-redesign/proposals/02-config-schema.md §14
 *
 * @example
 * ```ts
 * // In the admin shell entry point or route root:
 * import { validatedConfig } from '@/config/ia/validate';
 *
 * // validatedConfig is AdminIAConfig — fully typed with Zod defaults applied.
 * const sections = validatedConfig.sections;
 * ```
 */

import { rawConfig } from './index';
import { AdminIAConfigSchema } from './schema';
import type { AdminIAConfig } from './schema';

/**
 * The validated and defaults-applied Admin IA configuration.
 *
 * Produced by parsing {@link rawConfig} through {@link AdminIAConfigSchema} at
 * module load. All fields with Zod `.default()` values (`onMissing`, `exact`,
 * `defaultOpen`, `labelOverrides`, `scope`) are guaranteed to be present in
 * this object.
 *
 * **Import this instead of `rawConfig`** in all application code. The type is
 * `AdminIAConfig` (the Zod output type), not the input shape.
 *
 * @throws {Error} If validation fails — the error message lists every issue
 *   with its dot-path so the developer can locate and fix the problem quickly.
 *
 * @example
 * ```ts
 * import { validatedConfig } from '@/config/ia/validate';
 *
 * // Navigate the fully-typed config:
 * const hostRole = validatedConfig.roles['HOST'];
 * if (hostRole?.enabled) {
 *   console.log(hostRole.mainMenu); // string[]
 * }
 * ```
 */
export const validatedConfig: AdminIAConfig = (() => {
    const result = AdminIAConfigSchema.safeParse(rawConfig);
    if (!result.success) {
        const formatted = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(
            `[admin-ia.config] Validation failed:\n${formatted}\n\nFix the config in apps/admin/src/config/ia/ and restart.`
        );
    }
    return result.data;
})();
