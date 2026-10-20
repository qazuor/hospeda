import { DestinationModel, UserModel } from '@repo/db';
import type { Destination, User } from '@repo/schemas';

/**
 * E2E test data seeding helpers
 * Provides utilities to create test data for E2E scenarios
 *
 * (The billing plan/price factories this module used to carry were removed
 * with the legacy billing system, HOS-1416.)
 */

/**
 * Create a test user with optional overrides
 * @param overrides - Partial user data to override defaults
 * @returns Created user
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
    const userModel = new UserModel();

    const timestamp = Date.now();
    const defaultData = {
        authProviderId:
            (overrides as Record<string, unknown>)?.authProviderId || `test_auth_${timestamp}`,
        email:
            (overrides as Record<string, unknown>)?.email || `test-user-${timestamp}@example.com`,
        slug: overrides?.slug || `test-user-${timestamp}`,
        firstName: overrides?.firstName || 'Test',
        lastName: overrides?.lastName || 'User',
        // HOS-296: `users.role` no longer exists — a test user's hats are rows
        // in `user_role`, granted with `grantRole` when a test needs them.
        permissions: overrides?.permissions || [],
        settings: overrides?.settings || {
            notifications: {
                enabled: true,
                allowEmails: true,
                allowSms: false,
                allowPush: false
            }
        },
        ...overrides
    };

    const result = await userModel.create(defaultData as any);
    return result as User;
}

/**
 * Create a test destination with optional overrides
 * @param overrides - Partial destination data to override defaults
 * @returns Created destination
 */
export async function createTestDestination(
    overrides?: Partial<Destination>
): Promise<Destination> {
    const destinationModel = new DestinationModel();

    const timestamp = Date.now();
    const defaultData = {
        name: overrides?.name || `Test Destination ${timestamp}`,
        slug: overrides?.slug || `test-destination-${timestamp}`,
        summary: overrides?.summary || {
            en: 'A beautiful test destination for E2E testing',
            es: 'Un hermoso destino de prueba para testing E2E'
        },
        description: overrides?.description || {
            en: 'This is a test destination created for E2E testing purposes. It has all the necessary data to validate our API endpoints.',
            es: 'Este es un destino de prueba creado para propósitos de testing E2E. Tiene todos los datos necesarios para validar nuestros endpoints de API.'
        },
        ...overrides
    };

    const result = await destinationModel.create(defaultData as any);
    return result as Destination;
}
