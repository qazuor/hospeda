import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');
const TIMEOUT = 180_000;

describe('TEST:1779:1 template render under the API tsx config', () => {
    it(
        'renders notification and email templates',
        () => {
            // Arrange
            const tempDir = mkdtempSync(join(tmpdir(), 'hos-1779-render-'));
            const entry = join(tempDir, 'render.mts');
            const layout = pathToFileURL(
                join(ROOT, 'packages/notifications/src/templates/components/layout.tsx')
            ).href;
            const verify = pathToFileURL(
                join(ROOT, 'packages/email/src/templates/verify-email.tsx')
            ).href;
            writeFileSync(
                entry,
                `
            const { EmailLayout } = await import('${layout}');
            EmailLayout({ previewText: 'preview', children: 'body' });
            console.log('RENDERED EmailLayout');
            const { VerifyEmailTemplate } = await import('${verify}');
            VerifyEmailTemplate({ name: 'Test', verificationUrl: 'https://example.test/verify' });
            console.log('RENDERED VerifyEmailTemplate');
        `,
                'utf8'
            );

            try {
                // Act
                const child = spawnSync('pnpm', ['--filter', 'hospeda-api', 'exec', 'tsx', entry], {
                    cwd: ROOT,
                    env: process.env,
                    encoding: 'utf8',
                    timeout: TIMEOUT
                });

                // Assert
                const details = `exit=${child.status}\nerror=${child.error?.message ?? 'none'}\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`;
                expect(child.error, details).toBeUndefined();
                expect(child.status, details).toBe(0);
                expect(child.stdout, details).toContain('RENDERED EmailLayout');
                expect(child.stdout, details).toContain('RENDERED VerifyEmailTemplate');
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        },
        TIMEOUT
    );
});
