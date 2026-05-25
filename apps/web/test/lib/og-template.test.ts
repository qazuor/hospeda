/**
 * @fileoverview
 * Unit tests for the pure OG template helpers (`src/lib/og-template.ts`).
 *
 * These run in the default jsdom environment — they exercise only pure logic
 * (param parsing, mode detection, word truncation, deterministic hero hashing,
 * and `/api/og` URL assembly). The actual PNG rasterization (which needs a real
 * Node WASM runtime) is covered separately in `test/pages/api/og.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
    HERO_KEYS,
    type OgAssets,
    TYPE_BADGE,
    buildHeroCard,
    buildOgElement,
    buildOgImagePath,
    buildPhotoCard,
    parseOgParams,
    pickHeroKey,
    truncateWords
} from '../../src/lib/og-template';

const STUB_ASSETS: OgAssets = {
    logo: 'data:image/png;base64,AAAA',
    heroes: {
        atardecer: 'data:image/jpeg;base64,BBBB',
        isla: 'data:image/jpeg;base64,CCCC',
        playa: 'data:image/jpeg;base64,DDDD'
    }
};

function params(search: string): URLSearchParams {
    return new URL(`http://x/api/og${search}`).searchParams;
}

describe('parseOgParams — mode detection', () => {
    it('returns photo mode when an image is provided', () => {
        const result = parseOgParams(
            params('?title=Hotel&image=https://cdn/x.jpg&type=Alojamiento')
        );
        expect(result.mode).toBe('photo');
        expect(result.image).toBe('https://cdn/x.jpg');
        expect(result.type).toBe('Alojamiento');
    });

    it('returns brand mode when no image is provided', () => {
        const result = parseOgParams(params('?title=Inicio&tagline=Hola'));
        expect(result.mode).toBe('brand');
        expect(result.tagline).toBe('Hola');
    });

    it('defaults the title to Hospeda when absent', () => {
        expect(parseOgParams(params('')).title).toBe('Hospeda');
    });

    it('carries subtitle and rating through for photo cards', () => {
        const result = parseOgParams(params('?title=H&image=x&subtitle=Col%C3%B3n&rating=4.8'));
        expect(result.subtitle).toBe('Colón');
        expect(result.rating).toBe('4.8');
    });
});

describe('truncateWords — word-boundary truncation', () => {
    it('leaves short strings untouched', () => {
        expect(truncateWords('Short title', 70)).toBe('Short title');
    });

    it('truncates on a word boundary with an ellipsis (no mid-word cut)', () => {
        const long =
            'Hermosa cabaña frente al río con pileta climatizada y parrilla para toda la familia';
        const out = truncateWords(long, 40);
        expect(out.endsWith('…')).toBe(true);
        // The text before the ellipsis must end on a full word (no trailing partial).
        const body = out.slice(0, -1);
        expect(long.startsWith(body)).toBe(true);
        expect(long.charAt(body.length)).toBe(' ');
        expect(body.length).toBeLessThanOrEqual(40);
    });

    it('hard-cuts a single oversized word so the layout never overflows', () => {
        const out = truncateWords('Supercalifragilisticexpialidocious', 10);
        expect(out).toBe('Supercalif…');
    });
});

describe('pickHeroKey — deterministic hero hashing', () => {
    it('returns the same hero for the same seed (cache-stable per URL)', () => {
        const a = pickHeroKey('Alojamientos en Colón');
        const b = pickHeroKey('Alojamientos en Colón');
        expect(a).toBe(b);
        expect(HERO_KEYS).toContain(a);
    });

    it('always returns a valid hero key for arbitrary seeds', () => {
        for (const seed of ['', 'a', 'home', 'Eventos', 'destinos/colon', '1234567890']) {
            expect(HERO_KEYS).toContain(pickHeroKey(seed));
        }
    });

    it('spreads different seeds across more than one hero', () => {
        const seeds = Array.from({ length: 30 }, (_, i) => `page-${i}`);
        const picks = new Set(seeds.map(pickHeroKey));
        expect(picks.size).toBeGreaterThan(1);
    });

    it('parseOgParams uses seed when present, else falls back to title', () => {
        const bySeed = parseOgParams(params('?title=Different&seed=fixed-seed')).heroKey;
        const byTitle = parseOgParams(params('?title=fixed-seed')).heroKey;
        expect(bySeed).toBe(byTitle);
    });
});

describe('buildOgImagePath — SEOHead URL assembly', () => {
    it('builds a brand-mode URL from title + description only (backward compat)', () => {
        const path = buildOgImagePath({ title: 'Inicio', description: 'Bienvenido' });
        expect(path.startsWith('/api/og?')).toBe(true);
        const sp = new URL(`http://x${path}`).searchParams;
        expect(sp.get('title')).toBe('Inicio');
        expect(sp.get('description')).toBe('Bienvenido');
        expect(sp.has('image')).toBe(false);
        expect(sp.has('type')).toBe(false);
    });

    it('URL-encodes values', () => {
        const path = buildOgImagePath({ title: 'Cabaña & Río', subtitle: 'Colón, E.R.' });
        expect(path).toContain('Caba%C3%B1a');
        const sp = new URL(`http://x${path}`).searchParams;
        expect(sp.get('title')).toBe('Cabaña & Río');
        expect(sp.get('subtitle')).toBe('Colón, E.R.');
    });

    it('includes photo-card params when provided', () => {
        const path = buildOgImagePath({
            title: 'Hotel X',
            type: 'Alojamiento',
            image: 'https://cdn/x.jpg',
            subtitle: 'Ubajay',
            rating: '4.8'
        });
        const sp = new URL(`http://x${path}`).searchParams;
        expect(sp.get('type')).toBe('Alojamiento');
        expect(sp.get('image')).toBe('https://cdn/x.jpg');
        expect(sp.get('rating')).toBe('4.8');
    });

    it('omits empty-string params', () => {
        const path = buildOgImagePath({ title: 'X', description: '', tagline: '' });
        const sp = new URL(`http://x${path}`).searchParams;
        expect(sp.has('description')).toBe(false);
        expect(sp.has('tagline')).toBe(false);
    });
});

describe('TYPE_BADGE — entity colors', () => {
    it('maps each entity label to its brand color', () => {
        expect(TYPE_BADGE.Alojamiento).toBe('#3885f9');
        expect(TYPE_BADGE.Guía).toBe('#8b5cf6');
        expect(TYPE_BADGE.Destino).toBeTypeOf('string');
        expect(TYPE_BADGE.Evento).toBeTypeOf('string');
    });
});

describe('builders — element tree shape', () => {
    it('buildOgElement returns the photo card in photo mode', () => {
        const p = parseOgParams(params('?title=Hotel&image=x&type=Alojamiento&rating=4.8'));
        const fromGeneric = buildOgElement(p, STUB_ASSETS);
        const fromPhoto = buildPhotoCard(p, STUB_ASSETS);
        expect(fromGeneric.type).toBe('div');
        expect(JSON.stringify(fromGeneric)).toBe(JSON.stringify(fromPhoto));
    });

    it('buildOgElement returns the hero card in brand mode', () => {
        const p = parseOgParams(params('?title=Inicio&tagline=Hola'));
        const fromGeneric = buildOgElement(p, STUB_ASSETS);
        const fromHero = buildHeroCard(p, STUB_ASSETS);
        expect(JSON.stringify(fromGeneric)).toBe(JSON.stringify(fromHero));
    });

    it('photo card embeds the resolved type-badge color', () => {
        const p = parseOgParams(params('?title=Hotel&image=x&type=Guía'));
        const tree = JSON.stringify(buildPhotoCard(p, STUB_ASSETS));
        expect(tree).toContain('#8b5cf6');
    });

    it('hero card embeds the deterministically chosen hero image', () => {
        const p = parseOgParams(params('?title=Inicio'));
        const tree = JSON.stringify(buildHeroCard(p, STUB_ASSETS));
        expect(tree).toContain(STUB_ASSETS.heroes[p.heroKey]);
    });
});
