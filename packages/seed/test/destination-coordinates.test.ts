/**
 * Destination coordinate sanity guard (Bug B6).
 *
 * The destination map (`/destinos/mapa`, Leaflet) plots each city from the
 * `location.coordinates` stored in its seed JSON. Several cities shipped with
 * coordinates that did not match their real location (e.g. San Justo was ~11 km
 * off, Pueblo Liebig ~7 km), so their markers landed in the wrong place.
 *
 * These checks cannot assert the exact real coordinates without duplicating the
 * seed (a tautology), but they catch the gross failure modes that produce a
 * visibly wrong marker:
 *   - lat/long swapped (a longitude in the lat field falls outside the box),
 *   - 0,0 / null-ish values,
 *   - a coordinate from another province or country,
 *   - two distinct cities copy-pasting the same point.
 *
 * The box is Entre Ríos with a small margin. All 22 CITY destinations sit well
 * inside it; aggregate destinations (country/region) are intentionally excluded
 * because their centroids can fall outside the province.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'destination');

// Entre Ríos bounding box with margin. A swapped lat/long puts a ~-58 longitude
// into the lat field, which is outside [LAT_MIN, LAT_MAX] and trips the guard.
const LAT_MIN = -34.0;
const LAT_MAX = -30.5;
const LONG_MIN = -59.6;
const LONG_MAX = -57.7;

interface DestinationSeed {
    readonly name: string;
    readonly destinationType: string;
    readonly location?: { coordinates?: { lat?: string; long?: string } };
}

const cityFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
        file: f,
        data: JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) as DestinationSeed
    }))
    .filter((entry) => entry.data.destinationType === 'CITY')
    .sort((a, b) => a.file.localeCompare(b.file));

describe('destination coordinates (Bug B6 guard)', () => {
    it('finds the 22 CITY destination seed files', () => {
        expect(cityFiles.length).toBe(22);
    });

    it('has no two cities sharing the exact same coordinates', () => {
        const seen = new Map<string, string>();
        const dupes: string[] = [];
        for (const { file, data } of cityFiles) {
            const c = data.location?.coordinates;
            const key = `${c?.lat},${c?.long}`;
            const prev = seen.get(key);
            if (prev) dupes.push(`${file} == ${prev} (${key})`);
            else seen.set(key, file);
        }
        expect(dupes, `cities with duplicate coordinates: ${dupes.join('; ')}`).toEqual([]);
    });

    // Anchors for cities whose real location is verified (against OpenStreetMap,
    // the same source as the map tiles). These reproduce Bug B6: before the fix
    // San Justo was at -58.55 (~11 km off) and Pueblo Liebig at -32.2167 (~7 km
    // off). The tolerance (~1.1 km) is deliberately tighter than the smallest
    // correction in the set (Caseros, ~2 km on each axis) so that reverting ANY
    // anchor to its old wrong point fails on at least one axis, while the three
    // already-correct anchors (max drift ~0.5 km vs OSM) still pass. Aggregates
    // are not anchored.
    const ANCHORS: ReadonlyArray<{ file: string; lat: number; long: number }> = [
        // corrected in this fix
        { file: '017-destination-san-justo.json', lat: -32.4458, long: -58.4353 },
        { file: '007-destination-liebig.json', lat: -32.155, long: -58.1929 },
        { file: '018-destination-caseros.json', lat: -32.4721, long: -58.4799 },
        { file: '001-destination-chajari.json', lat: -30.7604, long: -57.9853 },
        { file: '008-destination-paranacito.json', lat: -33.7164, long: -58.662 },
        // verified already-correct (guard against drift)
        { file: '011-destination-concepcion-del-uruguay.json', lat: -32.4852, long: -58.232 },
        { file: '002-destination-colon.json', lat: -32.2183, long: -58.1356 },
        { file: '009-destination-san-jose.json', lat: -32.2123, long: -58.2191 }
    ];
    const TOLERANCE_DEG = 0.01;

    describe.each(ANCHORS)('$file is at its real location', ({ file, lat, long }) => {
        const entry = cityFiles.find((c) => c.file === file);
        it('sits within tolerance of the verified town center', () => {
            const c = entry?.data.location?.coordinates;
            expect(Math.abs(Number(c?.lat) - lat), `lat off for ${file}`).toBeLessThanOrEqual(
                TOLERANCE_DEG
            );
            expect(Math.abs(Number(c?.long) - long), `long off for ${file}`).toBeLessThanOrEqual(
                TOLERANCE_DEG
            );
        });
    });

    describe.each(cityFiles)('$file', ({ data }) => {
        it('has parseable lat/long inside the Entre Ríos box', () => {
            const c = data.location?.coordinates;
            expect(c, 'missing location.coordinates').toBeDefined();

            const lat = Number(c?.lat);
            const long = Number(c?.long);
            expect(Number.isFinite(lat), `lat not numeric: ${c?.lat}`).toBe(true);
            expect(Number.isFinite(long), `long not numeric: ${c?.long}`).toBe(true);

            expect(lat).toBeGreaterThanOrEqual(LAT_MIN);
            expect(lat).toBeLessThanOrEqual(LAT_MAX);
            expect(long).toBeGreaterThanOrEqual(LONG_MIN);
            expect(long).toBeLessThanOrEqual(LONG_MAX);
        });
    });
});
