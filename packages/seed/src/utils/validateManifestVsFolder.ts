import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM equivalent of __dirname for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_DATA_BASE = path.resolve(__dirname, '../data');

/**
 * Entity name to folder path mapping.
 *
 * Note (HOS-142): `pointsOfInterest` (the 12-fixture `--required` group) and
 * `pointOfInterestCatalog` (the 914-fixture `--poi-catalog` group) BOTH map to
 * the same physical `pointOfInterest` folder — the 926 fixtures live side by
 * side, split only by which manifest key declares which filenames. See
 * {@link buildFolderDeclaredFiles} for how orphan-detection accounts for a
 * folder declared by more than one manifest entity.
 */
const ENTITY_FOLDER_MAP: Record<string, string> = {
    users: 'user',
    destinations: 'destination',
    amenities: 'amenity',
    features: 'feature',
    attractions: 'attraction',
    accommodations: 'accommodation',
    tags: 'tag',
    posts: 'post',
    events: 'event',
    accommodationReviews: 'accommodationReview',
    destinationReviews: 'destinationReview',
    postSponsorships: 'postSponsorship',
    postSponsors: 'postSponsor',
    partners: 'partner',
    eventOrganizers: 'eventOrganizer',
    eventLocations: 'eventLocation',
    userBookmarkCollections: 'userBookmarkCollection',
    bookmarks: 'bookmark',
    sponsorshipLevels: 'sponsorshipLevel',
    sponsorshipPackages: 'sponsorshipPackage',
    rolePermissions: 'rolePermission',
    exchangeRates: 'exchangeRate',
    exchangeRateConfig: 'exchangeRateConfig',
    hostTrades: 'hostTrade',
    gastronomies: 'gastronomy',
    gastronomyFaqs: 'gastronomy/faqs',
    gastronomyReviews: 'gastronomy/reviews',
    pointsOfInterest: 'pointOfInterest',
    pointOfInterestCatalog: 'pointOfInterest',
    poiCategories: 'poiCategory'
};

/**
 * Resolves the physical folder name a given manifest entity reads from.
 *
 * @param entityName - Manifest key (e.g. `pointsOfInterest`)
 * @returns The folder name under `src/data/` (falls back to `entityName` when
 *   no explicit mapping exists, matching {@link validateManifestVsFolder}'s
 *   own inline fallback).
 */
export function resolveEntityFolderName(entityName: string): string {
    return ENTITY_FOLDER_MAP[entityName] ?? entityName;
}

/**
 * Builds, for every folder shared by one or more manifest entities, the
 * COMBINED set of every filename declared across all of them.
 *
 * Needed because more than one manifest entity can point at the same
 * physical folder (HOS-142: `pointsOfInterest` + `pointOfInterestCatalog`
 * both read `src/data/pointOfInterest/`). Without this, validating either
 * entity in isolation against the full folder listing would flag every file
 * declared by the OTHER entity as an "orphaned" (undeclared) file, even
 * though it is legitimately declared — just under a sibling manifest key.
 *
 * @param manifest - A full manifest object (e.g. the parsed
 *   `manifest-required.json`), entity name -> declared file list.
 * @returns A map of folder name -> the union of every file declared by any
 *   entity resolving to that folder.
 */
export function buildFolderDeclaredFiles(
    manifest: Record<string, string[]>
): Map<string, Set<string>> {
    const folderDeclaredFiles = new Map<string, Set<string>>();
    for (const [entityName, files] of Object.entries(manifest)) {
        const folderName = resolveEntityFolderName(entityName);
        const existing = folderDeclaredFiles.get(folderName) ?? new Set<string>();
        for (const file of files) {
            existing.add(file);
        }
        folderDeclaredFiles.set(folderName, existing);
    }
    return folderDeclaredFiles;
}

/**
 * Validates that files listed in the manifest exist in the folder,
 * and that there are no orphaned JSON files in the folder not declared in the manifest.
 *
 * @param entityName - Entity name to validate
 * @param declaredFiles - List of files declared in the manifest for THIS entity
 *   (used for the "missing" check — every one of these must exist on disk).
 * @param type - Manifest type ('required' or 'example')
 * @param folderDeclaredFiles - The full set of files declared by EVERY manifest
 *   entity that resolves to this same physical folder (used for the "orphaned"
 *   check). Defaults to `declaredFiles` when omitted, preserving the original
 *   one-entity-per-folder behavior. Pass the combined set from
 *   {@link buildFolderDeclaredFiles} when a folder is shared by more than one
 *   manifest entity (HOS-142: `pointsOfInterest` + `pointOfInterestCatalog`).
 */
export async function validateManifestVsFolder(
    entityName: string,
    declaredFiles: string[],
    type: 'required' | 'example',
    folderDeclaredFiles?: string[]
): Promise<void> {
    // Skip validation for entities with no declared files
    if (declaredFiles.length === 0) {
        return;
    }

    // Determine folder path and whether to use recursive search
    const isRecursive = ['accommodations', 'attractions', 'events', 'posts'].includes(entityName);
    const folderName = ENTITY_FOLDER_MAP[entityName] || entityName;

    let folderPath: string;
    if (type === 'required') {
        // For required, some folders have specific subfolders
        if (entityName === 'users') {
            folderPath = path.resolve(SEED_DATA_BASE, `${folderName}/required`);
        } else {
            folderPath = path.resolve(SEED_DATA_BASE, folderName);
        }
    } else {
        // For example, some folders have specific subfolders
        if (entityName === 'users') {
            folderPath = path.resolve(SEED_DATA_BASE, `${folderName}/example`);
        } else {
            folderPath = path.resolve(SEED_DATA_BASE, folderName);
        }
    }

    const fullDeclared = new Set(folderDeclaredFiles ?? declaredFiles);

    // Function to get all JSON files from the folder
    const getJsonFiles = async (dir: string): Promise<string[]> => {
        if (!isRecursive) {
            const folderFiles = await fs.readdir(dir);
            return folderFiles.filter((f) => f.endsWith('.json'));
        }

        // Recursive search
        const allFiles: string[] = [];
        const scanDirectory = async (currentDir: string, baseDir: string) => {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relativePath = path.relative(baseDir, fullPath);

                if (entry.isDirectory()) {
                    await scanDirectory(fullPath, baseDir);
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    allFiles.push(relativePath);
                }
            }
        };

        await scanDirectory(dir, dir);
        return allFiles;
    };

    const jsonFiles = await getJsonFiles(folderPath);

    const missing = declaredFiles.filter((f) => !jsonFiles.includes(f));
    const orphaned = jsonFiles.filter((f) => !fullDeclared.has(f));

    if (missing.length > 0) {
        const missingFiles = missing.join(', ');
        throw new Error(`Missing files: ${missingFiles}`);
    }

    if (orphaned.length > 0) {
        // Only throw error if there are orphaned files in required
        if (type === 'required') {
            const orphanedFiles = orphaned.slice(0, 3).join(', ');
            const moreText = orphaned.length > 3 ? ` and ${orphaned.length - 3} more` : '';
            throw new Error(`Undeclared files: ${orphanedFiles}${moreText}`);
        }
    }
}
