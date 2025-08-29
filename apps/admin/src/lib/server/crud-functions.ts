/**
 * @file Generic CRUD Server Functions
 *
 * This file was simplified to focus on entity-specific implementations.
 * See accommodations-simple-functions.ts for the working pattern.
 *
 * For new entities, follow the pattern:
 * 1. Create entity-specific server functions with createServerFn
 * 2. Use direct Zod schemas for validation
 * 3. Create corresponding hooks with TanStack Query
 * 4. Keep types simple and explicit
 */

// This file is intentionally minimal - use entity-specific implementations
export const CRUD_PATTERN_DOCUMENTATION = `
Pattern for new entities:

1. Create {entity}-simple-functions.ts with:
   - Direct createServerFn calls
   - Explicit Zod validation
   - Simple return types with satisfies

2. Create use{Entity}Simple.ts with:
   - TanStack Query hooks
   - Proper error handling
   - Cache key management

3. Follow accommodations example for structure
`;
