/**
 * Integration tests for promo defaults and structural definitions (SPEC-192 T-035)
 *
 * Covers:
 * 1. ensureDefaultPromoCodes idempotency: run twice with mocked PromoCodeService;
 *    create called only for missing codes on first run, zero creates on second run
 *    (skip-by-code).
 * 2. Static guard: DEFAULT_PROMO_CODES must NOT be exported from the service-core
 *    package barrel (it is a module-private const). Verified by importing the
 *    package index and asserting the symbol is absent.
 * 3. ENTITLEMENT_DEFINITIONS and LIMIT_METADATA are exported from @repo/billing
 *    with expected shapes (non-empty, enum-keyed).
 *
 * All DB calls are mocked via vi.mock. No live database is required.
 * Mock-backed per project integration-test convention; live-DB variant deferred
 * to e2e suite.
 *
 * File placed in packages/service-core/test/integration/billing/ per the
 * project convention (not src/__tests__/integration/ as in spec text).
 *
 * @module test/integration/billing/promo-and-structural
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock handles ──────────────────────────────────────────────────

const mockGetByCode = vi.fn();
const mockCreate = vi.fn();

// ─── Mock PromoCodeService ─────────────────────────────────────────────────
// This mock must be declared before importing ensureDefaultPromoCodes, which
// constructs `new PromoCodeService()` at call time.

vi.mock('../../../src/services/billing/promo-code/promo-code.service.js', () => ({
    PromoCodeService: vi.fn().mockImplementation(() => ({
        getByCode: mockGetByCode,
        create: mockCreate
    }))
}));

// ─── Imports after mocks ───────────────────────────────────────────────────

import {
    ensureDefaultPromoCodes,
    getDefaultPromoCodeConfigs
} from '../../../src/services/billing/promo-code/promo-code-defaults.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Returns a successful getByCode result (code already exists). */
function foundResult(code: string) {
    return { success: true as const, data: { id: `id-${code}`, code } };
}

/** Returns a not-found getByCode result (code is absent). */
function notFoundResult() {
    return { success: false as const, error: { code: 'NOT_FOUND', message: 'Not found' } };
}

/** Returns a successful create result. */
function createdResult(code: string) {
    return { success: true as const, data: { id: `new-${code}`, code } };
}

// ─── Tests: ensureDefaultPromoCodes idempotency ────────────────────────────

describe('ensureDefaultPromoCodes idempotency (T-035)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('first run: all codes absent → each created once', () => {
        it('should call create for every default code on first run', async () => {
            // Arrange
            const configs = getDefaultPromoCodeConfigs();
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(notFoundResult());
                mockCreate.mockResolvedValueOnce(createdResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockCreate).toHaveBeenCalledTimes(configs.length);
            for (const cfg of configs) {
                expect(mockGetByCode).toHaveBeenCalledWith(cfg.code);
            }
        });
    });

    describe('second run: all codes present → zero creates', () => {
        it('should not call create on second run when all codes exist', async () => {
            // Arrange — both runs see all codes present
            const configs = getDefaultPromoCodeConfigs();

            // First run
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }
            // Second run
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            // Assert — no creates on either run
            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockGetByCode).toHaveBeenCalledTimes(configs.length * 2);
        });
    });

    describe('idempotency: run twice; only missing codes created on first run', () => {
        it('should create once then skip on subsequent call (skip-by-code)', async () => {
            // Arrange — first run: all absent → created; second run: all present → skipped
            const configs = getDefaultPromoCodeConfigs();

            // First run: absent
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(notFoundResult());
                mockCreate.mockResolvedValueOnce(createdResult(cfg.code));
            }

            // Second run: all present
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            // Assert — created exactly once per default code
            expect(mockCreate).toHaveBeenCalledTimes(configs.length);
        });
    });

    describe('partial state: some codes present, some absent', () => {
        it('should create only absent codes', async () => {
            // Arrange — first code absent, second (if exists) present
            const configs = getDefaultPromoCodeConfigs();
            if (configs.length === 0) return; // guard

            // First code: absent
            mockGetByCode.mockResolvedValueOnce(notFoundResult());
            mockCreate.mockResolvedValueOnce(createdResult(configs[0]?.code ?? 'HOSPEDA_FREE'));

            // Remaining codes: present
            for (let i = 1; i < configs.length; i++) {
                mockGetByCode.mockResolvedValueOnce(foundResult(configs[i]?.code ?? ''));
            }

            // Act
            await ensureDefaultPromoCodes();

            // Assert — create called only for the absent code
            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(mockGetByCode).toHaveBeenCalledTimes(configs.length);
        });
    });
});

// ─── Tests: static guard — DEFAULT_PROMO_CODES not in barrel ──────────────

