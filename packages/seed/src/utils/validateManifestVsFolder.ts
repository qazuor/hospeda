import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

/**
 * Valida que los archivos listados en el manifest existan en el folder,
 * y que no haya archivos JSON huérfanos en el folder no declarados en el manifest.
 *
 * @param folderPath - Ruta del folder a validar
 * @param declaredFiles - Lista de archivos declarados en el manifest
 * @param entityName - Nombre de la entidad para logging
 * @param continueOnError - Si continuar en caso de error
 * @param recursive - Si buscar recursivamente en subfolders
 */
export async function validateManifestVsFolder(
    folderPath: string,
    declaredFiles: string[],
    entityName: string,
    continueOnError = false,
    recursive = false
): Promise<void> {
    const fullDeclared = new Set(declaredFiles);

    // Debug logging
    logger.dim(`🔍 Validando ${entityName} en ${folderPath} (recursive: ${recursive})`);

    // Función para obtener todos los archivos JSON del folder
    const getJsonFiles = async (dir: string): Promise<string[]> => {
        if (!recursive) {
            const folderFiles = await fs.readdir(dir);
            const jsonFiles = folderFiles.filter((f) => f.endsWith('.json'));
            logger.dim(`📁 Búsqueda plana: encontré ${jsonFiles.length} archivos JSON`);
            return jsonFiles;
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
        logger.dim(`📁 Búsqueda recursiva: encontré ${allFiles.length} archivos JSON`);
        if (allFiles.length > 0) {
            logger.dim(`📁 Primeros archivos encontrados: ${allFiles.slice(0, 3).join(', ')}`);
        }
        return allFiles;
    };

    const jsonFiles = await getJsonFiles(folderPath);

    const missing = declaredFiles.filter((f) => !jsonFiles.includes(f));
    const orphaned = jsonFiles.filter((f) => !fullDeclared.has(f));

    if (missing.length > 0) {
        for (const file of missing) {
            logger.error(
                `❌ ${entityName}: el archivo declarado '${file}' no existe en ${folderPath}`
            );
        }
        if (!continueOnError) {
            throw new Error(
                `Faltan archivos declarados en ${entityName}. Corrige el manifest o el folder.`
            );
        }
    }

    if (orphaned.length > 0) {
        logger.warn(`⚠️ Archivos no declarados en manifest para '${entityName}':`);
        for (const file of orphaned) {
            logger.dim(`- ${file}`);
        }
    }
}
