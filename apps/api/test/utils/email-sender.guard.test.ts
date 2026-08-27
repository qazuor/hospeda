/**
 * Static guard: every outbound email path must carry the deployment marker.
 *
 * The marker that distinguishes a staging email from a production one is
 * applied in exactly two places — `sendAppEmail` (for `@repo/email`) and the
 * sender object handed to `BrevoEmailTransport` (for `@repo/notifications`).
 * A call site that reaches around either one still sends a perfectly valid
 * email, just an unattributable one, so the omission is invisible in review
 * and in every runtime test. Only a static check over the source catches it.
 *
 * The assertions anchor on the import statement rather than on a bare
 * `sendEmail` token, because several modules legitimately mention the function
 * name in prose doc-comments.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = resolve(__dirname, '../../src');

/** The single module allowed to import `sendEmail` straight from the package. */
const SENDER_MODULE = 'utils/email-sender.ts';

/**
 * Collects every TypeScript source file under `apps/api/src`.
 */
function collectSourceFiles(dir: string): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full));
            continue;
        }
        if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            found.push(full);
        }
    }

    return found;
}

const SOURCE_FILES = collectSourceFiles(API_SRC);

describe('email deployment-marker guard', () => {
    it('finds the API source tree (guard would be vacuous otherwise)', () => {
        // Arrange / Act / Assert — a broken path must fail loudly rather than
        // silently pass an empty scan.
        expect(SOURCE_FILES.length).toBeGreaterThan(100);
    });

    it('routes every @repo/email send through the marker-applying wrapper', () => {
        // Arrange
        const importPattern = /import\s*(?:type\s*)?{([^}]*)}\s*from\s*['"]@repo\/email['"]/g;
        const offenders: string[] = [];

        // Act
        for (const file of SOURCE_FILES) {
            const rel = relative(API_SRC, file);
            if (rel === SENDER_MODULE) {
                continue;
            }

            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(importPattern)) {
                const names = (match[1] ?? '').split(',').map((n) => n.trim());
                if (names.some((n) => /^sendEmail(\s+as\s+\w+)?$/.test(n))) {
                    offenders.push(rel);
                }
            }
        }

        // Assert
        expect(
            offenders,
            `These modules import sendEmail directly from @repo/email, which drops the ` +
                `deployment marker from the sender name and subject. Import sendAppEmail ` +
                `from utils/email-sender instead: ${offenders.join(', ')}`
        ).toEqual([]);
    });

    it('builds every BrevoEmailTransport from the resolved sender', () => {
        // Arrange — check per call site, not per file: a module with one
        // correct and one incorrect instantiation must still fail.
        const instantiation = /new\s+BrevoEmailTransport\s*\(/g;
        const offenders: string[] = [];

        // Act
        for (const file of SOURCE_FILES) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(instantiation)) {
                const callSite = source.slice(match.index, match.index + 300);

                // Accepted: the resolver called inline, or a local binding that
                // this same file assigns from the resolver. Anything else --
                // notably an inline object literal building the sender by hand
                // -- is rejected.
                const inline = callSite.includes('getEmailSender()');
                const boundArg = callSite.match(
                    /new\s+BrevoEmailTransport\s*\(\s*\w+\s*,\s*(\w+)\s*\)/
                )?.[1];
                const boundToResolver =
                    boundArg !== undefined &&
                    new RegExp(`const\\s+${boundArg}\\s*=\\s*getEmailSender\\(\\)`).test(source);

                if (!inline && !boundToResolver) {
                    const line = source.slice(0, match.index).split('\n').length;
                    offenders.push(`${relative(API_SRC, file)}:${line}`);
                }
            }
        }

        // Assert
        expect(
            offenders,
            `These BrevoEmailTransport instantiations do not use getEmailSender(), so the ` +
                `emails they send carry no deployment marker: ${offenders.join(', ')}`
        ).toEqual([]);
    });

    it('keeps the notification service from overriding the configured sender', () => {
        // Arrange — the service used to hardcode `from:`, which silently beat
        // the transport's configured sender on every notification sent.
        const servicePath = resolve(
            __dirname,
            '../../../../packages/notifications/src/services/notification.service.ts'
        );

        // Act
        const source = readFileSync(servicePath, 'utf8');

        // Assert
        expect(source).not.toMatch(/^\s*from:/m);
    });
});
