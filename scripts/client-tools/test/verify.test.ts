import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { planFromWorkflow } from '../src/commands/verify/ci-steps.ts';
import { dependencyGaps } from '../src/commands/verify/verify.ts';

describe('verify workflow planning', () => {
    it('preserves a step working-directory from GitHub Actions', () => {
        const plan = planFromWorkflow({
            yaml: `
jobs:
  guards:
    steps:
      - name: Test server tools
        working-directory: scripts/server-tools
        run: bun test
`,
            jobs: ['guards']
        });

        expect(plan.steps).toEqual([
            {
                job: 'guards',
                name: 'Test server tools',
                run: 'bun test',
                workingDirectory: 'scripts/server-tools'
            }
        ]);
    });

    it('reports missing tool dependencies without installing them', async () => {
        const root = await mkdtemp(join('/tmp', 'qz-verify-test-'));
        try {
            const tools = join(root, 'scripts', 'server-tools');
            await mkdir(tools, { recursive: true });
            await writeFile(join(tools, 'package.json'), '{}');
            await writeFile(join(tools, 'bun.lock'), '');
            expect(
                dependencyGaps({
                    repoRoot: root,
                    steps: [{ workingDirectory: 'scripts/server-tools' }]
                })
            ).toEqual([
                { directory: 'scripts/server-tools', install: 'bun install --frozen-lockfile' }
            ]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('does not report a package whose node_modules already exists', async () => {
        const root = await mkdtemp(join('/tmp', 'qz-verify-test-'));
        try {
            const tools = join(root, 'scripts', 'client-tools');
            await mkdir(join(tools, 'node_modules'), { recursive: true });
            await writeFile(join(tools, 'package.json'), '{}');
            expect(
                dependencyGaps({
                    repoRoot: root,
                    steps: [{ workingDirectory: 'scripts/client-tools' }]
                })
            ).toEqual([]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
