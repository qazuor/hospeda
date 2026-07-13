import type { DestinationModel, DrizzleClient } from '@repo/db';
import type { Destination, DestinationWeatherCacheInput } from '@repo/schemas';
import type { OpenMeteoClient } from './clients/open-meteo.client.js';

/**
 * Dependencies for {@link WeatherFetcher}.
 */
export interface WeatherFetcherDeps {
    openMeteoClient: OpenMeteoClient;
    destinationModel: DestinationModel;
}

/**
 * Summary of a {@link WeatherFetcher.fetchAndStoreAll} run.
 */
export interface WeatherFetchSummary {
    /** Destinations considered (published, with coordinates). */
    processed: number;
    /** Destinations whose cache was successfully refreshed (0 in dry-run). */
    updated: number;
    /** Per-destination failures; the run continues past each. */
    errors: ReadonlyArray<{ destinationId: string; slug: string; error: string }>;
}

const PAGE_SIZE = 200;

/**
 * Outcome of fetching a single destination's forecast: either a validated
 * weather payload ready to persist, or an error to surface in the run summary.
 *
 * Exported (not just an internal detail) because it is the contract between
 * {@link WeatherFetcher.fetchAll} and {@link WeatherFetcher.persist} — the
 * cron job calls both separately so it can wrap ONLY `persist()` in a
 * transaction.
 */
export interface DestinationFetchResult {
    destination: Destination;
    weather: DestinationWeatherCacheInput | null;
    error?: string;
}

/**
 * Refreshes the cached Open-Meteo weather for every published destination that
 * has coordinates, writing the payload to the `weather_current` column.
 *
 * Mirrors the exchange-rate fetcher pattern: a plain class (no permission layer)
 * driven by the cron job, tolerant of per-destination failures.
 */
export class WeatherFetcher {
    private readonly openMeteoClient: OpenMeteoClient;
    private readonly destinationModel: DestinationModel;

    constructor(deps: WeatherFetcherDeps) {
        this.openMeteoClient = deps.openMeteoClient;
        this.destinationModel = deps.destinationModel;
    }

    /**
     * Phase 1 — lists published (ACTIVE + PUBLIC) destinations with
     * coordinates and fetches each one's Open-Meteo forecast.
     *
     * Pure read + remote I/O: no DB writes happen here, and — critically —
     * callers MUST NOT wrap this call in a database transaction. Each
     * destination is an independent HTTP request (up to 10s, timeout) to
     * Open-Meteo; holding a transaction's connection open across that many
     * sequential `fetch()` calls is what previously tripped Postgres's
     * `idle_in_transaction_session_timeout` in production. See
     * `packages/service-core/CLAUDE.md`: external API calls MUST stay
     * OUTSIDE the transaction callback.
     *
     * @returns One {@link DestinationFetchResult} per considered destination,
     *   to be passed to {@link persist}.
     */
    async fetchAll(): Promise<DestinationFetchResult[]> {
        const destinations = await this.listPublishedWithCoordinates();
        return this.fetchAllForecasts(destinations);
    }

    /**
     * Phase 2 — persists successfully-fetched forecasts. Failed fetches
     * (`weather === null`) are surfaced as per-destination errors and never
     * written. No-op writes (dry run) still count toward `updated`.
     *
     * All writes run inside a single transaction when `input.tx` is
     * provided (all-or-nothing) — pass the transaction client obtained from
     * `withTransaction()` so the caller can also acquire a transaction-scoped
     * advisory lock as that transaction's first statement. Omitting `tx`
     * runs each write standalone against the pooled client.
     *
     * @param results - Output of {@link fetchAll}.
     * @param input.dryRun - When true, does not persist (still returns the
     *   summary that WOULD have been written).
     * @param input.tx - Optional transaction client (passthrough to
     *   `DestinationModel.update`).
     */
    async persist(
        results: DestinationFetchResult[],
        input: { dryRun: boolean; tx?: DrizzleClient }
    ): Promise<WeatherFetchSummary> {
        const errors: Array<{ destinationId: string; slug: string; error: string }> = [];
        let updated = 0;

        for (const { destination, weather, error } of results) {
            if (!weather) {
                errors.push({
                    destinationId: destination.id,
                    slug: destination.slug,
                    error: error ?? 'unknown error'
                });
                continue;
            }

            if (!input.dryRun) {
                await this.destinationModel.update(
                    { id: destination.id },
                    { weatherCurrent: weather },
                    input.tx
                );
            }
            updated += 1;
        }

        return { processed: results.length, updated, errors };
    }

    /**
     * Convenience wrapper composing {@link fetchAll} + {@link persist} with
     * no caller-managed transaction. Intended for tooling that does not need
     * advisory-lock serialization (ad-hoc scripts, tests).
     *
     * The production cron job does NOT use this — it calls `fetchAll()` and
     * `persist()` separately so only the (transaction-scoped advisory lock +
     * writes) critical section is wrapped in `withTransaction()`, while the
     * remote-fetch phase runs with no transaction open at all.
     *
     * @param input.dryRun - When true, fetches but does not persist.
     */
    async fetchAndStoreAll(input: { dryRun: boolean }): Promise<WeatherFetchSummary> {
        const results = await this.fetchAll();
        return this.persist(results, input);
    }

    /**
     * Fetches the Open-Meteo forecast for every given destination.
     * Pure remote I/O — performs no database reads or writes.
     */
    private async fetchAllForecasts(
        destinations: Destination[]
    ): Promise<DestinationFetchResult[]> {
        const results: DestinationFetchResult[] = [];

        for (const destination of destinations) {
            const coordinates = destination.location?.coordinates;
            const latitude = Number.parseFloat(coordinates?.lat ?? '');
            const longitude = Number.parseFloat(coordinates?.long ?? '');
            if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                results.push({ destination, weather: null, error: 'invalid coordinates' });
                continue;
            }

            const { weather, error } = await this.openMeteoClient.fetchForecast({
                latitude,
                longitude
            });
            results.push({
                destination,
                weather,
                error: weather ? undefined : (error ?? 'no weather returned')
            });
        }

        return results;
    }

    /**
     * Enumerates published (ACTIVE + PUBLIC) destinations that carry coordinates,
     * paging through the model until exhausted.
     */
    private async listPublishedWithCoordinates(): Promise<Destination[]> {
        const collected: Destination[] = [];
        let page = 1;

        while (true) {
            const { items } = await this.destinationModel.findAll(
                { lifecycleState: 'ACTIVE', visibility: 'PUBLIC' },
                { page, pageSize: PAGE_SIZE }
            );
            for (const item of items) {
                const coordinates = item.location?.coordinates;
                if (coordinates?.lat && coordinates?.long) {
                    collected.push(item);
                }
            }
            if (items.length < PAGE_SIZE) {
                break;
            }
            page += 1;
        }

        return collected;
    }
}
