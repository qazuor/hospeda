/**
 * @file email-components.guard.fixtures.test.ts
 * @description Proves the email components guard detects each forbidden form before
 * it is trusted (HOS-2565 D6 rule 5, AC-2.4). Fabricated fixture sources are scanned
 * and evaluated with the same code the real guard runs.
 */

import { describe, expect, it } from 'vitest';
import {
    type CardAllowlistEntry,
    type EmailSourceScan,
    evaluateEmailComponents,
    scanEmailSource
} from './helpers/email-components-scanner.js';

const SHARED_BUTTON = 'email/src/components/button.tsx';
const SHARED_CALLOUT = 'email/src/components/callout.tsx';

/** Scans fixture sources and evaluates them with an allowlist. */
function evaluate({
    files,
    allowlist = []
}: {
    readonly files: Readonly<Record<string, string>>;
    readonly allowlist?: readonly CardAllowlistEntry[];
}) {
    const scans = new Map<string, EmailSourceScan>(
        Object.entries(files).map(([file, source]) => [
            file,
            scanEmailSource({ fileName: file, source })
        ])
    );
    return evaluateEmailComponents({
        scans,
        allowlist,
        sharedButtonFile: SHARED_BUTTON,
        sharedCalloutFile: SHARED_CALLOUT,
        fileExists: (file) => file in files
    });
}

const FILE = 'notifications/src/templates/fixture/box.tsx';

