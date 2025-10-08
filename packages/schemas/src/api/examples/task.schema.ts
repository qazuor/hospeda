import { z } from 'zod';

/**
 * Example API Schemas
 *
 * Schemas for example/demo endpoints used for testing and documentation.
 * These schemas demonstrate patterns and best practices for the API.
 */

// ============================================================================
// TASK EXAMPLE SCHEMAS
// ============================================================================

/**
 * Example task schema for CRUD demonstrations
 * Shows typical entity structure with id, timestamps, and business fields
 */
export const ExampleTaskSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    completed: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

/**
 * Schema for creating a new task
 * Omits auto-generated fields (id, timestamps)
 */
export const ExampleTaskCreateSchema = ExampleTaskSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for updating an existing task
 * Makes all fields optional except for timestamps
 */
export const ExampleTaskUpdateSchema = ExampleTaskSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
}).partial();

export type ExampleTask = z.infer<typeof ExampleTaskSchema>;
export type ExampleTaskCreate = z.infer<typeof ExampleTaskCreateSchema>;
export type ExampleTaskUpdate = z.infer<typeof ExampleTaskUpdateSchema>;
