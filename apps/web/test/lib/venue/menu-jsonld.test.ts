import { describe, expect, it } from 'vitest';
import { buildRestaurantHasMenu } from '../../../src/lib/venue/menu-jsonld';

const base = { slug: 'el-boliche' };
const options = { locale: 'es' as const, siteOrigin: 'https://hospeda.example' };

describe('buildRestaurantHasMenu', () => {
    it('points structured or uploaded menu content at the absolute carta page', () => {
        expect(buildRestaurantHasMenu({ ...options, venue: { ...base, menuSections: [{}] } })).toBe(
            'https://hospeda.example/es/comer-y-salir/el-boliche/carta/'
        );
        expect(
            buildRestaurantHasMenu({
                ...options,
                venue: { ...base, menuFileUrl: 'https://cdn.example/menu.pdf', menuFileKind: 'pdf' }
            })
        ).toBe('https://hospeda.example/es/comer-y-salir/el-boliche/carta/');
    });

    it('uses only a safe external menu URL when it is the sole available content', () => {
        expect(
            buildRestaurantHasMenu({
                ...options,
                venue: { ...base, menuUrl: 'https://restaurant.example/menu' }
            })
        ).toBe('https://restaurant.example/menu');
        expect(
            buildRestaurantHasMenu({
                ...options,
                venue: { ...base, menuUrl: 'javascript:alert(1)' }
            })
        ).toBeUndefined();
    });

    it('omits hasMenu when the projected listing has no menu content', () => {
        expect(buildRestaurantHasMenu({ ...options, venue: base })).toBeUndefined();
    });
});
