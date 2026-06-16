/**
 * @file derive-destination-climate.ts
 * @description Build-time helper (NOT a runtime dependency) that derives
 * approximate seasonal climate averages for a coordinate from the Open-Meteo
 * historical Archive API (ERA5). Output matches DestinationClimateSchema and is
 * meant to be pasted/merged into the destination seed JSON.
 *
 * Usage:
 *   tsx packages/seed/scripts/derive-destination-climate.ts <lat> <lon> [bestSeason]
 *
 * The derived values are approximate and admin-editable; this script is only a
 * convenience for authoring seed data (SPEC-215, decision 6).
 */

export type ClimateSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface ArchiveDaily {
    readonly time: ReadonlyArray<string>;
    readonly temperature_2m_max: ReadonlyArray<number | null>;
    readonly temperature_2m_min: ReadonlyArray<number | null>;
    readonly precipitation_sum: ReadonlyArray<number | null>;
}

export interface SeasonClimate {
    readonly avgTempMinC: number;
    readonly avgTempMaxC: number;
    readonly rainfallMm: number;
}

export interface DerivedClimate {
    readonly bestSeason: ClimateSeason;
    readonly seasons: Record<ClimateSeason, SeasonClimate>;
}

/**
 * Maps a calendar month (1-12) to a Southern-hemisphere season.
 */
export function monthToSouthernSeason(month: number): ClimateSeason {
    if (month === 12 || month === 1 || month === 2) return 'summer';
    if (month >= 3 && month <= 5) return 'autumn';
    if (month >= 6 && month <= 8) return 'winter';
    return 'spring';
}

interface SeasonAccumulator {
    sumMin: number;
    sumMax: number;
    days: number;
    totalPrecip: number;
}

/**
 * Derives per-season average min/max temperature (integer °C) and average
 * seasonal rainfall (integer mm/season) from daily archive data, and picks a
 * `bestSeason` as the one whose average max temperature is closest to a
 * comfortable 24 °C (tie-broken by lower rainfall).
 *
 * @param input.daily - The Open-Meteo Archive `daily` block.
 * @returns A {@link DerivedClimate} ready to merge into a destination seed.
 */
export function deriveSeasonalClimate({ daily }: { daily: ArchiveDaily }): DerivedClimate {
    const seasons: ClimateSeason[] = ['spring', 'summer', 'autumn', 'winter'];
    const acc: Record<ClimateSeason, SeasonAccumulator> = {
        spring: { sumMin: 0, sumMax: 0, days: 0, totalPrecip: 0 },
        summer: { sumMin: 0, sumMax: 0, days: 0, totalPrecip: 0 },
        autumn: { sumMin: 0, sumMax: 0, days: 0, totalPrecip: 0 },
        winter: { sumMin: 0, sumMax: 0, days: 0, totalPrecip: 0 }
    };
    const years = new Set<string>();

    for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        const max = daily.temperature_2m_max[i];
        const min = daily.temperature_2m_min[i];
        const precip = daily.precipitation_sum[i];
        if (!date || max === null || max === undefined || min === null || min === undefined) {
            continue;
        }
        const month = Number.parseInt(date.slice(5, 7), 10);
        years.add(date.slice(0, 4));
        const season = monthToSouthernSeason(month);
        const bucket = acc[season];
        bucket.sumMin += min;
        bucket.sumMax += max;
        bucket.days += 1;
        bucket.totalPrecip += precip ?? 0;
    }

    const numYears = Math.max(1, years.size);
    const result = {} as Record<ClimateSeason, SeasonClimate>;
    for (const season of seasons) {
        const bucket = acc[season];
        const days = Math.max(1, bucket.days);
        result[season] = {
            avgTempMinC: Math.round(bucket.sumMin / days),
            avgTempMaxC: Math.round(bucket.sumMax / days),
            rainfallMm: Math.round(bucket.totalPrecip / numYears)
        };
    }

    const bestSeason = seasons.reduce((best, season) => {
        const scoreOf = (s: ClimateSeason) =>
            Math.abs(result[s].avgTempMaxC - 24) + result[s].rainfallMm / 1000;
        return scoreOf(season) < scoreOf(best) ? season : best;
    }, 'spring' as ClimateSeason);

    return { bestSeason, seasons: result };
}

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Fetches 3 years of daily archive data for a coordinate and derives the
 * seasonal climate. Network-only; used offline to author seeds.
 */
export async function fetchDerivedClimate(input: {
    latitude: number;
    longitude: number;
    startDate?: string;
    endDate?: string;
}): Promise<DerivedClimate> {
    const params = new URLSearchParams({
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        start_date: input.startDate ?? '2021-01-01',
        end_date: input.endDate ?? '2023-12-31',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        timezone: 'auto'
    });
    const response = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Archive API responded ${response.status}`);
    }
    const body = (await response.json()) as { daily: ArchiveDaily };
    return deriveSeasonalClimate({ daily: body.daily });
}

// CLI entry: tsx derive-destination-climate.ts <lat> <lon>
if (process.argv[1]?.includes('derive-destination-climate')) {
    const lat = Number.parseFloat(process.argv[2] ?? '');
    const lon = Number.parseFloat(process.argv[3] ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        process.stderr.write('Usage: tsx derive-destination-climate.ts <lat> <lon>\n');
        process.exit(1);
    }
    fetchDerivedClimate({ latitude: lat, longitude: lon })
        .then((climate) => process.stdout.write(`${JSON.stringify(climate, null, 2)}\n`))
        .catch((error) => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
