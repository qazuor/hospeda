import type { CommandCategory, CommandMode } from './types.js';

/**
 * Display order for command categories in the interactive menu.
 * Categories are shown in this exact sequence from top to bottom.
 */
export const CATEGORY_DISPLAY_ORDER = [
    'development',
    'database',
    'testing',
    'code-quality',
    'build',
    'environment',
    'documentation',
    'infrastructure',
    'package-tools'
] as const satisfies readonly CommandCategory[];

/**
 * Human-readable labels for each command category.
 * Used in menu headers and category separators.
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
    development: 'Development',
    database: 'Database',
    testing: 'Testing',
    'code-quality': 'Code Quality',
    build: 'Build',
    environment: 'Environment',
    documentation: 'Documentation',
    infrastructure: 'Infrastructure',
    'package-tools': 'Package Tools'
};

/**
 * Infers the best-fit {@link CommandCategory} for a script based on its name.
 *
 * Pattern-matching rules (evaluated top-to-bottom, first match wins):
 * - `build*`                  → `build`
 * - `dev*`                    → `development`
 * - `test*`                   → `testing`
 * - `lint*|format*|check*|typecheck*` → `code-quality`
 * - `db:*|seed*|migrate*`     → `database`
 * - `clean*`                  → `build`
 * - `env:*|env*`              → `environment`
 * - `docs:*|doc:*`            → `documentation`
 * - `setup*`                  → `infrastructure`
 * - _(default)_               → `package-tools`
 *
 * @param input - Object containing the script name to classify
 * @param input.scriptName - The raw script name from package.json
 * @returns The inferred {@link CommandCategory}
 *
 * @example
 * ```ts
 * inferCategory({ scriptName: 'build:api' })    // 'build'
 * inferCategory({ scriptName: 'dev' })           // 'development'
 * inferCategory({ scriptName: 'db:migrate' })    // 'database'
 * inferCategory({ scriptName: 'typecheck' })     // 'code-quality'
 * inferCategory({ scriptName: 'generate:types'}) // 'package-tools'
 * ```
 */
export function inferCategory({ scriptName }: { scriptName: string }): CommandCategory {
    if (scriptName.startsWith('build')) return 'build';
    if (scriptName.startsWith('dev')) return 'development';
    if (scriptName.startsWith('test')) return 'testing';
    if (
        scriptName.startsWith('lint') ||
        scriptName.startsWith('format') ||
        scriptName.startsWith('check') ||
        scriptName.startsWith('typecheck')
    ) {
        return 'code-quality';
    }
    if (
        scriptName.startsWith('db:') ||
        scriptName.startsWith('seed') ||
        scriptName.startsWith('migrate')
    ) {
        return 'database';
    }
    if (scriptName.startsWith('clean')) return 'build';
    if (scriptName.startsWith('env:') || scriptName.startsWith('env')) return 'environment';
    if (scriptName.startsWith('docs:') || scriptName.startsWith('doc:')) return 'documentation';
    if (scriptName.startsWith('setup')) return 'infrastructure';
    return 'package-tools';
}

/**
 * Infers the execution {@link CommandMode} for a script based on its name.
 *
 * Pattern-matching rules (evaluated top-to-bottom, first match wins):
 * - `dev*`       → `long-running` (dev servers run until Ctrl+C)
 * - `*:watch`    → `long-running` (watch mode runs indefinitely)
 * - _(default)_  → `one-shot`    (runs and exits)
 *
 * @param input - Object containing the script name to classify
 * @param input.scriptName - The raw script name from package.json
 * @returns The inferred {@link CommandMode}
 *
 * @example
 * ```ts
 * inferMode({ scriptName: 'dev' })          // 'long-running'
 * inferMode({ scriptName: 'dev:api' })      // 'long-running'
 * inferMode({ scriptName: 'test:watch' })   // 'long-running'
 * inferMode({ scriptName: 'build' })        // 'one-shot'
 * inferMode({ scriptName: 'lint' })         // 'one-shot'
 * ```
 */
export function inferMode({ scriptName }: { scriptName: string }): CommandMode {
    if (scriptName.startsWith('dev')) return 'long-running';
    if (scriptName.endsWith(':watch')) return 'long-running';
    return 'one-shot';
}
