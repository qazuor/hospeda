import path from 'node:path';
import { UserService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import { getSuperAdminActor } from '../utils/actor.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedContext } from '../utils/seedContext.js';
import { seedRunner } from '../utils/seedRunner.js';
import { summaryTracker } from '../utils/summaryTracker.js';

const getNormalizedUser = (userData: Record<string, unknown>) => {
    return {
        slug: userData.slug as string,
        displayName: userData.displayName as string | undefined,
        firstName: userData.firstName as string | undefined,
        lastName: userData.lastName as string | undefined,
        birthDate: userData.birthDate ? new Date(userData.birthDate as string) : undefined,
        contactInfo: userData.contactInfo,
        location: userData.location,
        socialNetworks: userData.socialNetworks,
        role: userData.role,
        permissions: userData.permissions,
        profile: userData.profile,
        settings: userData.settings,
        lifecycleState: userData.lifecycleState,
        visibility: userData.visibility
    };
};

export async function seedUsers(context: SeedContext) {
    const entity = 'Users';
    const folder = path.resolve('src/data/user/example');
    const files = exampleManifest.users;

    // Carga de los archivos listados
    const users = await loadJsonFiles(folder, files);

    await seedRunner({
        entityName: entity,
        items: users,
        context,
        async process(user: unknown, _i) {
            const userService = new UserService({});

            // Convertir el usuario del JSON a la estructura esperada por el servicio
            const userInput = getNormalizedUser(user as Record<string, unknown>);

            // biome-ignore lint/suspicious/noExplicitAny: Service input type is complex, using any for now
            await userService.create(getSuperAdminActor(), userInput as any);
            summaryTracker.trackSuccess(entity);
        },
        onError(_item, i, err) {
            summaryTracker.trackError(entity, files[i] || 'unknown', err.message);
        }
    });
}
