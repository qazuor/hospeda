import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadJsonFiles<T = unknown>(
    folderPath: string,
    files: string[]
): Promise<T[]> {
    const results: T[] = [];

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        results.push(JSON.parse(content));
    }

    return results;
}
