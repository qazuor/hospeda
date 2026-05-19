#!/usr/bin/env tsx
/**
 * SPEC-119 — Deterministic pricing tier planner.
 *
 * Reads all accommodation seed JSONs, assigns each to one of four realism tiers
 * (target distribution ~25% / 25% / 30% / 20%), and produces a CSV-style table
 * embedded in `packages/seed/docs/pricing-tier-plan.md` between the
 * <!-- TIER_ASSIGNMENT_BEGIN --> / <!-- TIER_ASSIGNMENT_END --> markers.
 *
 * Tier definitions:
 *   - Tier 0: no `price` key in the JSON (host did not publish a price)
 *   - Tier 1: `{ price, currency }` only
 *   - Tier 2: base + 1-2 `additionalFees` OR base + 1 discount
 *   - Tier 3: base + 3-5 fees + 1-2 discounts (with ≥1 custom `others[]` entry)
 *
 * Determinism: tier assignment is seeded by FNV-1a(id) so re-runs are stable.
 *
 * Anti-clustering constraints:
 *   - Every accommodation TYPE has at least one entry in each of the four tiers.
 *   - No DESTINATION has more than `ceil(0.30 × destinationSize)` Tier-0 entries.
 *
 * Usage:
 *   pnpm --filter @repo/seed exec tsx scripts/plan-pricing-tiers.ts [--dry-run]
 *
 * `--dry-run` prints the plan to stdout without modifying the markdown file.
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
    readonly name: string;
};

type Assignment = AccommodationMeta & { tier: Tier };

// Tier proportions per the spec (after the 25/25/30/20 amendment).
const TIER_PROPORTIONS: Record<Tier, number> = {
    0: 0.25,
    1: 0.25,
    2: 0.3,
    3: 0.2
} as const;

// FNV-1a 32-bit hash, identical to the one in refresh-accommodation-images.ts.
const fnv1a32 = (input: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'accommodation');
const PLAN_PATH = join(__dirname, '..', 'docs', 'pricing-tier-plan.md');

const loadAccommodations = (): AccommodationMeta[] => {
    const out: AccommodationMeta[] = [];
    for (const dest of readdirSync(DATA_DIR, { withFileTypes: true })) {
        if (!dest.isDirectory()) continue;
        if (dest.name.startsWith('_')) continue;
        const folder = join(DATA_DIR, dest.name);
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const file = join(folder, entry.name);
            const json = JSON.parse(readFileSync(file, 'utf8')) as {
                id: string;
                type: string;
                name: string;
            };
            out.push({
                file,
                id: json.id,
                type: json.type,
                destination: dest.name,
                name: json.name
            });
        }
    }
    return out;
};

/**
 * Compute initial tier assignment from the per-id hash.
 *
 * The hash output is mapped into the tier proportions: hash → [0,1) via x/2^32,
 * then bucketed by cumulative proportions. This gives a fast, deterministic
 * pre-pass that approximately matches the target distribution.
 */
const initialTier = (id: string): Tier => {
    const u = fnv1a32(id) / 0x100000000; // [0, 1)
    let acc = 0;
    for (const k of [0, 1, 2, 3] as const) {
        acc += TIER_PROPORTIONS[k];
        if (u < acc) return k;
    }
    return 3; // numerical safety
};

/**
 * Repair pass — adjust the initial assignments so:
 *   1. Every type has at least one entry in each tier.
 *   2. No destination exceeds ~30% Tier 0.
 *   3. Global counts land inside the spec's ±5% bands.
 *
 * The repair is greedy: it scans accommodations in deterministic id order and
 * promotes/demotes the minimum number needed to satisfy each constraint.
 */
