import { describe, expect, it } from 'bun:test';
import { worktreesWithServers } from '../src/lib/context.ts';
import {
    type DbConfig,
    databaseFor,
    parseWorktreePorcelain,
    type WorktreeEnv
} from '../src/lib/worktree.ts';

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
        detached: false,
        database: 'worktree_hospeda_hos_1_thing',
        servers: [],
        ...overrides
    };
}

describe('parseWorktreePorcelain', () => {
    const PORCELAIN = [
        'worktree /home/dev/hospeda2',
        'HEAD abc123',
        'branch refs/heads/staging',
        '',
        'worktree /home/dev/hospeda-hos-1-thing',
        'HEAD def456',
        'branch refs/heads/feat/HOS-1-thing',
        '',
        'worktree /home/dev/hospeda-suelto',
        'HEAD 999aaa',
        'detached',
        ''
    ].join('\n');

    it('should read the branch git already prints, without the refs prefix', () => {
        // This is the fix for the real bug: the branch used to come from an
        // OPTIONAL state file, so a worktree created by hand had none and the
        // placeholder reached `gh pr list --head '(desconocida)'`.
        expect(parseWorktreePorcelain({ stdout: PORCELAIN }).map((w) => w.branch)).toEqual([
            'staging',
            'feat/HOS-1-thing',
            ''
        ]);
    });

    it('should mark a detached HEAD instead of naming a branch that is not one', () => {
        const parsed = parseWorktreePorcelain({ stdout: PORCELAIN });

        expect(parsed.map((w) => w.detached)).toEqual([false, false, true]);
    });

    it('should attribute each branch to its own record', () => {
        // Filtering lines instead of splitting records is how a branch ends up
        // credited to the wrong worktree.
        const parsed = parseWorktreePorcelain({ stdout: PORCELAIN });

        expect(parsed.map((w) => [w.path, w.branch])).toEqual([
            ['/home/dev/hospeda2', 'staging'],
            ['/home/dev/hospeda-hos-1-thing', 'feat/HOS-1-thing'],
            ['/home/dev/hospeda-suelto', '']
        ]);
    });

    it('should not carry a branch over into a record that has none', () => {
        const parsed = parseWorktreePorcelain({
            stdout: 'worktree /a\nbranch refs/heads/uno\n\nworktree /b\nHEAD zzz\n'
        });

        expect(parsed.map((w) => w.branch)).toEqual(['uno', '']);
    });

    it('should survive output with no trailing blank line', () => {
        expect(
            parseWorktreePorcelain({ stdout: 'worktree /a\nHEAD z\nbranch refs/heads/solo' })
        ).toEqual([{ path: '/a', branch: 'solo', detached: false }]);
    });

    it('should return nothing for empty output rather than a phantom worktree', () => {
        expect(parseWorktreePorcelain({ stdout: '' })).toEqual([]);
    });
});

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
