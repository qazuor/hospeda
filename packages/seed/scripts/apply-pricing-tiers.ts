#!/usr/bin/env tsx
/**
 * SPEC-119 — Apply pricing tiers to accommodation seed JSONs.
 *
 * Recomputes the same deterministic tier assignment that
 * `plan-pricing-tiers.ts` produces, then writes a price block per tier:
 *
 *   - Tier 0: removes the `price` key entirely.
 *   - Tier 1: `{ price, currency }` only.
 *   - Tier 2: base + (1-2 `additionalFees` OR 1 discount).
 *   - Tier 3: base + 3-5 fees + 1-2 discounts, with `others[]` injected on
 *             specific accommodations for `additionalFees.others[]` (≥3) and
 *             `discounts.others[]` (≥2) coverage.
 *
 * Fee field coverage (all 15 named fields appear ≥5x across the dataset) is
 * achieved by deterministic round-robin assignment across Tier 2 + Tier 3
 * entries sorted by id.
 *
 * Determinism: seeded by FNV-1a(accommodation.id). Re-runs produce identical
 * output. Re-runs do NOT introduce drift if the planner output is unchanged.
 *
 * Usage:
 *   pnpm --filter @repo/seed exec tsx scripts/apply-pricing-tiers.ts \
 *     [--tier 0|1|2|3 ...] [--dry-run]
 *
 *   `--tier <N>`: restrict writes to entries assigned to tier N. May be
 *                 repeated for multiple tiers. Defaults to all four.
 *   `--dry-run`: print summary without writing JSONs.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Tier = 0 | 1 | 2 | 3;

type AccommodationMeta = {
    readonly file: string;
    readonly id: string;
    readonly type: string;
    readonly destination: string;
};

type Assignment = AccommodationMeta & { tier: Tier };

const TIER_PROPORTIONS: Record<Tier, number> = {
    0: 0.25,
    1: 0.25,
    2: 0.3,
    3: 0.2
} as const;

const fnv1a32 = (input: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const mulberry32 = (seed: number) => {
    let a = seed >>> 0;
    return (): number => {
        a = (a + 0x6d2b79f5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'accommodation');

// ---------- Tier assignment (copy of plan-pricing-tiers.ts logic) ----------

const initialTier = (id: string): Tier => {
    const u = fnv1a32(id) / 0x100000000;
    let acc = 0;
    for (const k of [0, 1, 2, 3] as const) {
        acc += TIER_PROPORTIONS[k];
        if (u < acc) return k;
    }
    return 3;
};

const assignTiers = (rows: AccommodationMeta[]): Assignment[] => {
    const sorted: Assignment[] = rows
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((m) => ({ ...m, tier: initialTier(m.id) }));

    const destCounts = new Map<string, number>();
    for (const r of sorted) destCounts.set(r.destination, (destCounts.get(r.destination) ?? 0) + 1);
    const destCap: Record<string, number> = {};
    for (const [d, n] of destCounts) destCap[d] = Math.max(1, Math.ceil(0.3 * n));

    const destTier0 = new Map<string, number>();
    for (const r of sorted) {
        if (r.tier !== 0) continue;
        const used = destTier0.get(r.destination) ?? 0;
        const cap = destCap[r.destination] ?? 0;
        if (used >= cap) r.tier = 1;
        else destTier0.set(r.destination, used + 1);
    }

    const typeTierMatrix = new Map<string, Set<Tier>>();
    for (const r of sorted) {
        if (!typeTierMatrix.has(r.type)) typeTierMatrix.set(r.type, new Set());
        (typeTierMatrix.get(r.type) as Set<Tier>).add(r.tier);
    }
    for (const [type, present] of typeTierMatrix) {
        for (const needed of [0, 1, 2, 3] as Tier[]) {
            if (present.has(needed)) continue;
            const counts = new Map<Tier, number>();
            for (const r of sorted) {
                if (r.type !== type) continue;
                counts.set(r.tier, (counts.get(r.tier) ?? 0) + 1);
            }
            let donor: Tier = 0;
            let donorCount = -1;
            for (const [t, n] of counts) {
                if (n > donorCount) {
                    donor = t;
                    donorCount = n;
                }
            }
            const candidate = sorted.find((r) => r.type === type && r.tier === donor);
            if (candidate && donor !== needed) {
                if (needed === 0) {
                    const used = destTier0.get(candidate.destination) ?? 0;
                    const cap = destCap[candidate.destination] ?? 0;
                    if (used >= cap) {
                        const alt = sorted.find(
                            (r) =>
                                r.type === type &&
                                r.tier === donor &&
                                (destTier0.get(r.destination) ?? 0) < (destCap[r.destination] ?? 0)
                        );
                        if (alt) {
                            alt.tier = needed;
                            destTier0.set(
                                alt.destination,
                                (destTier0.get(alt.destination) ?? 0) + 1
                            );
                            present.add(needed);
                            continue;
                        }
                    } else {
                        candidate.tier = needed;
                        destTier0.set(candidate.destination, used + 1);
                        present.add(needed);
                        continue;
                    }
                }
                candidate.tier = needed;
                present.add(needed);
            }
        }
    }

    const total = sorted.length;
    const target: Record<Tier, number> = {
        0: Math.round(TIER_PROPORTIONS[0] * total),
        1: Math.round(TIER_PROPORTIONS[1] * total),
        2: Math.round(TIER_PROPORTIONS[2] * total),
        3:
            total -
            Math.round(TIER_PROPORTIONS[0] * total) -
            Math.round(TIER_PROPORTIONS[1] * total) -
            Math.round(TIER_PROPORTIONS[2] * total)
    };
    const tally = (): Record<Tier, number> => {
        const c: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
        for (const r of sorted) c[r.tier] += 1;
        return c;
    };
    const promote = (donorTier: Tier, targetTier: Tier): boolean => {
        for (const r of sorted) {
            if (r.tier !== donorTier) continue;
            if (targetTier === 0) {
                const used = destTier0.get(r.destination) ?? 0;
                const cap = destCap[r.destination] ?? 0;
                if (used >= cap) continue;
                r.tier = 0;
                destTier0.set(r.destination, used + 1);
                return true;
            }
            r.tier = targetTier;
            return true;
        }
        return false;
    };
    for (let pass = 0; pass < total; pass += 1) {
        const c = tally();
        let changed = false;
        for (const t of [0, 1, 2, 3] as Tier[]) {
            if (c[t] >= target[t]) continue;
            let donor: Tier | null = null;
            let donorExcess = 0;
            for (const d of [0, 1, 2, 3] as Tier[]) {
                if (d === t) continue;
                const excess = c[d] - target[d];
                if (excess > donorExcess) {
                    donor = d;
                    donorExcess = excess;
                }
            }
            if (donor !== null && promote(donor, t)) {
                changed = true;
                break;
            }
        }
        if (!changed) break;
    }
    return sorted;
};

// ---------- ARS base price ranges per type ----------

type PriceRange = { readonly min: number; readonly max: number };
const BASE_RANGE_BY_TYPE: Record<string, PriceRange> = {
    CAMPING: { min: 5000, max: 20000 },
    HOSTEL: { min: 8000, max: 25000 },
    ROOM: { min: 12000, max: 40000 },
    APARTMENT: { min: 25000, max: 100000 },
    CABIN: { min: 30000, max: 120000 },
    HOTEL: { min: 35000, max: 200000 },
    HOUSE: { min: 50000, max: 200000 },
    COUNTRY_HOUSE: { min: 60000, max: 250000 }
};

const ROUND_TO = 500;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const randomInRange = (rng: () => number, min: number, max: number) => min + rng() * (max - min);
const randomBasePrice = (type: string, rng: () => number): number => {
    const range = BASE_RANGE_BY_TYPE[type];
    if (!range) throw new Error(`No base price range defined for type: ${type}`);
    return Math.max(ROUND_TO, roundTo(randomInRange(rng, range.min, range.max), ROUND_TO));
};

// ---------- Named fee fields (15) ----------

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

type FeeEntry = {
    price: number;
    currency: 'ARS';
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
    isOptional?: boolean;
    isIncluded?: boolean;
};

const buildFee = (field: NamedFee, basePrice: number, rng: () => number): FeeEntry => {
    switch (field) {
        case 'cleaning': {
            const pct = randomInRange(rng, 5, 15);
            return {
                price: Math.max(500, roundTo((pct / 100) * basePrice, 500)),
                currency: 'ARS',
                isPerStay: true
            };
        }
        case 'tax': {
            const pct = Math.round(randomInRange(rng, 5, 21));
            return {
                price: pct,
                currency: 'ARS',
                isPercent: true,
                isPerStay: true
            };
        }
        case 'lateCheckout':
        case 'earlyCheckin':
            return {
                price: roundTo(randomInRange(rng, 1500, 5000), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'pets':
            return {
                price: roundTo(randomInRange(rng, 2000, 8000), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'bedlinen':
            return {
                price: roundTo(randomInRange(rng, 1000, 3000), 500),
                currency: 'ARS',
                isPerStay: true
            };
        case 'towels':
            return {
                price: roundTo(randomInRange(rng, 1000, 2000), 500),
                currency: 'ARS',
                isPerStay: true
            };
        case 'babyCrib':
            return {
                price: roundTo(randomInRange(rng, 500, 2000), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'babyHighChair':
            return {
                price: roundTo(randomInRange(rng, 500, 1500), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'extraBed':
            return {
                price: roundTo(randomInRange(rng, 2000, 6000), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'securityDeposit': {
            const mult = randomInRange(rng, 1, 3);
            return {
                price: roundTo(mult * basePrice, 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: false,
                isIncluded: false
            };
        }
        case 'extraGuest': {
            const pct = Math.round(randomInRange(rng, 10, 25));
            return {
                price: pct,
                currency: 'ARS',
                isPercent: true,
                isPerNight: true,
                isPerGuest: true,
                isOptional: true
            };
        }
        case 'parking':
            return {
                price: roundTo(randomInRange(rng, 500, 3000), 500),
                currency: 'ARS',
                isPerNight: true
            };
        case 'lateCheckin':
            return {
                price: roundTo(randomInRange(rng, 500, 2000), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
        case 'luggageStorage':
            return {
                price: roundTo(randomInRange(rng, 500, 1500), 500),
                currency: 'ARS',
                isPerStay: true,
                isOptional: true
            };
    }
};

type DiscountField = 'weekly' | 'monthly' | 'lastMinute';
const DISCOUNT_FIELDS: readonly DiscountField[] = ['weekly', 'monthly', 'lastMinute'];

const buildDiscount = (field: DiscountField, rng: () => number): FeeEntry => {
    const pctRange: Record<DiscountField, [number, number]> = {
        weekly: [5, 15],
        monthly: [15, 30],
        lastMinute: [10, 20]
    };
    const [lo, hi] = pctRange[field];
    const pct = Math.round(randomInRange(rng, lo, hi));
    return { price: pct, currency: 'ARS', isPercent: true };
};

// Custom others[] pools (see pricing-tier-plan.md).
const CUSTOM_FEES: readonly {
    name: string;
    price: number;
    isPercent?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}[] = [
    { name: 'Servicio de asado', price: 4500 },
    { name: 'Alquiler de bicicletas', price: 2000, isPerNight: true, isPerGuest: true },
    { name: 'Traslado al aeropuerto', price: 8000 },
    { name: 'Excursión guiada al Palmar', price: 12000, isPerGuest: true },
    { name: 'Alquiler de equipo de pesca', price: 3500, isPerNight: true },
    { name: 'Servicio de mucama diario', price: 5, isPercent: true, isPerNight: true }
];
const CUSTOM_DISCOUNTS: readonly { name: string; price: number }[] = [
    { name: 'Huésped recurrente', price: 10 },
    { name: 'Grupo de 6 o más', price: 15 },
    { name: 'Temporada baja (mayo-agosto)', price: 20 },
    { name: 'Pago anticipado 30 días', price: 8 }
];

// ---------- Tier → price object ----------

type PriceObject = Record<string, unknown>;

const buildPriceForTier = (
    assignment: Assignment,
    namedFees: readonly NamedFee[]
): PriceObject | undefined => {
    if (assignment.tier === 0) return undefined;

    const rng = mulberry32(fnv1a32(`${assignment.id}|price`));
    const basePrice = randomBasePrice(assignment.type, rng);

    if (assignment.tier === 1) {
        return { price: basePrice, currency: 'ARS' };
    }

    if (assignment.tier === 2) {
        // 50/50 split decided by a stable per-id RNG. The same decision drives
        // planFeeCoverage so fee field slots are only allocated to entries that
        // will actually use them.
        if (t2UsesFees(assignment.id)) {
            const nFees = namedFees.length;
            const fees: Record<string, FeeEntry> = {};
            for (let i = 0; i < nFees; i += 1) {
                const f = namedFees[i] as NamedFee;
                fees[f] = buildFee(f, basePrice, rng);
            }
            return { price: basePrice, currency: 'ARS', additionalFees: fees };
        }
        const dField = DISCOUNT_FIELDS[Math.floor(rng() * DISCOUNT_FIELDS.length)] as DiscountField;
        return {
            price: basePrice,
            currency: 'ARS',
            discounts: { [dField]: buildDiscount(dField, rng) }
        };
    }

    // Tier 3: 3-5 named fees + 1-2 discounts. Field selection comes from
    // planFeeCoverage so the round-robin invariant holds; here we just
    // instantiate each pre-assigned field with its own fee shape.
    const fees: Record<string, unknown> = {};
    for (const f of namedFees) {
        fees[f] = buildFee(f, basePrice, rng);
    }
    const nDisc = 1 + Math.floor(rng() * 2);
    const discounts: Record<string, unknown> = {};
    const shuffledD = DISCOUNT_FIELDS.slice();
    for (let i = shuffledD.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [shuffledD[i], shuffledD[j]] = [
            shuffledD[j] as DiscountField,
            shuffledD[i] as DiscountField
        ];
    }
    for (let i = 0; i < nDisc; i += 1) {
        const d = shuffledD[i];
        if (!d) continue;
        discounts[d] = buildDiscount(d, rng);
    }
    return { price: basePrice, currency: 'ARS', additionalFees: fees, discounts };
};

// ---------- Coverage planner ----------

/**
 * Distribute the 15 named fee fields across all Tier 2 + Tier 3 entries so that
 * each field appears in ≥5 entries. We use a round-robin over fields, walking
 * the entries sorted by id, and giving each entry its share-of-fields starting
 * at a deterministic offset.
 */
