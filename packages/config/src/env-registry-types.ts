/**
 * Shared type definitions for the environment variable registry.
 *
 * Extracted into a separate module so that category-specific registry
 * files can import types without creating circular dependencies.
 *
 * @module env-registry-types
 */

/**
 * Value type of an environment variable.
 *
 * - `string`  - Arbitrary text value
 * - `url`     - Must be a valid URL
 * - `number`  - Numeric value (coerced from string)
 * - `boolean` - Boolean flag (`true`/`false`, `1`/`0`, etc.)
 * - `enum`    - One of a fixed set of string literals (see `enumValues`)
 */
export type EnvVarType = 'string' | 'url' | 'number' | 'boolean' | 'enum';

/**
 * Identifier for apps/services that consume an environment variable.
 */
export type AppId = 'api' | 'web' | 'admin' | 'docker' | 'seed';

/**
 * Complete definition of a single environment variable in the Hospeda platform.
 *
 * Every entry in `ENV_REGISTRY` satisfies this interface, providing a
 * self-contained description that can drive tooling (example-file generation,
 * documentation, audit scripts, etc.) without touching production code.
 */
export interface EnvVarDefinition {
    /** Environment variable name (e.g. `HOSPEDA_DATABASE_URL`). */
    readonly name: string;

    /** Human-readable description of what this variable controls. */
    readonly description: string;

    /** Runtime value type. Use `enum` together with `enumValues`. */
    readonly type: EnvVarType;

    /** Whether the variable MUST be present for the app(s) to start. */
    readonly required: boolean;

    /**
     * Whether the value is sensitive (credentials, tokens, secrets).
     * Secret variables are omitted from logs and never committed to VCS.
     */
    readonly secret: boolean;

    /**
     * Default value applied when the variable is absent.
     * Only present when there is a meaningful production-safe default.
     */
    readonly defaultValue?: string;

    /**
     * Representative value used in generated `.env.example` files.
     * Must be safe to commit (no real credentials).
     */
    readonly exampleValue: string;

    /**
     * Allowed values for `type: 'enum'` variables.
     * Must be non-empty when `type === 'enum'`; omitted otherwise.
     */
    readonly enumValues?: readonly string[];

    /** List of apps / services that read this variable. */
    readonly apps: readonly AppId[];

    /** Logical grouping used for documentation and tooling output. */
    readonly category: string;
}
