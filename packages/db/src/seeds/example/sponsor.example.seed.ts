import { logger } from '@repo/logger';
import { ClientTypeEnum, PreferedContactEnum, StateEnum } from '@repo/types';
import { db } from '../../client';
import { postSponsors } from '../../schema/post_sponsor.dbschema';

/**
 * Seeds example sponsors
 */
export async function seedSponsors(): Promise<void> {
    logger.info('Starting example sponsors seed...', 'seedSponsors');

    try {
        // Check if example sponsors already exist
        const existingSponsors = await db
            .select()
            .from(postSponsors)
            .where((s) => s.name.like('example%'));

        if (existingSponsors.length >= 3) {
            logger.info('Example sponsors already exist, skipping...', 'seedSponsors');
            return;
        }

        // Example sponsor data
        const exampleSponsors = [
            {
                name: 'example_turismo_entrerios',
                displayName: 'Turismo Entre Ríos',
                type: ClientTypeEnum.POST_SPONSOR,
                description: 'Ente oficial de promoción turística de la provincia de Entre Ríos',
                logo: 'https://images.pexels.com/photos/1483070/pexels-photo-1483070.jpeg',
                contact: {
                    personalEmail: 'info@turismoentrerios.com',
                    workPhone: '5493434228950',
                    mobilePhone: '5493434228951',
                    website: 'https://www.entrerios.tur.ar',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.WORK
                },
                social: {
                    facebook: 'https://www.facebook.com/TurismoEntreRios',
                    instagram: 'https://www.instagram.com/turismoentrerios',
                    twitter: 'https://www.twitter.com/TurismoER'
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example government sponsor',
                    favorite: true,
                    tags: ['example', 'seed', 'government']
                }
            },
            {
                name: 'example_termas_federation',
                displayName: 'Complejo Termal Federación',
                type: ClientTypeEnum.ADVERTISER,
                description: 'El mayor complejo termal de la región',
                logo: 'https://images.pexels.com/photos/3042861/pexels-photo-3042861.jpeg',
                contact: {
                    personalEmail: 'reservas@termasfederacion.com',
                    workPhone: '5493456482000',
                    mobilePhone: '5493456482001',
                    website: 'https://www.termasfederacion.com',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.WORK
                },
                social: {
                    facebook: 'https://www.facebook.com/TermasFederacion',
                    instagram: 'https://www.instagram.com/termasfederacion'
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example business sponsor',
                    favorite: true,
                    tags: ['example', 'seed', 'business', 'termas']
                }
            },
            {
                name: 'example_carnaval_gualeguaychu',
                displayName: 'Carnaval de Gualeguaychú',
                type: ClientTypeEnum.ADVERTISER,
                description: 'El carnaval más importante de Argentina',
                logo: 'https://images.pexels.com/photos/13232489/pexels-photo-13232489.jpeg',
                contact: {
                    personalEmail: 'info@carnavaldelpais.com.ar',
                    workPhone: '5493446426345',
                    mobilePhone: '5493446426346',
                    website: 'https://www.carnavaldelpais.com.ar',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.WORK
                },
                social: {
                    facebook: 'https://www.facebook.com/carnavalgualeguaychu',
                    instagram: 'https://www.instagram.com/carnavalgualeguaychu',
                    twitter: 'https://www.twitter.com/carnavalpais'
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example event sponsor',
                    favorite: true,
                    tags: ['example', 'seed', 'event', 'carnival']
                }
            }
        ];

        // Insert example sponsors
        const insertedSponsors = await db.insert(postSponsors).values(exampleSponsors).returning();

        logger.query(
            'insert',
            'post_sponsors',
            { count: exampleSponsors.length },
            { count: Array.isArray(insertedSponsors) ? insertedSponsors.length : 0 }
        );
        logger.info(
            `Created ${Array.isArray(insertedSponsors) ? insertedSponsors.length : 0} example sponsors successfully`,
            'seedSponsors'
        );
    } catch (error) {
        logger.error('Failed to seed example sponsors', 'seedSponsors', error);
        throw error;
    }
}