// Stable per-id decision: does this Tier-2 entry use additionalFees (true) or
// a discount (false)? Used by both planFeeCoverage and buildPriceForTier so
// they agree on which entries actually consume named-fee field slots.
const t2UsesFees = (id: string): boolean => {
    const rng = mulberry32(fnv1a32(`${id}|t2-uses-fees`));
    return rng() < 0.5;
};

const planFeeCoverage = (assignments: readonly Assignment[]): Map<string, readonly NamedFee[]> => {
    const out = new Map<string, readonly NamedFee[]>();
    const t2 = assignments.filter((a) => a.tier === 2);
    const t3 = assignments.filter((a) => a.tier === 3);

    let cursor = 0;
    // Tier 2: assign fields only to entries that will actually USE fees.
    // Entries that take the discount branch get an empty fee list so the
    // round-robin cursor doesn't waste positions on them.
    for (const a of t2) {
        if (!t2UsesFees(a.id)) {
            out.set(a.id, []);
            continue;
        }
        const rng = mulberry32(fnv1a32(`${a.id}|fee-count`));
        const count = 1 + Math.floor(rng() * 2);
        const fields: NamedFee[] = [];
        for (let i = 0; i < count; i += 1) {
            fields.push(NAMED_FEES[(cursor + i) % NAMED_FEES.length] as NamedFee);
        }
        out.set(a.id, fields);
        cursor = (cursor + count) % NAMED_FEES.length;
    }
    // Tier 3: each gets 3-5 fields.
    for (const a of t3) {
        const rng = mulberry32(fnv1a32(`${a.id}|fee-count`));
        const count = 3 + Math.floor(rng() * 3);
        const fields: NamedFee[] = [];
        for (let i = 0; i < count; i += 1) {
            fields.push(NAMED_FEES[(cursor + i) % NAMED_FEES.length] as NamedFee);
        }
        out.set(a.id, fields);
        cursor = (cursor + count) % NAMED_FEES.length;
    }
    return out;
};

