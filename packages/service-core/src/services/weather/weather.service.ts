import type { DestinationWeatherCacheInput } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import type { DestinationService } from '../destination/destination.service.js';

/**
 * Dependencies for {@link WeatherService}.
 */
export interface WeatherServiceDeps {
    /** Destination service used to read the cached weather behind the public visibility gate. */
    destinationService: DestinationService;
}

/**
 * Reads cached destination weather.
 *
 * The read path delegates to {@link DestinationService.getById} so the existing
 * visibility/permission gate applies (a non-public or missing destination
 * surfaces a `ServiceError`, never leaking weather for hidden destinations).
 */
export class WeatherService {
    private readonly destinationService: DestinationService;

    constructor(deps: WeatherServiceDeps) {
        this.destinationService = deps.destinationService;
    }

    /**
     * Returns the cached current conditions + forecast for a destination.
     *
     * @param actor - The acting (possibly guest) actor.
     * @param input - The destination id to read.
     * @returns The cached weather payload, or `null` when the destination has no
     *   cached weather yet (e.g. no coordinates or the cron has not run).
     * @throws {ServiceError} NOT_FOUND (or the underlying error) when the
     *   destination is not visible to the actor.
     */
    async getCachedWeather(
        actor: Actor,
        input: { destinationId: string }
    ): Promise<DestinationWeatherCacheInput | null> {
        const result = await this.destinationService.getById(actor, input.destinationId);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return result.data?.weatherCurrent ?? null;
    }
}
