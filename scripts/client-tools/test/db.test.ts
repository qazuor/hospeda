import { describe, expect, it } from 'bun:test';
import { connStringFor, dbJob, explainMissingDb } from '../src/commands/db/target-db.ts';
import type { RunContext } from '../src/lib/context.ts';
import type { DbConfig, WorktreeEnv } from '../src/lib/worktree.ts';

const DB_CONFIG: DbConfig = {
    devDb: 'hospeda_dev',
    templateDb: 'hospeda_template',
    container: 'hospeda-postgres',
    user: 'hospeda_user',
    connStringTemplate: 'postgresql://u:p@localhost:5436/{dbname}',
    connStringEnvVar: 'HOSPEDA_DATABASE_URL'
};

function makeWorktree(overrides: Partial<WorktreeEnv> = {}): WorktreeEnv {
    return {
        name: 'hospeda-hos-1-thing',
        path: '/home/dev/hospeda-hos-1-thing',
        isMain: false,
        branch: 'feat/HOS-1',
        detached: false,
        database: 'worktree_hospeda_hos_1_thing',
        servers: [],
        ...overrides
    };
}

function makeContext(overrides: Partial<RunContext> = {}): RunContext {
    const worktree = makeWorktree();
    return {
        target: 'local',
        repoRoot: '/home/dev/hospeda2',
        worktree,
        all: [worktree],
        dbConfig: DB_CONFIG,
        database: worktree.database,
        requestedWorktree: null,
        ...overrides
    };
}

describe('connStringFor', () => {
    it('should substitute the database into the template', () => {
        expect(
            connStringFor({ template: 'postgresql://u:p@h:5436/{dbname}', database: 'wt_x' })
        ).toBe('postgresql://u:p@h:5436/wt_x');
    });

    it('should refuse a template with no placeholder rather than return it unchanged', () => {
        // Returning it unchanged would connect every worktree to whatever
        // database the template happens to name.
        expect(
            connStringFor({ template: 'postgresql://u:p@h:5436/hospeda_dev', database: 'x' })
        ).toBeNull();
    });
});

describe('dbJob', () => {
    it('should point the connection variable at the target database', () => {
        const job = dbJob({ context: makeContext(), script: 'db:migrate' });

        expect(job?.env?.HOSPEDA_DATABASE_URL).toBe(
            'postgresql://u:p@localhost:5436/worktree_hospeda_hos_1_thing'
        );
    });

    it('should run from the worktree, not the main clone', () => {
        // Migrations and seeders come from ITS checkout — that is the whole
        // reason a worktree has its own database.
        const job = dbJob({ context: makeContext(), script: 'db:migrate' });

        expect(job?.cwd).toBe('/home/dev/hospeda-hos-1-thing');
    });

    it('should use the main clone database when standing there', () => {
        const main = makeWorktree({ name: 'hospeda2', isMain: true, database: null });
        const job = dbJob({
            context: makeContext({ worktree: main, database: 'hospeda_dev' }),
            script: 'db:seed'
        });

        expect(job?.env?.HOSPEDA_DATABASE_URL).toBe('postgresql://u:p@localhost:5436/hospeda_dev');
    });

    it('should refuse rather than run against an unknown database', () => {
        // Running without the variable is NOT harmless: the tools fall back to
        // the local config file, which names whichever worktree was set up last.
        expect(
            dbJob({ context: makeContext({ database: null }), script: 'db:migrate' })
        ).toBeNull();
        expect(
            dbJob({ context: makeContext({ worktree: null }), script: 'db:migrate' })
        ).toBeNull();
        expect(
            dbJob({ context: makeContext({ dbConfig: null }), script: 'db:migrate' })
        ).toBeNull();
    });

    it('should honour a non-default connection variable name', () => {
        const job = dbJob({
            context: makeContext({
                dbConfig: { ...DB_CONFIG, connStringEnvVar: 'OTRA_URL' }
            }),
            script: 'db:migrate'
        });

        expect(Object.keys(job?.env ?? {})).toEqual(['OTRA_URL']);
    });
});

describe('explainMissingDb', () => {
    it('should tell the three failures apart', () => {
        expect(explainMissingDb({ context: makeContext({ worktree: null }) })).toContain('--wt');
        expect(explainMissingDb({ context: makeContext({ dbConfig: null }) })).toContain(
            'project.config.json'
        );
        expect(explainMissingDb({ context: makeContext({ database: null }) })).toContain(
            'servers-up'
        );
    });
});