/**
 * Pick the Tier 3 accommodations that get custom `others[]`.
 *   - First 3 Tier 3 entries (by id) get `additionalFees.others[]` (at least 1 entry each).
 *   - First 2 Tier 3 entries also get `discounts.others[]`.
 */
const planOthersCoverage = (
    assignments: readonly Assignment[]
): { feeOthers: Set<string>; discountOthers: Set<string> } => {
    const t3sorted = assignments
        .filter((a) => a.tier === 3)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const feeOthers = new Set<string>(t3sorted.slice(0, 3).map((a) => a.id));
    const discountOthers = new Set<string>(t3sorted.slice(0, 2).map((a) => a.id));
    return { feeOthers, discountOthers };
};

const injectOthers = (
    price: PriceObject,
    feeOthers: Set<string>,
    discountOthers: Set<string>,
    id: string
): PriceObject => {
    const rng = mulberry32(fnv1a32(`${id}|others`));
    if (feeOthers.has(id)) {
        const fees = (price.additionalFees as Record<string, unknown>) ?? {};
        const pick = CUSTOM_FEES[Math.floor(rng() * CUSTOM_FEES.length)];
        const otherEntry = pick ? { ...pick, currency: 'ARS', isOptional: true } : null;
        if (otherEntry) {
            (fees as Record<string, unknown>).others = [otherEntry];
            price.additionalFees = fees;
        }
    }
    if (discountOthers.has(id)) {
        const discs = (price.discounts as Record<string, unknown>) ?? {};
        const pick = CUSTOM_DISCOUNTS[Math.floor(rng() * CUSTOM_DISCOUNTS.length)];
        const otherEntry = pick ? { ...pick, currency: 'ARS', isPercent: true } : null;
        if (otherEntry) {
            (discs as Record<string, unknown>).others = [otherEntry];
            price.discounts = discs;
        }
    }
    return price;
};

