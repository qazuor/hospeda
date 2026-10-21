import { describe, expect, it } from 'vitest';
import en from '../src/locales/en/host.json';
import es from '../src/locales/es/host.json';
import pt from '../src/locales/pt/host.json';

describe('publish requirement description translations', () => {
    it('names the description in each supported locale', () => {
        expect(es.properties.editor.publishRequirement.description).toBe('la descripción');
        expect(en.properties.editor.publishRequirement.description).toBe('the description');
        expect(pt.properties.editor.publishRequirement.description).toBe('a descrição');
        expect(en.properties.editor.publishRequirement.description).not.toBe('la descripción');
        expect(pt.properties.editor.publishRequirement.description).not.toBe('la descripción');
    });
});
