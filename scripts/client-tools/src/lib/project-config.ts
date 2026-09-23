import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Safe, non-secret project adapter fields consumed by generic commands. */
export interface ProjectAdapter {
    readonly projectId?: string;
    readonly adapter?: string;
    readonly issues?: { readonly teamKey?: string };
    readonly branches?: {
        readonly base?: string;
        readonly protected?: readonly string[];
        readonly promotion?: readonly string[];
    };
}

/** Reads the declarative adapter without exposing or parsing secret values. */
export async function loadProjectAdapter(repoRoot: string): Promise<ProjectAdapter | null> {
    try {
        const value = JSON.parse(
            await readFile(join(repoRoot, '.qz/project.json'), 'utf8')
        ) as ProjectAdapter;
        return value && typeof value === 'object' ? value : null;
    } catch {
        return null;
    }
}