// ---------- CLI ----------

type CliOptions = { tiers: ReadonlySet<Tier>; dryRun: boolean };

const parseCli = (argv: readonly string[]): CliOptions => {
    const tiers = new Set<Tier>();
    let dryRun = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (a === '--tier') {
            const v = argv[i + 1];
            i += 1;
            if (!v) throw new Error('--tier requires a value');
            const n = Number.parseInt(v, 10);
            if (n < 0 || n > 3) throw new Error(`Invalid tier: ${v}`);
            tiers.add(n as Tier);
            continue;
        }
        throw new Error(`Unknown CLI arg: ${a}`);
    }
    if (tiers.size === 0) {
        return { tiers: new Set<Tier>([0, 1, 2, 3]), dryRun };
    }
    return { tiers, dryRun };
};

const listAccommodations = (): AccommodationMeta[] => {
    const out: AccommodationMeta[] = [];
    for (const dest of readdirSync(DATA_DIR, { withFileTypes: true })) {
        if (!dest.isDirectory()) continue;
        if (dest.name.startsWith('_')) continue;
        const folder = join(DATA_DIR, dest.name);
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const file = join(folder, entry.name);
            const json = JSON.parse(readFileSync(file, 'utf8')) as { id: string; type: string };
            out.push({ file, id: json.id, type: json.type, destination: dest.name });
        }
    }
    return out;
};

