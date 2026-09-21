import { describe, expect, it } from 'bun:test';
import { planFromWorkflow } from '../src/commands/verify/ci-steps.ts';

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
});
