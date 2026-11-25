/** Source guards for Astro composition; not a browser layout assertion. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('host location notice composition', () => {
    it('uses an explicit consumer-owned stack around notices and the form', () => {
        const source = readSource('pages/[lang]/mi-cuenta/propiedades/[id]/editar/ubicacion.astro');
        expect(source).toContain('class={editorStyles.stack}');
        expect(source).toMatch(
            /class=\{editorStyles.stack\}[\s\S]*<LocationDuplicateNotice[\s\S]*<LocationExceptionPanel[\s\S]*<LocationForm/
        );
    });

    it('renders the duplicate-location warning with a kit icon Alert', () => {
        const source = readSource('components/listing/LocationDuplicateNotice.astro');
        expect(source).toContain('<Alert locale={locale} tone="warning">');
        expect(source).not.toContain('border:');
    });
});
