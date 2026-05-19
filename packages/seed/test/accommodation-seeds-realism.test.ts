import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { IMAGE_POOL_BY_TYPE } from '../src/data/accommodation/_image-pool.js';

/**
 * SPEC-119 — Accommodation Example Seeds Realism.
 *
 * Invariants for the curated image pool and tiered pricing applied across the
 * 104 example accommodation seeds. Each `it` block corresponds to a SPEC-119
 * acceptance test:
 *
 *   - T-024: Image pool membership
 *   - T-025: Camping gallery uniqueness
 *   - T-026: Pricing tier distribution + gallery count variance
 *   - T-027: Named fee coverage + `others[]` coverage
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'accommodation');

type ImageEntry = { readonly url: string };
type Accommodation = {
    readonly id: string;
    readonly type: keyof typeof IMAGE_POOL_BY_TYPE;
    readonly destination: string;
    readonly media?: {
        featuredImage?: ImageEntry;
        gallery?: ImageEntry[];
    };
    readonly price?: {
        price?: number;
        currency?: string;
        additionalFees?: Record<string, unknown>;
        discounts?: Record<string, unknown>;
    };
};

const NAMED_FEES = [
    'cleaning',
    'tax',
    'lateCheckout',
    'pets',
    'bedlinen',
    'towels',
    'babyCrib',
    'babyHighChair',
    'extraBed',
    'securityDeposit',
    'extraGuest',
    'parking',
    'earlyCheckin',
    'lateCheckin',
    'luggageStorage'
] as const;
type NamedFee = (typeof NAMED_FEES)[number];

type Tier = 0 | 1 | 2 | 3;

const classifyTier = (price: Accommodation['price']): Tier => {
    if (!price) return 0;
    const namedFees = Object.keys(price.additionalFees ?? {}).filter((k) => k !== 'others');
    const namedDiscounts = Object.keys(price.discounts ?? {}).filter((k) => k !== 'others');
    if (namedFees.length === 0 && namedDiscounts.length === 0) return 1;
    if (namedFees.length >= 3 && namedDiscounts.length >= 1) return 3;
    return 2;
};

let accommodations: readonly Accommodation[] = [];

const loadAccommodations = (): readonly Accommodation[] => {
    const out: Accommodation[] = [];
    for (const dest of readdirSync(DATA_DIR, { withFileTypes: true })) {
        if (!dest.isDirectory()) continue;
        if (dest.name.startsWith('_')) continue;
        const folder = join(DATA_DIR, dest.name);
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const raw = readFileSync(join(folder, entry.name), 'utf8');
            const json = JSON.parse(raw) as Accommodation & { destination?: string };
            out.push({ ...json, destination: dest.name });
        }
    }
    return out;
};

beforeAll(() => {
    accommodations = loadAccommodations();
    expect(accommodations.length, 'must have 104 example accommodations').toBe(104);
});

describe('SPEC-119 T-024 — Image pool membership', () => {
    it('every featured image and gallery URL is a member of its type pool', () => {
        const offenders: string[] = [];
        for (const a of accommodations) {
            const pool = IMAGE_POOL_BY_TYPE[a.type];
            if (!pool) {
                offenders.push(`${a.id} has unpooled type ${a.type}`);
                continue;
            }
            const poolUrls = new Set(pool.map((p) => p.url));
            if (a.media?.featuredImage && !poolUrls.has(a.media.featuredImage.url)) {
                offenders.push(`${a.id} featuredImage not in pool: ${a.media.featuredImage.url}`);
            }
            for (const g of a.media?.gallery ?? []) {
                if (!poolUrls.has(g.url)) {
                    offenders.push(`${a.id} gallery URL not in pool: ${g.url}`);
                }
            }
        }
        expect(offenders, offenders.join('\n')).toHaveLength(0);
    });
});

describe('SPEC-119 T-025 — Camping gallery uniqueness', () => {
    it('no two camping galleries are identical', () => {
        const campings = accommodations.filter((a) => a.type === 'CAMPING');
        expect(campings.length, 'must have 15 camping seeds').toBe(15);
        const seen = new Map<string, string>();
        const collisions: string[] = [];
        for (const c of campings) {
            const urls = (c.media?.gallery ?? []).map((g) => g.url).sort();
            const key = urls.join('|');
            if (seen.has(key)) {
                collisions.push(`${c.id} has identical gallery to ${seen.get(key)}`);
            } else {
                seen.set(key, c.id);
            }
        }
        expect(collisions, collisions.join('\n')).toHaveLength(0);
    });

    it('featured images are unique within each pooled type', () => {
        const byType = new Map<string, Set<string>>();
        const dupes: string[] = [];
        for (const a of accommodations) {
            if (!a.media?.featuredImage) continue;
            const set = byType.get(a.type) ?? new Set<string>();
            if (set.has(a.media.featuredImage.url)) {
                dupes.push(`${a.id} duplicates featured URL within ${a.type}`);
            }
            set.add(a.media.featuredImage.url);
            byType.set(a.type, set);
        }
        expect(dupes, dupes.join('\n')).toHaveLength(0);
    });
});

describe('SPEC-119 T-026 — Pricing tier and gallery distribution', () => {
    it('tier counts match the 25/25/30/20 target within ±5%', () => {
        const total = accommodations.length;
        const counts: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
        for (const a of accommodations) counts[classifyTier(a.price)] += 1;
        const target = { 0: 0.25, 1: 0.25, 2: 0.3, 3: 0.2 };
        const tolerance = 0.05;
        for (const t of [0, 1, 2, 3] as Tier[]) {
            const actual = counts[t] / total;
            const targetPct = target[t];
            expect(
                Math.abs(actual - targetPct),
                `tier ${t}: actual ${(actual * 100).toFixed(1)}% vs target ${(targetPct * 100).toFixed(0)}%`
            ).toBeLessThanOrEqual(tolerance);
        }
    });

    it('gallery counts fall within [5, 24]', () => {
        for (const a of accommodations) {
            const n = a.media?.gallery?.length ?? 0;
            expect(n, `${a.id} gallery count`).toBeGreaterThanOrEqual(5);
            expect(n, `${a.id} gallery count`).toBeLessThanOrEqual(24);
        }
    });

    it('gallery count standard deviation is ≥ 3 across the dataset', () => {
        const counts = accommodations.map((a) => a.media?.gallery?.length ?? 0);
        const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
        const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
        const stddev = Math.sqrt(variance);
        expect(stddev, `actual stddev = ${stddev.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });
});

describe('SPEC-119 T-027 — Fee and `others[]` coverage', () => {
    it('each of the 15 named additionalFees fields appears in ≥5 entries', () => {
        const coverage: Record<NamedFee, number> = NAMED_FEES.reduce(
            (acc, f) => {
                acc[f] = 0;
                return acc;
            },
            {} as Record<NamedFee, number>
        );
        for (const a of accommodations) {
            const fees = a.price?.additionalFees;
            if (!fees) continue;
            for (const f of NAMED_FEES) {
                if (fees[f]) coverage[f] += 1;
            }
        }
        const undercover = NAMED_FEES.filter((f) => coverage[f] < 5);
        expect(
            undercover,
            `under-covered fees: ${undercover.map((f) => `${f}=${coverage[f]}`).join(', ')}`
        ).toHaveLength(0);
    });

    it('at least 3 entries use `additionalFees.others[]` (custom fees)', () => {
        const n = accommodations.filter((a) => {
            const others = a.price?.additionalFees?.others;
            return Array.isArray(others) && others.length > 0;
        }).length;
        expect(n, `actual count = ${n}`).toBeGreaterThanOrEqual(3);
    });

    it('at least 2 entries use `discounts.others[]` (custom discounts)', () => {
        const n = accommodations.filter((a) => {
            const others = a.price?.discounts?.others;
            return Array.isArray(others) && others.length > 0;
        }).length;
        expect(n, `actual count = ${n}`).toBeGreaterThanOrEqual(2);
    });
});
