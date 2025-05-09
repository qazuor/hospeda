import type { Env } from '@/types';
import { logger } from '@repo/logger';
import type { Accommodation } from '@repo/types';
import { Hono } from 'hono';

const accommodationRouter = new Hono<Env>();

// Get all accommodations
accommodationRouter.get('/', async (c) => {
    try {
        const accommodations = [
            {
                type: 'apartment',
                id: '1',
                name: 'Sample Accommodation 1',
                displayName: 'My Hotel',
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'active',
                description: 'This is a sample accommodation description.',
                rating: 4.5,
                contactInfo: {
                    email: 'my_hotel@gmail.com',
                    phone: '+1234567890'
                },
                socialNetworks: {
                    facebook: 'https://facebook.com/my_hotel',
                    instagram: 'https://instagram.com/my_hotel',
                    twitter: 'https://twitter.com/my_hotel'
                },
                price: {
                    basePrice: 100,
                    currency: 'USD',
                    additionalFees: {
                        cleaning: 20,
                        service: 10,
                        taxPercentage: 5
                    },
                    discounts: {
                        lastMinute: 10,
                        weekly: 15,
                        monthly: 20
                    }
                },
                availability: {
                    startDate: '2023-10-01',
                    endDate: '2023-10-31',
                    availableDates: [{ from: new Date(), to: new Date() }]
                },
                ownerId: 'owner_1',
                location: {
                    latitude: 40.7128,
                    longitude: -74.006
                },
                amenities: ['WiFi', 'Parking', 'Pool'],
                images: ['image1.jpg', 'image2.jpg']
            } as Accommodation
        ];
        return c.json({
            success: true,
            data: accommodations
        });
    } catch (error) {
        logger.error(`Get accommodations error: ${(error as Error).message}`);
        return c.json(
            {
                success: false,
                message: (error as Error).message
            },
            500
        );
    }
});

// Get accommodation by ID
accommodationRouter.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const accommodation = {
            id,
            name: 'Sample Accommodation',
            description: 'This is a sample accommodation.',
            location: 'Sample Location',
            price: 100,
            amenities: ['WiFi', 'Parking', 'Pool'],
            images: ['image1.jpg', 'image2.jpg'],
            rating: 4.5
        };

        if (!accommodation) {
            return c.json(
                {
                    success: false,
                    message: 'Accommodation not found'
                },
                404
            );
        }

        return c.json({
            success: true,
            data: accommodation
        });
    } catch (error) {
        logger.error(`Get accommodation error: ${(error as Error).message}`);
        return c.json(
            {
                success: false,
                message: (error as Error).message
            },
            500
        );
    }
});

export { accommodationRouter };
