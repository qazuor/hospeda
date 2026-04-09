/**
 * @fileoverview
 * Type-level tests for `AdminSearchExecuteParams<TEntityFilters>`.
 *
 * These tests verify at compile time:
 * - The default generic resolves to `Record<string, unknown>` for `entityFilters`
 * - Custom generic types are reflected in `entityFilters`
 * - Multiple entity filter fields coexist correctly
 *
 * Uses Vitest's built-in `expectTypeOf` (Vitest 3.x).
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { AdminSearchExecuteParams } from '../../../src/types';

describe('AdminSearchExecuteParams<TEntityFilters>', () => {
    describe('default generic (no type argument)', () => {
        it('should compile without a type argument', () => {
            // Verify that AdminSearchExecuteParams is usable without a type argument
            type DefaultParams = AdminSearchExecuteParams;
            expectTypeOf<DefaultParams['entityFilters']>().toEqualTypeOf<Record<string, unknown>>();
        });
    });

    describe('typed entityFilters — single field', () => {
        it('should expose "email" as string when TEntityFilters = { email: string }', () => {
            type EmailParams = AdminSearchExecuteParams<{ email: string }>;
            expectTypeOf<EmailParams['entityFilters']['email']>().toEqualTypeOf<string>();
        });
    });

    describe('typed entityFilters — multiple fields', () => {
        it('should expose "category" and "minPrice" when both are specified', () => {
            type MultiParams = AdminSearchExecuteParams<{
                category: string;
                minPrice: number;
            }>;
            expectTypeOf<MultiParams['entityFilters']['category']>().toEqualTypeOf<string>();
            expectTypeOf<MultiParams['entityFilters']['minPrice']>().toEqualTypeOf<number>();
        });
    });

    describe('readonly shape', () => {
        it('should expose "where" as Record<string, unknown>', () => {
            type Params = AdminSearchExecuteParams;
            expectTypeOf<Params['where']>().toEqualTypeOf<Record<string, unknown>>();
        });

        it('should expose "pagination" with page and pageSize as number', () => {
            type Params = AdminSearchExecuteParams;
            expectTypeOf<Params['pagination']['page']>().toEqualTypeOf<number>();
            expectTypeOf<Params['pagination']['pageSize']>().toEqualTypeOf<number>();
        });

        it('should expose "sort.sortOrder" as "asc" | "desc"', () => {
            type Params = AdminSearchExecuteParams;
            expectTypeOf<Params['sort']['sortOrder']>().toEqualTypeOf<'asc' | 'desc'>();
        });
    });
});