const main = (): void => {
    const opts = parseCli(process.argv.slice(2));
    const accommodations = listAccommodations();
    const assignments = assignTiers(accommodations);
    const feeFieldPlan = planFeeCoverage(assignments);
    const othersPlan = planOthersCoverage(assignments);

    const tally: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let written = 0;

    for (const a of assignments) {
        if (!opts.tiers.has(a.tier)) continue;
        tally[a.tier] += 1;

        const raw = readFileSync(a.file, 'utf8');
        const json = JSON.parse(raw) as Record<string, unknown>;
        const namedFees = feeFieldPlan.get(a.id) ?? [];
        let price = buildPriceForTier(a, namedFees);
        if (price && a.tier === 3) {
            price = injectOthers(price, othersPlan.feeOthers, othersPlan.discountOthers, a.id);
        }
        // For Tier 0 (no price), assigning undefined makes JSON.stringify omit the key,
        // matching the behavior we want without using `delete`.
        json.price = price;
        if (!opts.dryRun) {
            writeFileSync(a.file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
            written += 1;
        }
    }

    console.log(`Tier counts touched: T0=${tally[0]} T1=${tally[1]} T2=${tally[2]} T3=${tally[3]}`);
    console.log(`Selected tiers: ${[...opts.tiers].sort().join(', ')}`);
    if (opts.dryRun) {
        console.log('--- DRY RUN: no files written ---');
        // Print one sample per tier so we can eyeball.
        const seen = new Set<Tier>();
        for (const a of assignments) {
            if (!opts.tiers.has(a.tier) || seen.has(a.tier)) continue;
            seen.add(a.tier);
            const namedFees = feeFieldPlan.get(a.id) ?? [];
            let price = buildPriceForTier(a, namedFees);
            if (price && a.tier === 3) {
                price = injectOthers(price, othersPlan.feeOthers, othersPlan.discountOthers, a.id);
            }
            console.log(`\nSample Tier ${a.tier} — ${a.id}`);
            console.log(JSON.stringify({ price }, null, 2));
        }
    } else {
        console.log(`Wrote ${written} files.`);
    }
};

main();
