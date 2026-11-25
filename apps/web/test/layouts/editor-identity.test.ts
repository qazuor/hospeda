import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/layouts/EditorShellLayout.astro'),
    'utf8'
);

describe('editor desktop identity', () => {
    it('renders the entity outside the hidden switcher on sections, not on hubs', () => {
        expect(source).toContain('!isHub && <p class="editor-shell__identity">{entityName}</p>');
        expect(source).toMatch(
            /@container \(min-width: 60rem\)[\s\S]*\.editor-shell__identity\s*\{\s*display: block/
        );
    });
});
