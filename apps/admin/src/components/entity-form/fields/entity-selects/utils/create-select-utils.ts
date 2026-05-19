/**
 * Factory for entity-select API utilities. Generates `search`, `loadByIds`,
 * and `loadAll` functions for a given admin endpoint, reducing boilerplate
 * across the 5 entity-select wrappers required by SPEC-117 D-RELATIONS.1.
 *
 * The factory supports an optional `/batch` endpoint (POST { ids, fields });
 * when not available, `loadByIds` falls back to N parallel GET-by-id requests,
 * which is cheap because most entity-selects only carry a single initial value.
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

interface CreateSelectUtilsOptions<T extends { id: string }> {
    /** Admin list endpoint, e.g. `/api/v1/admin/accommodations`. */
    readonly endpoint: string;
    /** Builds the option label from an item. */
    readonly buildLabel: (item: T) => string;
    /** Builds the optional option description from an item. */
    readonly buildDescription?: (item: T) => string | undefined;
    /**
     * Optional batch endpoint (POST { ids, fields }). When omitted, falls back
     * to N parallel GET-by-id requests against `${endpoint}/${id}`.
     */
    readonly batchEndpoint?: string;
    /** Fields to request from the batch endpoint when present. */
    readonly batchFields?: readonly string[];
    /** Log prefix for error messages. */
    readonly entityName: string;
}

interface EntitySelectUtils {
    readonly search: (query: string) => Promise<SelectOption[]>;
    readonly loadByIds: (ids: string[]) => Promise<SelectOption[]>;
    readonly loadAll: () => Promise<SelectOption[]>;
}

interface ListResponse<T> {
    data: { items: T[] };
}

interface BatchResponse<T> {
    data: Array<T | null>;
}

interface SingleResponse<T> {
    data: T;
}

export function createSelectUtils<T extends { id: string }>(
    options: CreateSelectUtilsOptions<T>
): EntitySelectUtils {
    const { endpoint, buildLabel, buildDescription, batchEndpoint, batchFields, entityName } =
        options;

    const toOption = (item: T): SelectOption => ({
        value: item.id,
        label: buildLabel(item),
        description: buildDescription?.(item)
    });

    const search = async (query: string): Promise<SelectOption[]> => {
        if (!query.trim()) return [];
        try {
            const response = await fetchApi<ListResponse<T>>({
                path: `${endpoint}?search=${encodeURIComponent(query)}&pageSize=20`,
                method: 'GET'
            });
            const items = response.data.data?.items ?? [];
            return items.map(toOption);
        } catch (error) {
            adminLogger.error(
                `Error searching ${entityName}:`,
                error instanceof Error ? error.message : String(error)
            );
            return [];
        }
    };

    const loadByIds = async (ids: string[]): Promise<SelectOption[]> => {
        if (ids.length === 0) return [];
        try {
            if (batchEndpoint) {
                const response = await fetchApi<BatchResponse<T>>({
                    path: batchEndpoint,
                    method: 'POST',
                    body: { ids, fields: batchFields ?? ['id'] }
                });
                const items = response.data.data ?? [];
                return items.filter((i): i is T => i !== null).map(toOption);
            }

            // Fallback: N parallel getById requests.
            const fetchOne = async (id: string): Promise<T | null> => {
                try {
                    const r = await fetchApi<SingleResponse<T>>({
                        path: `${endpoint}/${id}`,
                        method: 'GET'
                    });
                    return r.data.data ?? null;
                } catch {
                    return null;
                }
            };
            const results: Array<T | null> = await Promise.all(ids.map(fetchOne));
            const validItems = results.filter((i): i is T => i !== null);
            return validItems.map(toOption);
        } catch (error) {
            adminLogger.error(
                `Error loading ${entityName} by IDs:`,
                error instanceof Error ? error.message : String(error)
            );
            return [];
        }
    };

    const loadAll = async (): Promise<SelectOption[]> => {
        try {
            const response = await fetchApi<ListResponse<T>>({
                path: `${endpoint}?pageSize=20`,
                method: 'GET'
            });
            const items = response.data.data?.items ?? [];
            return items.map(toOption);
        } catch (error) {
            adminLogger.error(
                `Error loading initial ${entityName}:`,
                error instanceof Error ? error.message : String(error)
            );
            return [];
        }
    };

    return { search, loadByIds, loadAll };
}
