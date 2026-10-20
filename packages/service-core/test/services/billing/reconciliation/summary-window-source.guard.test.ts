import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const SUMMARY = join(ROOT, 'packages/service-core/src/services/billing/reconciliation/summary');
const JOB = join(ROOT, 'apps/api/src/cron/jobs/billing-reconciliation-summary.job.ts');
function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory() ? files(file) : name.endsWith('.ts') ? [file] : [];
    });
}
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
}
describe('TEST:1608:4 summary deadline source guard', () => {
    it('forbids env configuration and numeric N sources in summary code and job', () => {
        const sources = [...files(SUMMARY), JOB].map((file) =>
            stripComments(readFileSync(file, 'utf8'))
        );
        for (const source of sources) {
            expect(source).not.toMatch(
                /process\.env|import\.meta\.env|HOSPEDA_|from\s+['"][^'"]*utils\/env/
            );
        }
        const tick = stripComments(
            readFileSync(join(SUMMARY, 'run-summary-tick.service.ts'), 'utf8')
        );
        expect(tick).not.toMatch(/windowMinutes:\s*\d/);
        expect(tick).not.toMatch(/\+\s*\d+\s*\*\s*60_?000/);
        expect(tick.match(/values\?\.\['19'\]\?\.minutes/g)).toHaveLength(1);
    });
    it('detectors catch env and literal controls', () => {
        const control = stripComments('const minutes = process.env.X; windowMinutes: 60;');
        expect(control).toMatch(/process\.env|import\.meta\.env|HOSPEDA_|utils\/env/);
        expect(control).toMatch(/windowMinutes:\s*\d/);
    });
});
