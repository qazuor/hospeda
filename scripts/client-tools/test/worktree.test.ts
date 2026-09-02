import { describe, expect, it } from 'bun:test';
import { worktreesWithServers } from '../src/lib/context.ts';
import { type DbConfig, databaseFor, type WorktreeEnv } from '../src/lib/worktree.ts';

const DB_CONFIG: DbConfig = {
    devDb: 'hospeda_dev',
    templateDb: 'hospeda_template',
    container: 'hospeda-postgres',
    user: 'hospeda_user',
    connStringTemplate: 'postgresql://u:p@localhost:5436/{dbname}',
    connStringEnvVar: 'HOSPEDA_DATABASE_URL'
};

/** Builds a worktree with sane defaults. */
function makeWorktree(overrides: Partial<WorktreeEnv> = {}): WorktreeEnv {
    return {
        name: 'hospeda-hos-1-thing',
        path: '/home/dev/hospeda-hos-1-thing',
        isMain: false,
        branch: 'feat/HOS-1-thing',
        database: 'worktree_hospeda_hos_1_thing',
        servers: [],
        ...overrides
    };
}

describe('databaseFor', () => {
    it('should give the main clone the shared development database', () => {
        const worktree = makeWorktree({ name: 'hospeda2', isMain: true, database: null });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBe('hospeda_dev');
    });

    it('should ignore a stale db recorded on the main clone', () => {
        // The main clone has no per-worktree database. If one ever got written
        // into its state file, using it would point migrations somewhere else.
        const worktree = makeWorktree({ isMain: true, database: 'worktree_bogus' });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBe('hospeda_dev');
    });

    it('should give a worktree the database recorded in its state', () => {
        expect(databaseFor({ worktree: makeWorktree(), dbConfig: DB_CONFIG })).toBe(
            'worktree_hospeda_hos_1_thing'
        );
    });

    it('should return null for a worktree with no database yet', () => {
        const worktree = makeWorktree({ database: null });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBeNull();
    });

    it('should not invent a database when the project config is missing', () => {
        const worktree = makeWorktree({ isMain: true, database: null });

        expect(databaseFor({ worktree, dbConfig: null })).toBeNull();
    });
});

describe('worktreesWithServers', () => {
    it('should list only the worktrees actually running something', () => {
        // This is what stops `db-stop` from silently killing six environments.
        const all = [
            makeWorktree({ name: 'idle' }),
            makeWorktree({
                name: 'busy',
                servers: [{ name: 'api', port: 3101, pid: 10 }]
            })
        ];

        const found = worktreesWithServers({
            context: {
                target: 'local',
                repoRoot: '/repo',
                worktree: null,
                all,
                dbConfig: DB_CONFIG,
                database: null,
                requestedWorktree: null
            }
        });

        expect(found.map((worktree) => worktree.name)).toEqual(['busy']);
    });

    it('should return nothing when every worktree is stopped', () => {
        const found = worktreesWithServers({
            context: {
                target: 'local',
                repoRoot: '/repo',
                worktree: null,
                all: [makeWorktree(), makeWorktree({ name: 'otro' })],
                dbConfig: DB_CONFIG,
                database: null,
                requestedWorktree: null
            }
        });

        expect(found).toEqual([]);
    });
});
