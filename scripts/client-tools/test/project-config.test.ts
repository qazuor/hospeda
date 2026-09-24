import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProjectAdapter } from '../src/lib/project-config.ts';
import { readDbConfig } from '../src/lib/worktree.ts';

async function fixture(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'qz-project-config-'));
    await mkdir(join(root, '.claude'));
    await mkdir(join(root, '.qz'));
    await writeFile(
        join(root, '.claude/project.config.json'),
        JSON.stringify({
            db: {
                devDb: 'legacy_dev',
                templateDb: 'legacy_template',
                container: 'legacy-postgres',
                user: 'legacy_user',
                connStringTemplate: 'postgresql://legacy/{dbname}',
                connStringEnvVar: 'LEGACY_DATABASE_URL'
            }
        })
    );
    await writeFile(
        join(root, '.qz/project.json'),
        JSON.stringify({
            database: {
                container: 'adapter-postgres',
                templateDatabase: 'adapter_template',
                connectionEnvVar: 'ADAPTER_DATABASE_URL'
            }
        })
    );
    return root;
}

describe('qz database adapter compatibility', () => {
    test('prefers declarative adapter fields and keeps legacy fallbacks', async () => {
        const config = await readDbConfig({ repoRoot: await fixture() });
        expect(config).toEqual({
            devDb: 'legacy_dev',
            templateDb: 'adapter_template',
            container: 'adapter-postgres',
            user: 'legacy_user',
            connStringTemplate: 'postgresql://legacy/{dbname}',
            connStringEnvVar: 'ADAPTER_DATABASE_URL'
        });
    });

    test('loads a generic adapter without a legacy project config', async () => {
        const adapter = await loadProjectAdapter(
            join(process.cwd(), 'tools/qz/fixtures/generic-project')
        );
        expect(adapter?.projectId).toBe('demo-project');
        expect(adapter?.database?.strategy).toBe('none');
        expect(adapter?.servers?.map((server) => server.id)).toEqual(['app']);
    });
});
