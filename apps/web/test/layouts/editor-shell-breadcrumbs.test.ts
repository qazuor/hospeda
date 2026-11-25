/** Editor hubs and sections retain their full account hierarchy (HOS-2623 D4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = readFileSync(resolve(__dirname, '../../src/layouts/EditorShellLayout.astro'), 'utf8');

describe('EditorShellLayout breadcrumbs', () => {
    it('links the sidebar section to its list, including vertical query parameters', () => {
        expect(shell).toContain('getAccountSectionLabel({ t, section: accountSection })');
        expect(shell).toContain('path: registry.indexPath');
        expect(shell).not.toContain('t(registry.indexLabelKey)');
    });

    it('adds the named entity hub only on section pages, with the current title last', () => {
        expect(shell).toContain(
            '...(!isHub ? [{ label: entityName, path: registry.buildHubPath({ entityId }) }] : [])'
        );
        expect(shell).toContain('current: isHub ? entityName : title');
        expect(shell).toContain('breadcrumbs={breadcrumbs}');
        expect(shell).not.toMatch(/\bback=\{/);
    });
});
