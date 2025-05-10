import type { Env } from '@/types';
import { logger } from '@repo/logger';
import type { AccommodationType } from '@repo/types';
import { Hono } from 'hono';

const accommodationRouter = new Hono<Env>();

// Get all accommodations
accommodationRouter.get('/', async (c) => {
    try {
        const accommodations = [
            {
                // falta poner data
            } as AccommodationType
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
