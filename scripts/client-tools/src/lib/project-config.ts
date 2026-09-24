import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Safe, non-secret project adapter fields consumed by generic commands. */
export interface ProjectDatabaseAdapter {
    readonly strategy?: string;
    readonly container?: string;
    readonly templateDatabase?: string;
    readonly databaseNamePattern?: string;
    readonly connectionEnvFile?: string;
    readonly connectionEnvVar?: string;
    readonly schemaFingerprintPaths?: readonly string[];
    readonly schemaSentinelTables?: readonly string[];
    readonly templateFingerprintPaths?: readonly string[];
}

export interface ProjectWorktreeAdapter {
    readonly pathPattern?: string;
    readonly envSource?: {
        readonly kind?: string;
        readonly checkoutName?: string;
        readonly relativePath?: string;
    };
    readonly install?: string;
    readonly build?: string;
}

export interface ProjectServerAdapter {
    readonly id?: string;
    readonly portEnv?: string;
    readonly defaultPort?: number;
    readonly start?: string;
    readonly healthPath?: string;
}

export interface ProjectAdapter {
    readonly projectId?: string;
    readonly adapter?: string;
    readonly issues?: {
        readonly provider?: string;
        readonly teamKey?: string;
        readonly identifierPattern?: string;
    };
    readonly branches?: {
        readonly base?: string;
        readonly protected?: readonly string[];
        readonly pattern?: string;
        readonly promotion?: readonly string[];
        readonly backMerge?: readonly { readonly from?: string; readonly to?: string }[];
    };
    readonly database?: ProjectDatabaseAdapter;
    readonly worktree?: ProjectWorktreeAdapter;
    readonly servers?: readonly ProjectServerAdapter[];
    readonly commands?: {
        readonly genericPrefix?: string;
        readonly projectPrefix?: string;
        readonly source?: string;
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
