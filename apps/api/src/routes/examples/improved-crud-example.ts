/**
 * Example of using the improved createCRUDRoute factory
 * Demonstrates the enhanced type safety and middleware options
 */

import { z } from '@hono/zod-openapi';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Example schemas for demonstration
 */
const TaskSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    completed: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

const CreateTaskSchema = TaskSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

const UpdateTaskSchema = CreateTaskSchema.partial();

/**
 * Example: Create task endpoint with improved type safety
 */
export const createTaskRoute = createCRUDRoute({
    method: 'post',
    path: '/tasks',
    summary: 'Create a new task',
    description: 'Creates a new task with the provided data',
    tags: ['Tasks'],
    requestBody: CreateTaskSchema,
    responseSchema: TaskSchema,
    handler: async (_ctx, _params, body) => {
        // ✅ body is now properly typed and validated
        const taskData = body as z.infer<typeof CreateTaskSchema>;

        // Mock task creation
        const newTask = {
            id: crypto.randomUUID(),
            ...taskData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return newTask;
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});

/**
 * Example: Update task endpoint with params validation
 */
export const updateTaskRoute = createCRUDRoute({
    method: 'put',
    path: '/tasks/{id}',
    summary: 'Update a task',
    description: 'Updates an existing task with the provided data',
    tags: ['Tasks'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: UpdateTaskSchema,
    responseSchema: TaskSchema,
    handler: async (_ctx, params, body) => {
        // ✅ params and body are now properly typed
        const { id } = params as { id: string };
        const updates = body as z.infer<typeof UpdateTaskSchema>;

        // Mock task update
        const updatedTask = {
            id,
            title: updates.title || 'Default Title',
            description: updates.description || 'Default Description',
            completed: updates.completed || false,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: new Date().toISOString()
        };

        return updatedTask;
    }
});

/**
 * Example: Get task by ID with custom middleware
 */
export const getTaskRoute = createCRUDRoute({
    method: 'get',
    path: '/tasks/{id}',
    summary: 'Get a task by ID',
    description: 'Retrieves a specific task by its ID',
    tags: ['Tasks'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: TaskSchema,
    handler: async (_ctx, params) => {
        // ✅ params is properly typed
        const { id } = params as { id: string };

        // Mock task retrieval
        const task = {
            id,
            title: 'Sample Task',
            description: 'This is a sample task',
            completed: false,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        };

        return task;
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 500, windowMs: 60000 } // Higher limit for reads
    }
});

/**
 * Example: Delete task endpoint
 */
export const deleteTaskRoute = createCRUDRoute({
    method: 'delete',
    path: '/tasks/{id}',
    summary: 'Delete a task',
    description: 'Deletes a specific task by its ID',
    tags: ['Tasks'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (_ctx, params) => {
        // ✅ params is properly typed
        const { id } = params as { id: string };

        // Mock task deletion
        return {
            success: true,
            message: `Task ${id} deleted successfully`
        };
    }
});
