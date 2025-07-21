import path from 'node:path';
import { AccommodationService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import { getSuperAdminActor } from '../utils/actor.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedContext } from '../utils/seedContext.js';
import { seedRunner } from '../utils/seedRunner.js';
import { summaryTracker } from '../utils/summaryTracker.js';

const getNormalizedAccommodation = (accommodationData: Record<string, unknown>) => {
    return {
        slug: accommodationData.slug as string,
        name: accommodationData.name as string,
        summary: accommodationData.summary as string,
        description: accommodationData.description as string,
        type: accommodationData.type,
        price: accommodationData.price,
        capacity: accommodationData.capacity,
        amenities: accommodationData.amenities,
        features: accommodationData.features,
        location: accommodationData.location,
        media: accommodationData.media,
        seo: accommodationData.seo,
        destinationId: accommodationData.destinationId,
        ownerId: accommodationData.ownerId,
        visibility: accommodationData.visibility,
        lifecycleState: accommodationData.lifecycleState
    };
};

export async function seedAccommodations(context: SeedContext) {
    const entity = 'Accommodations';
    const folder = path.resolve('src/data/accommodation');
    const files = exampleManifest.accommodations;

    // Carga de los archivos listados
    const accommodations = await loadJsonFiles(folder, files);

    await seedRunner({
        entityName: entity,
        items: accommodations,
        context,
        async process(accommodation: unknown, _i) {
            const accommodationService = new AccommodationService({});

            // Convertir el alojamiento del JSON a la estructura esperada por el servicio
            const accommodationInput = getNormalizedAccommodation(
                accommodation as Record<string, unknown>
            );

            // biome-ignore lint/suspicious/noExplicitAny: Service input type is complex, using any for now
            await accommodationService.create(getSuperAdminActor(), accommodationInput as any);
            summaryTracker.trackSuccess(entity);
        },
        onError(_item, i, err) {
            summaryTracker.trackError(entity, files[i] || 'unknown', err.message);
        }
    });
}
