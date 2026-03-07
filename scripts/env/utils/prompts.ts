/**
 * Interactive prompt utilities for env management scripts.
 *
 * Provides typed wrappers around `@inquirer/prompts` for selecting
 * apps, environments, and confirming individual variable operations.
 *
 * @module scripts/env/utils/prompts
 */

import { confirm, select } from '@inquirer/prompts';

/**
 * App selection result — includes all individual apps plus 'all'.
 */
export type AppSelection = 'api' | 'web' | 'admin' | 'all';

/**
 * Vercel environment target selection.
 */
export type EnvironmentSelection = 'development' | 'preview' | 'production';

/**
 * Parameters for the confirmVar prompt.
 */
interface ConfirmVarParams {
    /** Variable name to display. */
    readonly key: string;
    /** Action label (e.g. `'Pull'`, `'Push'`, `'Update'`). */
    readonly action: string;
    /** Optional value preview to display alongside the key. */
    readonly value?: string;
}

/**
 * Prompts the user to select which app to operate on.
 *
 * @returns Selected app identifier or `'all'` for all apps.
 *
 * @example
 * ```ts
 * const app = await selectApp();
 * // 'api' | 'web' | 'admin' | 'all'
 * ```
 */
export async function selectApp(): Promise<AppSelection> {
    return select<AppSelection>({
        message: 'Which app?',
        choices: [
            { name: 'API    (apps/api)', value: 'api' },
            { name: 'Web    (apps/web)', value: 'web' },
            { name: 'Admin  (apps/admin)', value: 'admin' },
            { name: 'All apps', value: 'all' }
        ]
    });
}

/**
 * Prompts the user to select a Vercel deployment environment target.
 *
 * @returns Selected Vercel environment name.
 *
 * @example
 * ```ts
 * const env = await selectEnvironment();
 * // 'development' | 'preview' | 'production'
 * ```
 */
export async function selectEnvironment(): Promise<EnvironmentSelection> {
    return select<EnvironmentSelection>({
        message: 'Which Vercel environment?',
        choices: [
            { name: 'Development', value: 'development' },
            { name: 'Preview', value: 'preview' },
            { name: 'Production', value: 'production' }
        ]
    });
}

/**
 * Prompts the user to confirm an operation on a single environment variable.
 *
 * Defaults to `true` (confirmed) so that pressing Enter accepts the action.
 *
 * @param params - Action label, variable key, and optional value preview.
 * @returns `true` if the user confirms, `false` if they decline.
 *
 * @example
 * ```ts
 * const ok = await confirmVar({
 *   action: 'Pull',
 *   key: 'HOSPEDA_API_URL',
 *   value: 'https://api.example.com',
 * });
 * ```
 */
export async function confirmVar(params: ConfirmVarParams): Promise<boolean> {
    const { key, action, value } = params;
    const valueDisplay =
        value !== undefined ? ` = ${value.slice(0, 40)}${value.length > 40 ? '...' : ''}` : '';
    return confirm({
        message: `${action} ${key}${valueDisplay}?`,
        default: true
    });
}

/**
 * Prompts the user to confirm a bulk operation (e.g. push all changed vars).
 *
 * @param message - Question to display.
 * @param defaultValue - Default answer (default: `false` for bulk ops).
 * @returns `true` if confirmed, `false` otherwise.
 *
 * @example
 * ```ts
 * const proceed = await confirmBulk('Push all 3 changed variables?');
 * ```
 */
export async function confirmBulk(message: string, defaultValue = false): Promise<boolean> {
    return confirm({ message, default: defaultValue });
}
