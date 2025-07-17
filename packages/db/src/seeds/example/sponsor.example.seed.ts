import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { postSponsors, users } from '../../schema';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds example post sponsors
 */
export async function seedSponsors() {
    dbLogger.info({ location: 'seedSponsors' }, 'Starting to seed example sponsors');

    try {
        const db = getDb();

        // Get admin user for ownership
        const [adminUser] = await db.select().from(users).where(eq(users.userName, 'admin'));

        if (!adminUser) {
            throw new Error('Admin user not found. Please seed users first.');
        }

        // Check if example sponsors already exist
        const existingSponsors = await db
            .select()
            .from(postSponsors)
            .where(ilike(postSponsors.name, 'sponsor-example-entrerriano'));

        if (existingSponsors.length > 0) {
            dbLogger.info({ location: 'seedSponsors' }, 'Example sponsors already exist, skipping');
            return;
        }

        // Define example sponsors
        const sponsors = [
            {
                name: 'Turismo Entrerriano',
                description: 'Agencia de promoción turística de Entre Ríos',
                type: ClientTypeEnum.ADVERTISER,
                logo: {
                    url: 'https://images.pexels.com/photos/675764/pexels-photo-675764.jpeg',
                    caption: 'Turismo Entrerriano logo',
                    state: LifecycleStatusEnum.ACTIVE
                },
                social: {
                    facebook: 'https://facebook.com/turismoentrerriano',
                    instagram: 'https://instagram.com/turismo_entrerriano',
                    twitter: 'https://twitter.com/turismo_er'
                },
                contact: {
                    personalEmail: 'info@turismoentrerriano.com.ar',
                    workEmail: 'prensa@turismoentrerriano.com.ar',
                    mobilePhone: '+5493442987654',
                    website: 'https://www.turismoentrerriano.com.ar',
                    preferredEmail: 'WORK',
                    preferredPhone: 'MOBILE'
                },
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                adminInfo: {
                    notes: 'Sponsor creado para pruebas y demo',
                    favorite: true
                },
                createdById: adminUser.id,
                updatedById: adminUser.id
            },
            {
                name: 'Termas Unidas',
                description: 'Asociación de complejos termales de Entre Ríos',
                type: ClientTypeEnum.POST_SPONSOR,
                logo: {
                    url: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
                    caption: 'Termas Unidas logo',
                    state: LifecycleStatusEnum.ACTIVE
                },
                social: {
                    facebook: 'https://facebook.com/termasunidas',
                    instagram: 'https://instagram.com/termas_unidas'
                },
                contact: {
                    personalEmail: 'contacto@termasunidas.com.ar',
                    mobilePhone: '+5493456123789',
                    website: 'https://www.termasunidas.com.ar',
                    preferredEmail: 'HOME',
                    preferredPhone: 'MOBILE'
                },
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                adminInfo: {
                    notes: 'Sponsor de prueba para contenido relacionado con termas',
                    favorite: true
                },
                createdById: adminUser.id,
                updatedById: adminUser.id
            },
            {
                name: 'Sabores del Litoral',
                description: 'Red de restaurantes y productores gastronómicos de Entre Ríos',
                type: ClientTypeEnum.POST_SPONSOR,
                logo: {
                    url: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg',
                    caption: 'Sabores del Litoral logo',
                    state: LifecycleStatusEnum.ACTIVE
                },
                social: {
                    facebook: 'https://facebook.com/saboresdellitoral',
                    instagram: 'https://instagram.com/sabores_litoral'
                },
                contact: {
                    personalEmail: 'info@saboresdellitoral.com.ar',
                    mobilePhone: '+5493442567890',
                    website: 'https://www.saboresdellitoral.com.ar',
                    preferredEmail: 'HOME',
                    preferredPhone: 'MOBILE'
                },
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                adminInfo: {
                    notes: 'Sponsor para contenido gastronómico y culinario',
                    favorite: true
                },
                createdById: adminUser.id,
                updatedById: adminUser.id
            }
        ];

        // Insert the sponsors
        for (const sponsor of sponsors) {
            await db.insert(postSponsors).values(sponsor);
            dbLogger.info({ location: 'seedSponsors' }, `Created sponsor: ${sponsor.displayName}`);
        }

        dbLogger.info({ location: 'seedSponsors' }, 'Successfully seeded example sponsors');
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed example sponsors in seedSponsors');
        throw error;
    }
}