describe('static guard: DEFAULT_PROMO_CODES not exported from service-core barrel (T-035)', () => {
    it('DEFAULT_PROMO_CODES should not be a named export of the service-core package index', async () => {
        // Rationale: DEFAULT_PROMO_CODES is a startup/seed-path-only const
        // (see module JSDoc banner in promo-code-defaults.ts). It must stay
        // private — request-time callers must use PromoCodeService.getByCode().
        //
        // Assertion strategy: dynamically import the service-core package index
        // and verify the symbol is absent from the exported namespace.
        //
        // We use a dynamic import with the path alias; Vitest resolves it via
        // the tsconfig paths plugin. If the alias is not available in this
        // context we fall back to a relative-path import of the src/index.ts.

        let serviceCorePkg: Record<string, unknown>;

        try {
            // Primary: use the package alias (resolved via tsconfig paths)
            serviceCorePkg = (await import('@repo/service-core')) as Record<string, unknown>;
        } catch {
            // Fallback: relative path from this test file's location
            serviceCorePkg = (await import('../../../src/index.js')) as Record<string, unknown>;
        }

        // DEFAULT_PROMO_CODES must NOT appear in the exported namespace
        expect('DEFAULT_PROMO_CODES' in serviceCorePkg).toBe(false);

        // Sanity: the service-core barrel DOES export AddonCatalogService
        // (confirms we actually loaded the right module)
        expect('AddonCatalogService' in serviceCorePkg).toBe(true);
    });

    it('getDefaultPromoCodeConfigs IS exported (needed for dev tooling)', async () => {
        // getDefaultPromoCodeConfigs is the intentional public API for accessing
        // the config in tests and seed tooling — verify it is accessible.
        let pkg: Record<string, unknown>;

        try {
            pkg = (await import('@repo/service-core')) as Record<string, unknown>;
        } catch {
            pkg = (await import('../../src/index.js')) as Record<string, unknown>;
        }

        // The function should be present in the barrel
        expect(typeof pkg.getDefaultPromoCodeConfigs).toBe('function');
    });
});

// ─── Tests: ENTITLEMENT_DEFINITIONS from @repo/billing ────────────────────

describe('ENTITLEMENT_DEFINITIONS from @repo/billing (T-035)', () => {
    it('should be exported and non-empty', async () => {
        const { ENTITLEMENT_DEFINITIONS } = await import('@repo/billing');

        expect(Array.isArray(ENTITLEMENT_DEFINITIONS)).toBe(true);
        expect(ENTITLEMENT_DEFINITIONS.length).toBeGreaterThan(0);
    });

    it('each definition should have key, name, description fields', async () => {
        const { ENTITLEMENT_DEFINITIONS } = await import('@repo/billing');

        for (const def of ENTITLEMENT_DEFINITIONS) {
            expect(typeof def.key).toBe('string');
            expect(def.key.length).toBeGreaterThan(0);
            expect(typeof def.name).toBe('string');
            expect(typeof def.description).toBe('string');
        }
    });

    it('all keys should be from EntitlementKey enum (no orphaned string literals)', async () => {
        const { ENTITLEMENT_DEFINITIONS, EntitlementKey } = await import('@repo/billing');

        const allEnumValues = new Set(Object.values(EntitlementKey as Record<string, string>));

        for (const def of ENTITLEMENT_DEFINITIONS) {
            expect(allEnumValues.has(def.key)).toBe(true);
        }
    });

    it('should include FEATURED_LISTING and PUBLISH_ACCOMMODATIONS', async () => {
        const { ENTITLEMENT_DEFINITIONS } = await import('@repo/billing');

        const keys = ENTITLEMENT_DEFINITIONS.map((d) => d.key);
        // EntitlementKey values are lowercase snake_case (e.g. 'featured_listing')
        expect(keys).toContain('featured_listing');
        expect(keys).toContain('publish_accommodations');
    });
});

// ─── Tests: LIMIT_METADATA from @repo/billing ─────────────────────────────

describe('LIMIT_METADATA from @repo/billing (T-035)', () => {
    it('should be exported and non-empty', async () => {
        const { LIMIT_METADATA } = await import('@repo/billing');

        expect(typeof LIMIT_METADATA).toBe('object');
        expect(LIMIT_METADATA).not.toBeNull();
        expect(Object.keys(LIMIT_METADATA).length).toBeGreaterThan(0);
    });

    it('each entry should have name and description fields', async () => {
        const { LIMIT_METADATA } = await import('@repo/billing');

        for (const [key, meta] of Object.entries(LIMIT_METADATA)) {
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
            expect(typeof (meta as { name: string; description: string }).name).toBe('string');
            expect(typeof (meta as { name: string; description: string }).description).toBe(
                'string'
            );
        }
    });

    it('should include MAX_ACCOMMODATIONS and MAX_PHOTOS_PER_ACCOMMODATION', async () => {
        const { LIMIT_METADATA } = await import('@repo/billing');
        const keys = Object.keys(LIMIT_METADATA);

        // LimitKey values are lowercase snake_case (e.g. 'max_accommodations')
        expect(keys).toContain('max_accommodations');
        expect(keys).toContain('max_photos_per_accommodation');
    });

    it('all keys should be from LimitKey enum (exhaustive coverage)', async () => {
        const { LIMIT_METADATA, LimitKey } = await import('@repo/billing');

        const allEnumValues = new Set(Object.values(LimitKey as Record<string, string>));
        const metaKeys = new Set(Object.keys(LIMIT_METADATA));

        // Every LimitKey must have metadata
        for (const enumVal of allEnumValues) {
            expect(metaKeys.has(enumVal)).toBe(true);
        }
    });
});
