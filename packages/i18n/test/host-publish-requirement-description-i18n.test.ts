import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('publish requirement description translations', () => {
    it('names the description in each supported locale', () => {
        const es = JSON.parse(
            readFileSync(new URL('../src/locales/es/host.json', import.meta.url), 'utf8')
        );
        const en = JSON.parse(
            readFileSync(new URL('../src/locales/en/host.json', import.meta.url), 'utf8')
        );
        const pt = JSON.parse(
            readFileSync(new URL('../src/locales/pt/host.json', import.meta.url), 'utf8')
        );
        expect(es.host.properties.editor.publishRequirement.description).toBe('la descripción');
        expect(en.host.properties.editor.publishRequirement.description).toBe('the description');
        expect(pt.host.properties.editor.publishRequirement.description).toBe('a descrição');
        expect(en.host.properties.editor.publishRequirement.description).not.toBe('la descripción');
        expect(pt.host.properties.editor.publishRequirement.description).not.toBe('la descripción');
    });
});
