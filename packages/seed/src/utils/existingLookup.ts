/**
 * Builders for the `existing` (skip-if-exists) option of `createSeedFactory`
 * (HOS-735).
 *
 * `--required` is meant to be ADDITIVE: it is how an already-populated
 * database gets a catalog that grew. Every factory-based required seeder used
 * to `INSERT` unconditionally, so the first duplicate UNIQUE key aborted the
 * run. These helpers keep the per-seeder wiring to one line and give the
 * lookup key a single, greppable home.
 *
 * Additive means new ROWS: a fixture row that does not exist yet is created on a
 * re-run. It does NOT mean new relations, FAQs or `postProcess` output on rows
 * that already exist; those are skipped and reach an already-seeded environment
 * only through a seed data-migration (the dual-write rule).
 *
 * @module existingLookup
 */

/**
 * Shape accepted by `SeedFactoryConfig.existing`, minus the model class.
 * Kept structural so this module does not import the factory (no cycle).
 */
type WhereBuilder = (item: unknown, normalizedData: unknown) => Record<string, unknown>;

/**
 * Builds a `getWhere` that identifies a row by the fixture's own `slug`.
 *
 * Reads the RAW fixture item on purpose: several normalizers strip `slug`
 * (the service regenerates it from the name), and the regenerated value is
 * what ends up in the UNIQUE index. The fixtures' curated slugs match it.
 *
 * @returns A `getWhere` for `{ slug }`.
 * @throws {Error} At lookup time when the fixture carries no string `slug`.
 *
 * @example
 * ```ts
 * existing: { modelClass: AmenityModel, getWhere: whereFixtureSlug() }
 * ```
 */
export function whereFixtureSlug(): WhereBuilder {
    return (item) => {
        const slug = (item as { slug?: unknown } | null)?.slug;
        if (typeof slug !== 'string' || slug.length === 0) {
            throw new Error('Cannot check for an existing row: the fixture has no "slug"');
        }
        return { slug };
    };
}

/**
 * Builds a `getWhere` from a fixed list of fixture fields, for tables whose
 * natural key is composite (no `slug`), e.g. exchange rates.
 *
 * @param params.fields - Fixture field names forming the natural key.
 * @returns A `getWhere` for that key.
 * @throws {Error} At lookup time when any listed field is missing on the fixture.
 *
 * @example
 * ```ts
 * getWhere: whereFixtureFields({ fields: ['fromCurrency', 'toCurrency', 'rateType', 'source'] })
 * ```
 */
export function whereFixtureFields(params: { readonly fields: readonly string[] }): WhereBuilder {
    const { fields } = params;
    return (item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const where: Record<string, unknown> = {};
        for (const field of fields) {
            if (record[field] === undefined || record[field] === null) {
                throw new Error(`Cannot check for an existing row: fixture is missing "${field}"`);
            }
            where[field] = record[field];
        }
        return where;
    };
}
