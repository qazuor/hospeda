import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { E2E_MAIL_CAPTURE_URL } from '../../fixtures/mail-capture-server.ts';
import playwrightConfig from '../../playwright.config.ts';

const E2E_ROOT = join(import.meta.dirname, '..', '..');
const TESTS_DIR = join(E2E_ROOT, 'tests');

function readSpecs(): ReadonlyArray<{ readonly file: string; readonly source: string }> {
    const specs: Array<{ file: string; source: string }> = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.spec.ts')) {
                specs.push({
                    file: file.slice(E2E_ROOT.length + 1),
                    source: readFileSync(file, 'utf8')
                });
            }
        }
    };
    walk(TESTS_DIR);
    return specs;
}

const scripts = JSON.parse(readFileSync(join(E2E_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
};

describe('TEST:V4:23 support clock specs isolation', () => {
    it('requires @clock on specs using the fake provider or mail capture server', () => {
        const offenders = readSpecs().filter(({ source }) => {
            if (!/fixtures\/(?:fake-provider-server|mail-capture-server)/.test(source))
                return false;
            const title = /test\.describe\(\s*(['"`])([^'"`]+)\1/.exec(source)?.[2] ?? '';
            return !title.includes('@clock');
        });
        expect(
            offenders.map(({ file }) => file),
            `Clock isolation rule: every spec importing fixtures/fake-provider-server or ` +
                `fixtures/mail-capture-server must have @clock in its test.describe title. ` +
                `Offenders: ${offenders.map(({ file }) => file).join(', ') || '(none)'}`
        ).toEqual([]);
    });

    it('runs clock specs after parallel specs and serially in both main scripts', () => {
        for (const name of ['e2e:test', 'e2e:test:p0']) {
            const script = scripts.scripts[name] ?? '';
            expect(
                script,
                `Clock isolation rule in apps/e2e/package.json (${name}): first invocation ` +
                    'must use --grep-invert @clock and the second must use --grep @clock --workers=1.'
            ).toMatch(
                /playwright test[^&]*--grep-invert @clock.*playwright test[^&]*--grep @clock --workers=1/
            );
        }
    });

    it('points the built API at the mail capture server URL constant', () => {
        const apiServer = Array.isArray(playwrightConfig.webServer)
            ? playwrightConfig.webServer[0]
            : playwrightConfig.webServer;
        expect(
            apiServer?.env?.HOSPEDA_E2E_MAIL_CAPTURE_URL,
            `Mail capture URL rule: apps/e2e/playwright.config.ts API webServer env must match ` +
                `E2E_MAIL_CAPTURE_URL from apps/e2e/fixtures/mail-capture-server.ts.`
        ).toBe(E2E_MAIL_CAPTURE_URL);
    });
});
