/**
 * HOS-142 — regression coverage for the "one folder, multiple manifest
 * entities" case introduced by the `pointOfInterestCatalog` group, which
 * shares `src/data/pointOfInterest/` with the pre-existing `pointsOfInterest`
 * `--required` group.
 *
 * Before HOS-142, `validateManifestVsFolder`'s orphan-detection assumed
 * exactly one manifest entity per physical folder: it read every `.json` file
 * in the folder and flagged anything not in ITS OWN declared list as
 * "orphaned" (undeclared), throwing for `type: 'required'`. Adding the 914
 * `pointOfInterestCatalog` fixtures to the SAME `pointOfInterest` folder while
 * keeping `pointsOfInterest`'s manifest key at its pre-HOS-142 12 entries
 * would have made every validation run against either entity throw, since
 * each only recognizes its own subset of the shared folder's contents.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateAllManifests } from '../src/utils/validateAllManifests.js';
import {
    buildFolderDeclaredFiles,
    resolveEntityFolderName
} from '../src/utils/validateManifestVsFolder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../src');

describe('resolveEntityFolderName (HOS-142)', () => {
    it('resolves both pointsOfInterest and pointOfInterestCatalog to the same folder', () => {
        expect(resolveEntityFolderName('pointsOfInterest')).toBe('pointOfInterest');
        expect(resolveEntityFolderName('pointOfInterestCatalog')).toBe('pointOfInterest');
    });

    it('falls back to the entity name itself when no explicit mapping exists', () => {
        expect(resolveEntityFolderName('someUnmappedEntity')).toBe('someUnmappedEntity');
    });
});

describe('buildFolderDeclaredFiles (HOS-142)', () => {
    it('merges two manifest entities that resolve to the same folder into one combined set', () => {
        const manifest = {
            pointsOfInterest: ['001-a.json', '002-b.json'],
            pointOfInterestCatalog: ['013-c.json', '014-d.json'],
            poiCategories: ['001-cat.json']
        };

        const result = buildFolderDeclaredFiles(manifest);

        expect(result.get('pointOfInterest')).toEqual(
            new Set(['001-a.json', '002-b.json', '013-c.json', '014-d.json'])
        );
        expect(result.get('poiCategory')).toEqual(new Set(['001-cat.json']));
    });

    it('does not lose files when the same filename is declared by both entities (defensive de-dup)', () => {
        const manifest = {
            pointsOfInterest: ['001-a.json'],
            pointOfInterestCatalog: ['001-a.json']
        };
        const result = buildFolderDeclaredFiles(manifest);
        expect(result.get('pointOfInterest')).toEqual(new Set(['001-a.json']));
    });
});

describe('validateAllManifests end-to-end (HOS-142 regression)', () => {
    it('does not throw against the real manifest-required.json + src/data/pointOfInterest folder', async () => {
        await expect(validateAllManifests(false)).resolves.not.toThrow();
    });

    it('manifest-required.json declares pointOfInterestCatalog as a real (currently empty) key', () => {
        const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<
            string,
            string[]
        >;
        expect(manifest.pointOfInterestCatalog).toBeDefined();
        expect(Array.isArray(manifest.pointOfInterestCatalog)).toBe(true);
    });
});
