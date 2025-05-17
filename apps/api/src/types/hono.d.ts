// apps/api/src/types/hono.d.ts
import type { UserType } from '@repo/types';

// Extend Hono's Variables type to include our custom properties
declare module 'hono' {
    interface ContextVariableMap {
        user: UserType;
    }
}