const repair = (rows: Assignment[]): Assignment[] => {
    const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    // Constraint 1 — per-destination Tier 0 cap.
    const destCounts = new Map<string, number>();
    for (const r of sorted) {
        const arr = destCounts.get(r.destination) ?? 0;
        destCounts.set(r.destination, arr + 1);
    }
    const destCap: Record<string, number> = {};
    for (const [d, n] of destCounts) destCap[d] = Math.max(1, Math.ceil(0.3 * n));
    // Walk rows: if a row is Tier 0 and its destination is over cap, demote it.
    const destTier0 = new Map<string, number>();
    for (const r of sorted) {
        if (r.tier !== 0) continue;
        const used = destTier0.get(r.destination) ?? 0;
        const cap = destCap[r.destination] ?? 0;
        if (used >= cap) {
            r.tier = 1; // demote to base-only
        } else {
            destTier0.set(r.destination, used + 1);
        }
    }

    // Constraint 2 — every type must have at least one entry per tier.
    const typeTierMatrix = new Map<string, Set<Tier>>();
    for (const r of sorted) {
        if (!typeTierMatrix.has(r.type)) typeTierMatrix.set(r.type, new Set());
        (typeTierMatrix.get(r.type) as Set<Tier>).add(r.tier);
    }
    for (const [type, present] of typeTierMatrix) {
        for (const needed of [0, 1, 2, 3] as Tier[]) {
            if (present.has(needed)) continue;
            // Find a row of this type in the most-overrepresented tier and flip it.
            const counts = new Map<Tier, number>();
            for (const r of sorted) {
                if (r.type !== type) continue;
                counts.set(r.tier, (counts.get(r.tier) ?? 0) + 1);
            }
            // Pick the tier with the most members of this type (most "donor capacity").
            let donor: Tier = 0;
            let donorCount = -1;
            for (const [t, n] of counts) {
                if (n > donorCount) {
                    donor = t;
                    donorCount = n;
                }
            }
            // Find the donor row with the worst-match hash distance to the needed tier
            // (we pick the first one in id order for stable output).
            const candidate = sorted.find((r) => r.type === type && r.tier === donor);
            if (candidate && donor !== needed) {
                // Skip the destination-cap when promoting INTO Tier 0; cap was enforced earlier.
                if (needed === 0) {
                    const used = destTier0.get(candidate.destination) ?? 0;
                    const cap = destCap[candidate.destination] ?? 0;
                    if (used >= cap) {
                        // Find another candidate in a different destination.
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

    // Constraint 3 — global tier counts within ±5% of target.
    // After the destination cap demotes some Tier 0s into Tier 1, the global
    // Tier 0 count typically undershoots target. Promote Tier 1 → Tier 0 (then
    // Tier 2 → Tier 1, etc.) to refill toward target, respecting the per-dest cap.
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
    // Promote: pick a donor row from `donorTier` and reassign it to `targetTier`.
    // For promotions INTO Tier 0, respect the per-destination cap.
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
    // Up to total iterations as a safety bound.
    for (let pass = 0; pass < total; pass += 1) {
        const c = tally();
        let changed = false;
        // Refill the most-undershooting tier first, drawing from the most-overshooting tier.
        for (const t of [0, 1, 2, 3] as Tier[]) {
            if (c[t] >= target[t]) continue;
            // Find the most-overshooting tier ≠ t.
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
            if (donor === null) continue;
            if (promote(donor, t)) {
                changed = true;
                break;
            }
        }
        if (!changed) break;
    }

    return sorted;
};

const formatPlanMarkdown = (rows: readonly Assignment[]): string => {
    const lines: string[] = ['', '### Per-accommodation assignment', ''];
    lines.push('| ID | Type | Destination | Tier | Name |');
    lines.push('|---|---|---|---:|---|');
    for (const r of rows) {
        const idShort = r.id.length > 60 ? `${r.id.slice(0, 57)}...` : r.id;
        lines.push(`| \`${idShort}\` | ${r.type} | ${r.destination} | ${r.tier} | ${r.name} |`);
    }
    lines.push('');
    return lines.join('\n');
};

const summarize = (rows: readonly Assignment[]): string => {
    const total = rows.length;
    const counts: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const r of rows) counts[r.tier] += 1;
    const lines: string[] = ['', '### Distribution summary', ''];
    lines.push('| Tier | Count | Actual % | Target % |');
    lines.push('|---:|---:|---:|---:|');
    for (const t of [0, 1, 2, 3] as Tier[]) {
        const pct = ((counts[t] / total) * 100).toFixed(1);
        const target = (TIER_PROPORTIONS[t] * 100).toFixed(0);
        lines.push(`| ${t} | ${counts[t]} | ${pct}% | ${target}% |`);
    }
    lines.push('');
    // Per-type breakdown
    const byTypeTier = new Map<string, Record<Tier, number>>();
    for (const r of rows) {
        if (!byTypeTier.has(r.type)) byTypeTier.set(r.type, { 0: 0, 1: 0, 2: 0, 3: 0 });
        (byTypeTier.get(r.type) as Record<Tier, number>)[r.tier] += 1;
    }
    lines.push('### Per-type tier breakdown', '');
    lines.push('| Type | T0 | T1 | T2 | T3 | Total |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const [type, c] of [...byTypeTier].sort((a, b) => a[0].localeCompare(b[0]))) {
        const sum = c[0] + c[1] + c[2] + c[3];
        lines.push(`| ${type} | ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} | ${sum} |`);
    }
    lines.push('');
    return lines.join('\n');
};

const main = (): void => {
    const dryRun = process.argv.includes('--dry-run');
    const accommodations = loadAccommodations();
    const initial: Assignment[] = accommodations.map((m) => ({
        ...m,
        tier: initialTier(m.id)
    }));
    const repaired = repair(initial);

    const block = `${summarize(repaired)}${formatPlanMarkdown(repaired)}`;

    if (dryRun) {
        console.log(block);
        return;
    }

    const planRaw = readFileSync(PLAN_PATH, 'utf8');
    const startMarker = '<!-- TIER_ASSIGNMENT_BEGIN -->';
    const endMarker = '<!-- TIER_ASSIGNMENT_END -->';
    const startIdx = planRaw.indexOf(startMarker);
    const endIdx = planRaw.indexOf(endMarker);
    if (startIdx < 0 || endIdx < 0) {
        throw new Error('Plan markdown is missing the assignment markers.');
    }
    const head = planRaw.slice(0, startIdx + startMarker.length);
    const tail = planRaw.slice(endIdx);
    writeFileSync(PLAN_PATH, `${head}\n${block}\n${tail}`, 'utf8');
    console.log(`Wrote ${repaired.length} assignments to ${PLAN_PATH}.`);

    // Summary echo to stdout.
    const totalCounts: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const r of repaired) totalCounts[r.tier] += 1;
    console.log(
        `Distribution: T0=${totalCounts[0]} T1=${totalCounts[1]} T2=${totalCounts[2]} T3=${totalCounts[3]}`
    );
};

main();
