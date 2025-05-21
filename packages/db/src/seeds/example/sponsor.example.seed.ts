import { logger } from '@repo/logger';
import { ClientTypeEnum, StateEnum } from '@repo/types';
import { eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { postSponsors, users } from '../../schema';

/**
 * Seeds example post sponsors
 */
export async function seedSponsors() {
    logger.info('Starting to seed example sponsors', 'seedSponsors');

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
            logger.info('Example sponsors already exist, skipping', 'seedSponsors');
            return;
        }

        // Define example sponsors
        const sponsors = [
            {
                name: 'sponsor-example-entrerriano',
                displayName: 'Turismo Entrerriano',
                description: 'Agencia de promoción turística de Entre Ríos',
                type: ClientTypeEnum.ADVERTISER,
                logo: 'https://images.pexels.com/photos/675764/pexels-photo-675764.jpeg',
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
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Sponsor creado para pruebas y demo',
                    favorite: true
                },
                createdById: adminUser.id,
                updatedById: adminUser.id
            },
            {
                name: 'sponsor-example-termal',
                displayName: 'Termas Unidas',
                description: 'Asociación de complejos termales de Entre Ríos',
                type: ClientTypeEnum.POST_SPONSOR,
                logo: 'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
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
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Sponsor de prueba para contenido relacionado con termas',
                    favorite: true
                },
                createdById: adminUser.id,
                updatedById: adminUser.id
            },
            {
                name: 'sponsor-example-gastronomia',
                displayName: 'Sabores del Litoral',
                description: 'Red de restaurantes y productores gastronómicos de Entre Ríos',
                type: ClientTypeEnum.POST_SPONSOR,
                logo: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg',
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
                state: StateEnum.ACTIVE,
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
            logger.info(`Created sponsor: ${sponsor.displayName}`, 'seedSponsors');
        }

        logger.info('Successfully seeded example sponsors', 'seedSponsors');
    } catch (error) {
        logger.error('Failed to seed example sponsors', 'seedSponsors', error);
        throw error;
    }
}
