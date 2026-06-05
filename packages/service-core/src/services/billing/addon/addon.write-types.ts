/**
 * Addon Catalog Write Types
 *
 * Internal input types used by the addon CRUD module for write operations.
 * Public-facing types are derived from `@repo/schemas`.
 *
 * @module services/billing/addon/addon.write-types
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new billing addon.
 * Aligned with `CreateAddonSchema` from `@repo/schemas`.
 */
export interface CreateAddonInput {
    /** Unique add-on slug — stored in `metadata.slug`. Immutable after creation. */
    readonly slug: string;
    /** Human-readable display name (stored in `billing_addons.name`) */
    readonly name: string;
    /** Add-on description */
    readonly description: string;
    /** Whether this is a one-time purchase or a recurring subscription */
    readonly billingType: 'one_time' | 'recurring';
    /** Price in ARS cents — must be a positive integer */
    readonly priceArs: number;
    /**
     * Duration in days for one-time addons. `null` for recurring addons.
     */
    readonly durationDays: number | null;
    /**
     * The limit key this addon affects (e.g. `"maxListings"`). `null` when
     * the addon does not modify any quota.
     */
    readonly affectsLimitKey: string | null;
    /**
     * How much to increase the limit identified by `affectsLimitKey`. `null`
     * when `affectsLimitKey` is null.
     */
    readonly limitIncrease: number | null;
    /**
     * Entitlement key unlocked by this addon. `null` when the addon does not
     * grant an entitlement.
     */
    readonly grantsEntitlement: string | null;
    /** Plan categories that may purchase this addon */
    readonly targetCategories: readonly ('owner' | 'complex')[];
    /** Whether the addon is currently available for purchase */
    readonly isActive: boolean;
    /** Display sort order (non-negative integer) */
    readonly sortOrder: number;
}

/**
 * Input for updating an existing billing addon.
 * `slug` is intentionally absent — it is immutable after creation.
 * All fields are optional (partial update).
 */
export interface UpdateAddonInput {
    /** Human-readable display name */
    readonly name?: string;
    /** Add-on description */
    readonly description?: string;
    /** Whether this is a one-time purchase or a recurring subscription */
    readonly billingType?: 'one_time' | 'recurring';
    /** Price in ARS cents */
    readonly priceArs?: number;
    /** Duration in days for one-time addons (null for recurring) */
    readonly durationDays?: number | null;
    /** The limit key this addon affects (null when not applicable) */
    readonly affectsLimitKey?: string | null;
    /** How much to increase the limit (null when not applicable) */
    readonly limitIncrease?: number | null;
    /** Entitlement key unlocked by this addon (null when not applicable) */
    readonly grantsEntitlement?: string | null;
    /** Plan categories that may purchase this addon */
    readonly targetCategories?: readonly ('owner' | 'complex')[];
    /** Whether the addon is currently available for purchase */
    readonly isActive?: boolean;
    /** Display sort order */
    readonly sortOrder?: number;
}
