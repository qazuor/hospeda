/**
 * Unit tests for `src/commands/env-doctor.ts` — the `runEnvDoctorChecks`
 * aggregator (HOS-79 T-017). Exercised with stub `{name, run}` checks that
 * flip `process.exitCode` directly, so these tests never touch Coolify,
 * containers, or the filesystem — and never import `envReconcile` /
 * `envCheckRules` themselves (those would require network mocking that is
 * out of scope for this pass; see the module's own JSDoc for why it's safe
 * to test the aggregator in isolation from what it aggregates).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { runEnvDoctorChecks } from '../src/commands/env-doctor.ts';

let originalExitCode: number | undefined;

beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = 0;
});

afterEach(() => {
    process.exitCode = originalExitCode;
});

describe('runEnvDoctorChecks()', () => {
    it('reports no failures when every check leaves exitCode 0', async () => {
        const { failed } = await runEnvDoctorChecks([
            { name: 'check-a', run: async () => {} },
            { name: 'check-b', run: async () => {} }
        ]);
        expect(failed).toEqual([]);
    });

    it('reports a check that sets a non-zero exitCode as failed', async () => {
        const { failed } = await runEnvDoctorChecks([
            {
                name: 'check-a',
                run: async () => {
                    process.exitCode = 1;
                }
            },
            { name: 'check-b', run: async () => {} }
        ]);
        expect(failed).toEqual(['check-a']);
    });

    it('a later PASSING check does not un-fail an earlier failing one (both run, both reported)', async () => {
        const { failed } = await runEnvDoctorChecks([
            {
                name: 'env-reconcile',
                run: async () => {
                    process.exitCode = 1;
                }
            },
            { name: 'env-check-rules', run: async () => {} }
        ]);
        expect(failed).toEqual(['env-reconcile']);
        // The second (passing) check must not have been skipped — report-all,
        // never stop-at-first-failure (mirrors the local env-doctor.ts convention).
    });

    it('an earlier PASSING check is not falsely marked failed by a later failing one', async () => {
        const { failed } = await runEnvDoctorChecks([
            { name: 'env-reconcile', run: async () => {} },
            {
                name: 'env-check-rules',
                run: async () => {
                    process.exitCode = 1;
                }
            }
        ]);
        expect(failed).toEqual(['env-check-rules']);
    });

    it('reports every check that failed when all of them do', async () => {
        const { failed } = await runEnvDoctorChecks([
            {
                name: 'check-a',
                run: async () => {
                    process.exitCode = 1;
                }
            },
            {
                name: 'check-b',
                run: async () => {
                    process.exitCode = 1;
                }
            }
        ]);
        expect(failed).toEqual(['check-a', 'check-b']);
    });

    it('runs every check even when an earlier one fails (report-all, never stop-at-first)', async () => {
        const ranNames: string[] = [];
        await runEnvDoctorChecks([
            {
                name: 'check-a',
                run: async () => {
                    ranNames.push('check-a');
                    process.exitCode = 1;
                }
            },
            {
                name: 'check-b',
                run: async () => {
                    ranNames.push('check-b');
                }
            }
        ]);
        expect(ranNames).toEqual(['check-a', 'check-b']);
    });

    it('an empty check list yields no failures', async () => {
        const { failed } = await runEnvDoctorChecks([]);
        expect(failed).toEqual([]);
    });
});
