import { DestinationReviewSchema } from '@repo/schemas/entities/destination/destination.review.schema.js';
import type { NewDestinationReviewInputType } from '@repo/types';
import type { z } from 'zod';

export const DestinationReviewCreateSchema =
    DestinationReviewSchema as unknown as z.ZodType<NewDestinationReviewInputType>;
