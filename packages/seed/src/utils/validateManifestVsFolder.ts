import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Mapeo de nombres de entidades a rutas de folders
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
 * Valida que los archivos listados en el manifest existan en el folder,
 * y que no haya archivos JSON huérfanos en el folder no declarados en el manifest.
 *
 * @param entityName - Nombre de la entidad para validar
 * @param declaredFiles - Lista de archivos declarados en el manifest
 * @param type - Tipo de manifest ('required' o 'example')
 */
export async function validateManifestVsFolder(
    entityName: string,
    declaredFiles: string[],
    type: 'required' | 'example'
): Promise<void> {
    // Determinar la ruta del folder y si usar búsqueda recursiva
    const isRecursive = ['accommodations', 'attractions', 'events', 'posts'].includes(entityName);
    const folderName = ENTITY_FOLDER_MAP[entityName] || entityName;

    let folderPath: string;
    if (type === 'required') {
        // Para required, algunos folders tienen subfolders específicos
        if (entityName === 'users') {
            folderPath = path.resolve(`src/data/${folderName}/required`);
        } else {
            folderPath = path.resolve(`src/data/${folderName}`);
        }
    } else {
        // Para example, algunos folders tienen subfolders específicos
        if (entityName === 'users') {
            folderPath = path.resolve(`src/data/${folderName}/example`);
        } else {
            folderPath = path.resolve(`src/data/${folderName}`);
        }
    }

    const fullDeclared = new Set(declaredFiles);

    // Función para obtener todos los archivos JSON del folder
    const getJsonFiles = async (dir: string): Promise<string[]> => {
        if (!isRecursive) {
            const folderFiles = await fs.readdir(dir);
            return folderFiles.filter((f) => f.endsWith('.json'));
        }

        // Búsqueda recursiva
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
        throw new Error(`Archivos faltantes: ${missingFiles}`);
    }

    if (orphaned.length > 0) {
        // Solo lanzar error si hay archivos huérfanos en required
        if (type === 'required') {
            const orphanedFiles = orphaned.slice(0, 3).join(', ');
            const moreText = orphaned.length > 3 ? ` y ${orphaned.length - 3} más` : '';
            throw new Error(`Archivos no declarados: ${orphanedFiles}${moreText}`);
        }
    }
}
