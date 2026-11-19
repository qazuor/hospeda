/**
 * Guard: the set of models whose `restore()` KEEPS `lifecycleState` is frozen
 * (HOS-2366).
 *
 * ## Why this exists
 *
 * `BaseModelImpl.restore()` resets `lifecycleState` to `ACTIVE` by default
 * (SPEC-063-gaps T-001 / GAP-063-022): content such as sponsorships, owner
 * promotions and reviews must come back visible after a restore, or the admin
 * sees "restored" while the row stays hidden from the public tier.
 *
 * The admin catalogs are the opposite case. An admin deactivates a catalog row
 * on purpose (it stops being assignable), and a delete + restore must not undo
 * that decision (HOS-2366, AC-3.5 of HOS-2336). Those models set
 * `restoreKeepsLifecycleState = true`. Owner decision 2026-11-19: exactly the
 * eight models below.
 *
 * Adding a model to (or removing one from) that set changes what a restore
 * does to real rows, so it must be a deliberate edit of this list, not a
 * side effect of copying a model file.
 *
 * ## How
 *
 * 1. A static scan of `packages/db/src/models/**` finds every class that sets
 *    the flag to `true` and compares it with the frozen list.
 * 2. Each listed model is instantiated (no DB) to prove the flag is live at
 *    runtime and that its table really has both `lifecycleState` and
 *    `deletedAt` — otherwise the flag would be dead code.
 *
 * Blind spot: a model that sets the flag through a computed expression rather
 * than the literal `restoreKeepsLifecycleState = true` escapes step 1.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BaseModelImpl } from '../../src/base/base.model';
import { AmenityModel } from '../../src/models/accommodation/amenity.model';
import { FeatureModel } from '../../src/models/accommodation/feature.model';
import { PoiCategoryModel } from '../../src/models/destination/poi-category.model';
import { HostTradeCategoryModel } from '../../src/models/hostTrade/host-trade-category.model';
import { HostTradeCategoryGroupModel } from '../../src/models/hostTrade/host-trade-category-group.model';
import { PartnerTypeModel } from '../../src/models/partner/partner-type.model';
import { PostTagModel } from '../../src/models/tag/post-tag.model';
import { TagModel } from '../../src/models/tag/tag.model';

const MODELS_DIR = resolve(__dirname, '../../src/models');

/** Frozen set (owner decision 2026-11-19, HOS-2366). Keep sorted. */
const KEEPS_LIFECYCLE_ON_RESTORE = [
    'AmenityModel',
    'FeatureModel',
    'HostTradeCategoryGroupModel',
    'HostTradeCategoryModel',
    'PartnerTypeModel',
    'PoiCategoryModel',
    'PostTagModel',
    'TagModel'
] as const;

const INSTANCES: Readonly<Record<string, () => BaseModelImpl<Record<string, unknown>>>> = {
    AmenityModel: () => new AmenityModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    FeatureModel: () => new FeatureModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    HostTradeCategoryGroupModel: () =>
        new HostTradeCategoryGroupModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    HostTradeCategoryModel: () =>
        new HostTradeCategoryModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    PartnerTypeModel: () =>
        new PartnerTypeModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    PoiCategoryModel: () =>
        new PoiCategoryModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    PostTagModel: () => new PostTagModel() as unknown as BaseModelImpl<Record<string, unknown>>,
    TagModel: () => new TagModel() as unknown as BaseModelImpl<Record<string, unknown>>
};

/** Recursively lists every `.ts` file under `dir`. */
function listTsFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listTsFiles(full);
        return full.endsWith('.ts') ? [full] : [];
    });
}

/** Class names whose body sets `restoreKeepsLifecycleState = true`. */
function findFlaggedModels(): string[] {
    const flagged: string[] = [];
    for (const file of listTsFiles(MODELS_DIR)) {
        const source = readFileSync(file, 'utf8');
        const classRegex = /export\s+class\s+(\w+)\s+extends\s+BaseModelImpl\b/g;
        const matches = [...source.matchAll(classRegex)];
        for (const [index, match] of matches.entries()) {
            const start = match.index ?? 0;
            const end = matches[index + 1]?.index ?? source.length;
            const body = source.slice(start, end);
            if (/\brestoreKeepsLifecycleState\s*=\s*true\b/.test(body) && match[1]) {
                flagged.push(match[1]);
            }
        }
    }
    return flagged.sort();
}

describe('restoreKeepsLifecycleState guard (HOS-2366)', () => {
    it('only the frozen admin catalogs keep lifecycleState on restore', () => {
        expect(findFlaggedModels()).toEqual([...KEEPS_LIFECYCLE_ON_RESTORE]);
    });

    it.each(
        KEEPS_LIFECYCLE_ON_RESTORE
    )('%s has the flag live and a table with lifecycleState + deletedAt', (name) => {
        const create = INSTANCES[name];
        expect(create).toBeDefined();
        const model = create?.() as unknown as {
            readonly restoreKeepsLifecycleState: boolean;
            getTable(): object;
        };

        expect(model.restoreKeepsLifecycleState).toBe(true);
        const table = model.getTable();
        expect('lifecycleState' in table).toBe(true);
        expect('deletedAt' in table).toBe(true);
    });
});
