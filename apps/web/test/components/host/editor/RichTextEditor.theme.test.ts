import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
    resolve(__dirname, '../../../../src/components/host/editor/RichTextEditor.module.css'),
    'utf8'
);

describe('RichTextEditor theme styles', () => {
    it('uses theme tokens for toolbar surface, controls, hover, active, and editor text', () => {
        expect(stylesheet).toMatch(/\.toolbar\s*\{[^}]*background-color:\s*var\(--core-card\)/s);
        expect(stylesheet).toMatch(
            /\.toolbarButton\s*\{[^}]*color:\s*var\(--core-muted-foreground\)/s
        );
        expect(stylesheet).toMatch(
            /\.toolbarButton:hover\s*\{[^}]*background-color:\s*var\(--core-foreground-a08\)/s
        );
        expect(stylesheet).toMatch(
            /\.toolbarButtonActive\s*\{[^}]*background-color:\s*var\(--brand-primary-a15\)/s
        );
        expect(stylesheet).toMatch(/\.editorContent\s*\{[^}]*color:\s*var\(--core-foreground\)/s);

        // Whole stylesheet: no literal colors anywhere, including the error state.
        expect(stylesheet).not.toMatch(/#[\da-f]{3,8}\b|\boklch\(|\brgb\(|\bhsl\(/i);
    });

    it('themes the error state with destructive tokens', () => {
        expect(stylesheet).toMatch(/\.wrapperError\s*\{[^}]*border-color:\s*var\(--destructive\)/s);
        expect(stylesheet).toMatch(/\.errorMessage\s*\{[^}]*color:\s*var\(--destructive-text\)/s);
        expect(stylesheet).toMatch(
            /\.errorMessage\s*\{[^}]*background-color:\s*var\(--destructive-a08\)/s
        );
    });
});
