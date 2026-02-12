import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SEED_DATA_DIR = join(__dirname, '..', '..', 'seed', 'src', 'data');
const LEVEL_DIR = join(SEED_DATA_DIR, 'sponsorshipLevel');
const PACKAGE_DIR = join(SEED_DATA_DIR, 'sponsorshipPackage');

/**
 * Read and parse all JSON files from a directory
 */
function loadJsonSeedFiles(
    dir: string
): Array<{ filename: string; data: Record<string, unknown> }> {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    return files.map((filename) => ({
        filename,
        data: JSON.parse(readFileSync(join(dir, filename), 'utf-8')) as Record<string, unknown>
    }));
}

describe('Sponsorship Level Seeds', () => {
    const levels = loadJsonSeedFiles(LEVEL_DIR);

    it('should have at least one sponsorship level seed file', () => {
        expect(levels.length).toBeGreaterThan(0);
    });

    it('should have 5 sponsorship level seed files', () => {
        expect(levels).toHaveLength(5);
    });

    it.each(levels.map((l) => [l.filename, l.data]))(
        '%s should parse as valid JSON',
        (_filename, data) => {
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        }
    );

    it.each(levels.map((l) => [l.filename, l.data]))(
        '%s should have required fields',
        (_filename, data) => {
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('slug');
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('targetType');
            expect(data).toHaveProperty('tier');
            expect(data).toHaveProperty('priceAmount');
            expect(data).toHaveProperty('priceCurrency');
            expect(data).toHaveProperty('benefits');
            expect(data).toHaveProperty('sortOrder');
            expect(data).toHaveProperty('isActive');
        }
    );

    it.each(levels.map((l) => [l.filename, l.data]))(
        '%s should have priceAmount as a positive integer in centavos',
        (_filename, data) => {
            const price = data.priceAmount as number;
            expect(price).toBeGreaterThan(0);
            expect(Number.isInteger(price)).toBe(true);
        }
    );

    it.each(levels.map((l) => [l.filename, l.data]))(
        '%s should have isActive as a boolean',
        (_filename, data) => {
            expect(typeof data.isActive).toBe('boolean');
        }
    );

    it.each(levels.map((l) => [l.filename, l.data]))(
        '%s should have benefits as a non-empty array',
        (_filename, data) => {
            expect(Array.isArray(data.benefits)).toBe(true);
            expect((data.benefits as string[]).length).toBeGreaterThan(0);
        }
    );

    it('should have unique sortOrder values', () => {
        const sortOrders = levels.map((l) => l.data.sortOrder);
        const uniqueSortOrders = new Set(sortOrders);
        expect(uniqueSortOrders.size).toBe(sortOrders.length);
    });

    it('should have unique slug values', () => {
        const slugs = levels.map((l) => l.data.slug);
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it('should have valid targetType values', () => {
        const validTargetTypes = ['EVENT', 'POST'];
        for (const level of levels) {
            expect(validTargetTypes).toContain(level.data.targetType);
        }
    });

    it('should have valid tier values', () => {
        const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'STANDARD', 'PREMIUM'];
        for (const level of levels) {
            expect(validTiers).toContain(level.data.tier);
        }
    });
});

describe('Sponsorship Package Seeds', () => {
    const packages = loadJsonSeedFiles(PACKAGE_DIR);

    it('should have at least one sponsorship package seed file', () => {
        expect(packages.length).toBeGreaterThan(0);
    });

    it('should have 3 sponsorship package seed files', () => {
        expect(packages).toHaveLength(3);
    });

    it.each(packages.map((p) => [p.filename, p.data]))(
        '%s should parse as valid JSON',
        (_filename, data) => {
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        }
    );

    it.each(packages.map((p) => [p.filename, p.data]))(
        '%s should have required fields',
        (_filename, data) => {
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('slug');
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('priceAmount');
            expect(data).toHaveProperty('priceCurrency');
            expect(data).toHaveProperty('includedPosts');
            expect(data).toHaveProperty('includedEvents');
            expect(data).toHaveProperty('sortOrder');
            expect(data).toHaveProperty('isActive');
        }
    );

    it.each(packages.map((p) => [p.filename, p.data]))(
        '%s should have priceAmount as a positive integer in centavos',
        (_filename, data) => {
            const price = data.priceAmount as number;
            expect(price).toBeGreaterThan(0);
            expect(Number.isInteger(price)).toBe(true);
        }
    );

    it.each(packages.map((p) => [p.filename, p.data]))(
        '%s should have isActive as a boolean',
        (_filename, data) => {
            expect(typeof data.isActive).toBe('boolean');
        }
    );

    it.each(packages.map((p) => [p.filename, p.data]))(
        '%s should have non-negative includedPosts and includedEvents',
        (_filename, data) => {
            expect(data.includedPosts as number).toBeGreaterThanOrEqual(0);
            expect(data.includedEvents as number).toBeGreaterThanOrEqual(0);
        }
    );

    it('should have unique sortOrder values', () => {
        const sortOrders = packages.map((p) => p.data.sortOrder);
        const uniqueSortOrders = new Set(sortOrders);
        expect(uniqueSortOrders.size).toBe(sortOrders.length);
    });

    it('should have unique slug values', () => {
        const slugs = packages.map((p) => p.data.slug);
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it('should reference valid event level IDs', () => {
        const levels = loadJsonSeedFiles(LEVEL_DIR);
        const levelIds = new Set(levels.map((l) => l.data.id));

        for (const pkg of packages) {
            if (pkg.data.eventLevelId) {
                expect(levelIds).toContain(pkg.data.eventLevelId);
            }
        }
    });
});
