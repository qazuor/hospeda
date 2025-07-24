import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Entity name to folder path mapping
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
    eventOrganizers: 'eventOrganizer',
    eventLocations: 'eventLocation',
    bookmarks: 'bookmark'
};

/**
 * Validates that files listed in the manifest exist in the folder,
 * and that there are no orphaned JSON files in the folder not declared in the manifest.
 *
 * @param entityName - Entity name to validate
 * @param declaredFiles - List of files declared in the manifest
 * @param type - Manifest type ('required' or 'example')
 */
export async function validateManifestVsFolder(
    entityName: string,
    declaredFiles: string[],
    type: 'required' | 'example'
): Promise<void> {
    // Determine folder path and whether to use recursive search
    const isRecursive = ['accommodations', 'attractions', 'events', 'posts'].includes(entityName);
    const folderName = ENTITY_FOLDER_MAP[entityName] || entityName;

    let folderPath: string;
    if (type === 'required') {
        // For required, some folders have specific subfolders
        if (entityName === 'users') {
            folderPath = path.resolve(`src/data/${folderName}/required`);
        } else {
            folderPath = path.resolve(`src/data/${folderName}`);
        }
    } else {
        // For example, some folders have specific subfolders
        if (entityName === 'users') {
            folderPath = path.resolve(`src/data/${folderName}/example`);
        } else {
            folderPath = path.resolve(`src/data/${folderName}`);
        }
    }

    const fullDeclared = new Set(declaredFiles);

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
