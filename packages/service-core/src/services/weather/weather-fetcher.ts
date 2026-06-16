import type { DestinationModel } from '@repo/db';
import type { Destination } from '@repo/schemas';
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
    errors: ReadonlyArray<{ destinationId: string; error: string }>;
}

const PAGE_SIZE = 200;

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
     * Fetches and stores current conditions + 16-day forecast for all published
     * destinations with coordinates.
     *
     * @param input.dryRun - When true, fetches but does not persist.
     */
    async fetchAndStoreAll(input: { dryRun: boolean }): Promise<WeatherFetchSummary> {
        const destinations = await this.listPublishedWithCoordinates();
        const errors: Array<{ destinationId: string; error: string }> = [];
        let updated = 0;

        for (const destination of destinations) {
            const coordinates = destination.location?.coordinates;
            const latitude = Number.parseFloat(coordinates?.lat ?? '');
            const longitude = Number.parseFloat(coordinates?.long ?? '');
            if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                errors.push({ destinationId: destination.id, error: 'invalid coordinates' });
                continue;
            }

            const { weather, error } = await this.openMeteoClient.fetchForecast({
                latitude,
                longitude
            });
            if (!weather) {
                errors.push({
                    destinationId: destination.id,
                    error: error ?? 'no weather returned'
                });
                continue;
            }

            if (!input.dryRun) {
                await this.destinationModel.update(
                    { id: destination.id },
                    { weatherCurrent: weather }
                );
            }
            updated += 1;
        }

        return { processed: destinations.length, updated, errors };
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
