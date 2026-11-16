/** HOS-2119 T-050 — owner traffic-stats card copy is present in every locale. */

import { describe, expect, it } from 'vitest';
import en from '../src/locales/en/listing.json';
import es from '../src/locales/es/listing.json';
import pt from '../src/locales/pt/listing.json';

const locales = { es, en, pt };

const collect = (node: unknown, prefix = ''): readonly string[] =>
    typeof node === 'string'
        ? [prefix]
        : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
              collect(v, prefix ? `${prefix}.${k}` : k)
          );

describe('HOS-2119 listing.owner.traffic i18n', () => {
    it('has the same key tree in es, en and pt', () => {
        const base = collect(es.owner.traffic);
        expect(base.length).toBeGreaterThan(15);
        expect(collect(en.owner.traffic)).toEqual(base);
        expect(collect(pt.owner.traffic)).toEqual(base);
    });

    it('has non-empty strings everywhere', () => {
        for (const locale of Object.values(locales)) {
            const walk = (n: unknown): void => {
                if (typeof n === 'string') return void expect(n.trim()).not.toBe('');
                for (const v of Object.values(n as Record<string, unknown>)) walk(v);
            };
            walk(locale.owner.traffic);
        }
    });

    it('uses the spec copy in Spanish and real translations elsewhere', () => {
        expect(es.owner.traffic.referrers.title).toBe('De dónde vienen');
        expect(es.owner.traffic.countries.title).toBe('Países');
        expect(es.owner.traffic.empty).toBe('Todavía no hay datos');
        expect(en.owner.traffic.empty).not.toBe(es.owner.traffic.empty);
        expect(pt.owner.traffic.empty).not.toBe(es.owner.traffic.empty);
    });

    it('uses plural forms with {{count}} for visitors in every locale', () => {
        for (const locale of Object.values(locales)) {
            const traffic = locale.owner.traffic as Record<string, unknown>;
            expect(traffic.visitors).toBeUndefined();
            expect(traffic.visitors_one).toEqual(expect.stringContaining('{{count}}'));
            expect(traffic.visitors_other).toEqual(expect.stringContaining('{{count}}'));
            expect(traffic.visitors_one).not.toBe(traffic.visitors_other);
        }
    });
});
