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
 * nine models below (the eight first chosen, plus attractions added the same
 * day).
 *
 * Adding a model to (or removing one from) that set changes what a restore
 * does to real rows, so it must be a deliberate edit of this list, not a
 * side effect of copying or subclassing a model.
 *
 * ## How
 *
 * 1. Runtime: every class exported by the models barrel
 *    (`src/models/index.ts`) that extends `BaseModelImpl` is instantiated (no
 *    DB) and its effective `restoreKeepsLifecycleState` is read. The set that
 *    reads `true` must equal the frozen list. Reading the live value catches
 *    any spelling of the override (`= true`, `: boolean = true`, a computed
 *    expression) and a subclass that inherits the flag from an opted-in model.
 * 2. Runtime: each frozen model's table really has `lifecycleState` and
 *    `deletedAt`, otherwise the flag would be dead code.
 * 3. Static: across `packages/<pkg>/src` and `apps/<app>/src`, the only files
 *    that mention `restoreKeepsLifecycleState` are `base.model.ts` and the
 *    frozen models' own files. This catches a flag set on a model outside
 *    `packages/db/src/models` or on one the barrel does not export.
 *
 * ## Blind spots
 *
 * - A subclass of an opted-in model that does NOT mention the flag (so it
 *   escapes check 3) AND is not exported by the models barrel (so it escapes
 *   check 1) inherits `true` unseen. No such subclass exists today: no class
 *   outside `packages/db/src/models` extends a concrete model.
 * - The flag is read through a cast, because it is `protected`. Renaming it
 *   without updating this file makes check 1 read `undefined` for every model,
 *   so the frozen list no longer matches and the guard goes red.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BaseModelImpl } from '../../src/base/base.model';
import * as models from '../../src/models';

const REPO_ROOT = resolve(__dirname, '../../../..');
const FLAG = 'restoreKeepsLifecycleState';

/**
 * Frozen set (owner decision 2026-11-19, HOS-2366): class name → the file
 * that declares it, relative to the repo root. Keep sorted by class name.
 */
const KEEPS_LIFECYCLE_ON_RESTORE: Readonly<Record<string, string>> = {
    AmenityModel: 'packages/db/src/models/accommodation/amenity.model.ts',
    AttractionModel: 'packages/db/src/models/destination/attraction.model.ts',
    FeatureModel: 'packages/db/src/models/accommodation/feature.model.ts',
    HostTradeCategoryGroupModel:
        'packages/db/src/models/hostTrade/host-trade-category-group.model.ts',
    HostTradeCategoryModel: 'packages/db/src/models/hostTrade/host-trade-category.model.ts',
    PartnerTypeModel: 'packages/db/src/models/partner/partner-type.model.ts',
    PoiCategoryModel: 'packages/db/src/models/destination/poi-category.model.ts',
    PostTagModel: 'packages/db/src/models/tag/post-tag.model.ts',
    TagModel: 'packages/db/src/models/tag/tag.model.ts'
};
const FROZEN_NAMES = Object.keys(KEEPS_LIFECYCLE_ON_RESTORE).sort();

/** What the guard reads off an instance (the flag is `protected`). */
interface FlagView {
    readonly restoreKeepsLifecycleState?: unknown;
    getTable(): object;
}

type ModelClass = new () => BaseModelImpl<Record<string, unknown>>;

/** Every concrete `BaseModelImpl` subclass exported by the models barrel, by class name. */
function exportedModelClasses(): ReadonlyMap<string, ModelClass> {
    const found = new Map<string, ModelClass>();
    for (const value of Object.values(models)) {
        if (typeof value !== 'function') continue;
        if (!(value.prototype instanceof BaseModelImpl)) continue;
        found.set(value.name, value as unknown as ModelClass);
    }
    return found;
}

/** Recursively lists every `.ts`/`.tsx` file under `dir` (skipping build output). */
function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        if (entry === 'node_modules' || entry === 'dist') return [];
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listSourceFiles(full);
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}

/** `src` directories of every package and app in the monorepo. */
function workspaceSrcDirs(): string[] {
    return ['packages', 'apps'].flatMap((group) => {
        const groupDir = join(REPO_ROOT, group);
        return readdirSync(groupDir)
            .map((name) => join(groupDir, name, 'src'))
            .filter((dir) => {
                try {
                    return statSync(dir).isDirectory();
                } catch {
                    return false;
                }
            });
    });
}

describe('restoreKeepsLifecycleState guard (HOS-2366)', () => {
    const classes = exportedModelClasses();

    it('the barrel exposes the models this guard instantiates', () => {
        // A broken barrel import would leave nothing to check and pass vacuously.
        expect(classes.size).toBeGreaterThan(50);
    });

    it('only the frozen admin catalogs keep lifecycleState on restore (runtime value)', () => {
        const flagged: string[] = [];
        const failedToInstantiate: string[] = [];
        for (const [name, ModelCtor] of classes) {
            let instance: FlagView;
            try {
                instance = new ModelCtor() as unknown as FlagView;
            } catch {
                failedToInstantiate.push(name);
                continue;
            }
            if (instance.restoreKeepsLifecycleState === true) flagged.push(name);
        }

        expect(failedToInstantiate).toEqual([]);
        expect(flagged.sort()).toEqual(FROZEN_NAMES);
    });

    it.each(
        FROZEN_NAMES
    )('%s is exported, has the flag live and a table with lifecycleState + deletedAt', (name) => {
        const ModelCtor = classes.get(name);
        expect(ModelCtor).toBeDefined();
        const model = new (ModelCtor as ModelClass)() as unknown as FlagView;

        expect(model.restoreKeepsLifecycleState).toBe(true);
        const table = model.getTable();
        expect('lifecycleState' in table).toBe(true);
        expect('deletedAt' in table).toBe(true);
    });

    it('no file outside base.model.ts and the frozen models mentions the flag (static scan)', () => {
        const allowed = new Set([
            'packages/db/src/base/base.model.ts',
            ...Object.values(KEEPS_LIFECYCLE_ON_RESTORE)
        ]);
        const mentions = workspaceSrcDirs()
            .flatMap(listSourceFiles)
            .filter((file) => readFileSync(file, 'utf8').includes(FLAG))
            .map((file) => relative(REPO_ROOT, file))
            .sort();

        expect(mentions).toEqual([...allowed].sort());
    });
});