describe('email components guard: the scanner detects each forbidden form', () => {
    describe('rule 1: borderLeft', () => {
        it('should flag a borderLeft style naming the file, the line and the owner', () => {
            // Arrange
            const source = `const styles = {\n    warningBox: {\n        borderLeft: '4px solid #f59e0b'\n    }\n};\n`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.borderLeft).toEqual([
                `${FILE}:3 borderLeft in "warningBox" (4px solid #f59e0b)`
            ]);
        });

        it('should flag the quoted kebab-case key too', () => {
            // Arrange
            const source = `const s = { box: { 'border-left': '4px solid red' } };`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.borderLeft).toHaveLength(1);
        });

        it('should ignore borderLeft written in a comment or a string', () => {
            // Arrange
            const source = `// borderLeft: '4px solid red'\nconst text = "borderLeft: 1px";\n`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.borderLeft).toEqual([]);
        });

        it('should allow the shared callout file to draw the border', () => {
            // Arrange
            const source = `const cell = { borderLeft: '4px solid #000000' };`;

            // Act
            const verdict = evaluate({ files: { [SHARED_CALLOUT]: source } });

            // Assert
            expect(verdict.borderLeft).toEqual([]);
        });

        it.each([
            ['borderLeftWidth', "{ box: { borderLeftWidth: '4px' } }"],
            ['borderLeftColor', "{ box: { borderLeftColor: '#f59e0b' } }"],
            ['borderLeftStyle', "{ box: { borderLeftStyle: 'solid' } }"],
            ['border-left-width', "{ box: { 'border-left-width': '4px' } }"]
        ])('should flag the %s longhand', (_name, literal) => {
            // Act
            const verdict = evaluate({ files: { [FILE]: `const s = ${literal};` } });

            // Assert
            expect(verdict.borderLeft).toHaveLength(1);
        });

        it('should exempt a style that is in the allowlist', () => {
            // Arrange
            const source = `const styles = { itemBox: { borderLeft: '4px solid #22c55e' } };`;

            // Act
            const verdict = evaluate({
                files: { [FILE]: source },
                allowlist: [
                    {
                        file: FILE,
                        style: 'itemBox',
                        property: 'borderLeft',
                        reason: 'A list card, not a callout.'
                    }
                ]
            });

            // Assert
            expect(verdict.borderLeft).toEqual([]);
            expect(verdict.staleAllowlist).toEqual([]);
        });
    });

    describe('rule 2: react-email Button', () => {
        it.each([
            ["import { Button } from '@react-email/components';", 'named import'],
            ["import { Button as RawButton } from '@react-email/components';", 'aliased import'],
            ["import { Text, Button } from '@react-email/components';", 'mixed import'],
            ["import { Button } from '@react-email/button';", 'direct package import']
        ])('should flag %s (%s)', (source) => {
            // Act
            const verdict = evaluate({ files: { [FILE]: `${source}\n` } });

            // Assert
            expect(verdict.reactEmailButton).toHaveLength(1);
            expect(verdict.reactEmailButton[0]).toContain(`${FILE}:1`);
        });

        it('should flag Button reached through a namespace import', () => {
            // Arrange
            const source = `import * as RE from '@react-email/components';\nexport const B = RE.Button;\n`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.reactEmailButton).toEqual([`${FILE}:2 RE.Button`]);
        });

        it('should not flag other react-email components or the shared button file', () => {
            // Act
            const verdict = evaluate({
                files: {
                    [FILE]: `import { Text, Section } from '@react-email/components';\n`,
                    [SHARED_BUTTON]: `import { Button } from '@react-email/components';\n`
                }
            });

            // Assert
            expect(verdict.reactEmailButton).toEqual([]);
        });
    });

    describe('rule 2: re-export and call bypasses', () => {
        it.each([
            ["export { Button } from '@react-email/components';", 'named re-export'],
            ["export { Button as Cta } from '@react-email/components';", 'aliased re-export'],
            ["export * from '@react-email/components';", 'star re-export'],
            ["export * as RE from '@react-email/components';", 'namespace re-export'],
            ["const { Button } = require('@react-email/components');", 'require call'],
            ["const RE = require('@react-email/components');", 'require without destructuring'],
            ["const mod = await import('@react-email/components');", 'dynamic import']
        ])('should flag %s (%s)', (source) => {
            // Act
            const verdict = evaluate({ files: { [FILE]: `${source}\n` } });

            // Assert
            expect(verdict.reactEmailButton).toHaveLength(1);
            expect(verdict.reactEmailButton[0]).toContain(`${FILE}:1`);
        });

        it('should not flag re-exporting other components or requiring other modules', () => {
            // Act
            const verdict = evaluate({
                files: {
                    [FILE]: [
                        "export { Text } from '@react-email/components';",
                        "const fs = require('node:fs');",
                        "const other = await import('./local.js');"
                    ].join('\n')
                }
            });

            // Assert
            expect(verdict.reactEmailButton).toEqual([]);
        });

        it('should allow every form inside the shared button file', () => {
            // Act
            const verdict = evaluate({
                files: { [SHARED_BUTTON]: "export * from '@react-email/components';\n" }
            });

            // Assert
            expect(verdict.reactEmailButton).toEqual([]);
        });
    });

    describe('rule 3: hex backgroundColor', () => {
        it.each([
            '#fff',
            '#f8fafc',
            '#F8FAFC',
            '#f8fafcff'
        ])('should flag the literal %s', (hex) => {
            // Arrange
            const source = `const styles = { box: { backgroundColor: '${hex}' } };`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.hexBackground).toEqual([`${FILE}:1 backgroundColor ${hex} in "box"`]);
        });

        it('should name the enclosing function when the style is built inside one', () => {
            // Arrange
            const source = `function severityStyle() {\n    return { ...base, backgroundColor: '#fee2e2' };\n}\n`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.hexBackground).toEqual([
                `${FILE}:2 backgroundColor #fee2e2 in "severityStyle"`
            ]);
        });

        it('should not flag palette references, named colors or transparent', () => {
            // Arrange
            const source = [
                `const a = { backgroundColor: emailPalette.pageBackground };`,
                `const b = { backgroundColor: 'transparent' };`,
                `const c = { backgroundColor: 'white' };`
            ].join('\n');

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict.hexBackground).toEqual([]);
        });

        it('should exempt an allowlisted owner only in its own file', () => {
            // Arrange
            const source = `const styles = { receiptBox: { backgroundColor: '#f8fafc' } };`;
            const allowlist = [
                {
                    file: FILE,
                    style: 'receiptBox',
                    property: 'backgroundColor',
                    reason: 'A receipt card.'
                }
            ];

            // Act
            const inFile = evaluate({ files: { [FILE]: source }, allowlist });
            const elsewhere = evaluate({
                files: { 'notifications/src/templates/fixture/other.tsx': source },
                allowlist
            });

            // Assert
            expect(inFile.hexBackground).toEqual([]);
            expect(elsewhere.hexBackground).toHaveLength(1);
        });
    });

    describe('rule 4: stale allowlist', () => {
        it('should flag an entry whose style no longer exists in its file', () => {
            // Arrange
            const source = `const styles = { other: { color: '#000000' } };`;

            // Act
            const verdict = evaluate({
                files: { [FILE]: source },
                allowlist: [
                    {
                        file: FILE,
                        style: 'itemBox',
                        property: 'borderLeft',
                        reason: 'Was a list card once.'
                    }
                ]
            });

            // Assert
            expect(verdict.staleAllowlist).toEqual([`${FILE}#itemBox.borderLeft`]);
        });

        it('should flag an entry whose file no longer exists', () => {
            // Act
            const verdict = evaluate({
                files: {},
                allowlist: [
                    {
                        file: FILE,
                        style: 'itemBox',
                        property: 'borderLeft',
                        reason: 'The file was deleted.'
                    }
                ]
            });

            // Assert
            expect(verdict.staleAllowlist).toEqual([`${FILE}#itemBox.borderLeft`]);
        });

        it('should keep an entry live while its style still declares a palette background', () => {
            // Arrange
            const source = `const styles = { receiptBox: { backgroundColor: emailPalette.pageBackground } };`;

            // Act
            const verdict = evaluate({
                files: { [FILE]: source },
                allowlist: [
                    {
                        file: FILE,
                        style: 'receiptBox',
                        property: 'backgroundColor',
                        reason: 'A receipt card.'
                    }
                ]
            });

            // Assert
            expect(verdict.staleAllowlist).toEqual([]);
        });
    });

    describe('rule 4: the allowlist is per property', () => {
        const entry: CardAllowlistEntry = {
            file: FILE,
            style: 'receiptBox',
            property: 'backgroundColor',
            reason: 'A receipt card with a palette background.'
        };

        it('should fail a borderLeft added to a backgroundColor-only allowlisted owner', () => {
            // Arrange
            const source = `const s = { receiptBox: { backgroundColor: emailPalette.pageBackground, borderLeft: '4px solid red' } };`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source }, allowlist: [entry] });

            // Assert
            expect(verdict.borderLeft).toHaveLength(1);
            expect(verdict.staleAllowlist).toEqual([]);
        });

        it('should fail a hex backgroundColor on an owner that only allowlists borderLeft', () => {
            // Arrange
            const source = `const s = { itemBox: { borderLeft: '4px solid red', backgroundColor: '#f0fdf4' } };`;
            const borderOnly: CardAllowlistEntry = {
                file: FILE,
                style: 'itemBox',
                property: 'borderLeft',
                reason: 'Only the border is excused here.'
            };

            // Act
            const verdict = evaluate({ files: { [FILE]: source }, allowlist: [borderOnly] });

            // Assert
            expect(verdict.borderLeft).toEqual([]);
            expect(verdict.hexBackground).toHaveLength(1);
        });

        it('should flag an entry whose property is gone even if the owner still has another', () => {
            // Arrange
            const source = `const s = { receiptBox: { padding: '1px', borderLeft: '4px solid red' } };`;

            // Act
            const verdict = evaluate({
                files: { [FILE]: source },
                allowlist: [entry, { ...entry, property: 'borderLeft' }]
            });

            // Assert
            expect(verdict.staleAllowlist).toEqual([`${FILE}#receiptBox.backgroundColor`]);
        });
    });

    describe('a clean file', () => {
        it('should produce no violation', () => {
            // Arrange
            const source = `import { Button, Callout } from '@repo/email';\nexport const x = 1;\n`;

            // Act
            const verdict = evaluate({ files: { [FILE]: source } });

            // Assert
            expect(verdict).toEqual({
                borderLeft: [],
                reactEmailButton: [],
                hexBackground: [],
                staleAllowlist: []
            });
        });
    });
});
