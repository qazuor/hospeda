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

    /**
     * Spanish translation of `description`. Used by interactive tooling
     * when the user prefers Spanish output. Optional — tooling falls back
     * to `description` when absent.
     */
    readonly descriptionEs?: string;

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

    /**
     * Free-form instructions shown in interactive prompts to help the
     * developer obtain a valid value. Use plain text — multiple sentences
     * allowed. Should explain how to generate the value or where to find it
     * (provider dashboard URL, CLI command, etc.).
     *
     * Examples:
     *   - 'Generate with: openssl rand -base64 32'
     *   - 'Get it from the Clerk dashboard → API Keys → Secret keys'
     *   - 'Postgres connection string: postgresql://user:pass@host:port/db'
     */
    readonly howToObtain?: string;

    /**
     * Spanish translation of `howToObtain`. Used by interactive tooling
     * when the user prefers Spanish output. Optional — tooling falls back
     * to `howToObtain` when absent.
     */
    readonly howToObtainEs?: string;

    /**
     * URL to the provider's documentation, dashboard, or signup page where the
     * value can be obtained. Shown in interactive prompts as a clickable hint.
     *
     * Examples:
     *   - 'https://dashboard.clerk.com/last-active?path=api-keys'
     *   - 'https://www.mercadopago.com.ar/developers/panel/credentials'
     */
    readonly helpUrl?: string;
}
