/**
 * @fileoverview The marketing device guard rejects every predicate it declares, keeps the
 * S24 Ultra numbers green, counts its one named exemption exactly, and is wired into the
 * local and CI guard entry points.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../check-marketing-device.js';

const DEVICE_FILE = 'marketing/videos/config/device.ts';
const DEVICE_OK = [
    'screen: { width: 412, height: 892 },',
    'viewport: { width: 412, height: 750 },',
    'recordDpr: 3,',
    'exportSize: { width: 1080, height: 2340 },'
].join('\n');
const HISTORY_ROW = '| 31/10/2026 | «S24 Ultra» | Antes 390 × 844 con marco de iPhone («9:41») |';
const REGLAS = 'marketing/videos/REGLAS.md';

/** Runs the guard over an in-memory tree. */
const runOn = ({ files }: { readonly files: Readonly<Record<string, string>> }) =>
    run({
        root: '/virtual',
        files: Object.keys(files),
        readFile: (file) => files[file] ?? ''
    });

const baseTree = (extra: Readonly<Record<string, string>> = {}) => ({
    [DEVICE_FILE]: DEVICE_OK,
    [REGLAS]: `# Reglas\n\n${HISTORY_ROW}\n`,
    'marketing/prompts/fondos.md': 'Pantalla 19,5:9, video 1080 × 1920, inserto 311 × 520.',
    ...extra
});

describe('check-marketing-device', () => {
    it('passes on the reference device and legitimate frame sizes', () => {
        // Arrange
        const files = baseTree();
        // Act
        const result = runOn({ files });
        // Assert
        expect(result.violations).toEqual([]);
        expect(result.exitCode).toBe(0);
    });

    it.each([
        ['iphone', 'Hospedín sostiene un iPhone.'],
        ['notch', 'a phone with a notch'],
        ['dynamic-island', 'no Dynamic Island'],
        ['isla-de-camara', 'borde titanio, isla de cámara'],
        ['iphone-clock', '<span>9:41</span>']
    ])('(a) rejects %s', (detail, line) => {
        // Arrange
        const files = baseTree({ 'marketing/prompts/v1/t1.md': line });
        // Act
        const result = runOn({ files });
        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.violations).toContainEqual(
            expect.objectContaining({ predicate: 'a', detail, line: 1 })
        );
    });

    it.each([
        ['390×844', 'viewport 390 × 844'],
        ['390×844', 'viewport: { width: 390, height: 844 },'],
        ['1170×2532', 'export 1170x2532'],
        ['old A1 recording size (1170/2532)', 'export const REC_WIDTH = 1170;'],
        ['20:9', 'aspect 20:9']
    ])('(b) rejects %s', (detail, line) => {
        // Arrange
        const files = baseTree({ 'marketing/videos/src/a1/x.ts': line });
        // Act
        const result = runOn({ files });
        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.violations).toContainEqual(
            expect.objectContaining({ predicate: 'b', detail })
        );
    });

    it('(c) rejects a device profile that lost a measured number', () => {
        // Arrange
        const files = baseTree({ [DEVICE_FILE]: DEVICE_OK.replace('892', '915') });
        // Act
        const result = runOn({ files });
        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.violations).toContainEqual(
            expect.objectContaining({ predicate: 'c', file: DEVICE_FILE })
        );
    });

    it('fails when the named exemption matches no line (stale) or more than one', () => {
        // Arrange
        const stale = baseTree({ [REGLAS]: '# Reglas\n' });
        const doubled = baseTree({ [REGLAS]: `${HISTORY_ROW}\n${HISTORY_ROW}\n` });
        // Act
        const staleResult = runOn({ files: stale });
        const doubledResult = runOn({ files: doubled });
        // Assert
        expect(staleResult.violations).toContainEqual(
            expect.objectContaining({ predicate: 'exemption' })
        );
        expect(doubledResult.violations).toContainEqual(
            expect.objectContaining({ predicate: 'exemption' })
        );
    });

    it('does not extend the exemption to other lines of REGLAS', () => {
        // Arrange
        const files = baseTree({ [REGLAS]: `${HISTORY_ROW}\nEl marco no es un iPhone.\n` });
        // Act
        const result = runOn({ files });
        // Assert
        expect(result.violations).toContainEqual(
            expect.objectContaining({ predicate: 'a', file: REGLAS, line: 2 })
        );
    });

    it('is wired into check:guards and its own CI step', () => {
        // Arrange
        const root = path.resolve(import.meta.dirname, '../..');
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
            readonly scripts: Readonly<Record<string, string>>;
        };
        const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
        // Act + Assert
        expect(pkg.scripts['check:marketing-device']).toBe('tsx scripts/check-marketing-device.ts');
        expect(pkg.scripts['check:guards']).toContain('pnpm check:marketing-device');
        expect(ci).toMatch(/\n\s+run: pnpm check:marketing-device\n/);
    });
});
