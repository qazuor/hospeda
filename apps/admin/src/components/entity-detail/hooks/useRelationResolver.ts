/**
 * Hook to resolve relation field names from IDs
 *
 * This hook takes relation field configurations and resolves the display names
 * for relation IDs by making additional API calls.
 */
import { fetchApi } from '@/lib/api/client';
import { useQueries } from '@tanstack/react-query';
import { type FieldConfig, FieldType } from '../types';

type RelationData = {
    [fieldName: string]: {
        id: string;
        name: string;
    } | null;
};

type UseRelationResolverProps = {
    /** Entity data containing relation IDs */
    data: Record<string, unknown>;
    /** Field configurations to identify relation fields */
    fields: FieldConfig[];
};

/**
 * Hook to resolve relation field display names
 */
export const useRelationResolver = ({ data, fields }: UseRelationResolverProps) => {
    // Get all relation fields that have IDs in the data
    const relationFields = fields.filter(
        (field) =>
            field.type === FieldType.RELATION &&
            field.relationConfig &&
            data[field.name] &&
            typeof data[field.name] === 'string' // Only resolve if we have an ID string
    );

    // Create queries for each relation field
    const queries = useQueries({
        queries: relationFields.map((field) => ({
            queryKey: ['relation', field.relationConfig?.endpoint, data[field.name]],
            queryFn: async () => {
                const endpoint = field.relationConfig?.endpoint;
                const id = data[field.name] as string;

                if (!endpoint) return null;

                try {
                    // Try to get the specific item by ID
                    const { data: response } = await fetchApi<unknown>({
                        path: `${endpoint}/${id}`,
                        method: 'GET'
                    });

                    // Handle different response structures
                    let item = response;
                    if (response && typeof response === 'object' && 'data' in response) {
                        item = (response as { data: unknown }).data;
                    }

                    if (item && typeof item === 'object') {
                        const itemObj = item as Record<string, unknown>;
                        const displayField = field.relationConfig?.displayField || 'name';

                        return {
                            id: String(itemObj.id || id),
                            name: String(
                                itemObj[displayField] || itemObj.name || itemObj.title || 'Unknown'
                            )
                        };
                    }

                    return null;
                } catch (error) {
                    console.warn(`Failed to resolve relation ${field.name}:`, error);
                    return null;
                }
            },
            enabled: !!data[field.name],
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1
        }))
    });

    // Build the resolved relations object
    const resolvedRelations: RelationData = {};
    relationFields.forEach((field, index) => {
        const query = queries[index];
        resolvedRelations[field.name] = query.data || null;
    });

    // Check if all queries are done loading
    const isLoading = queries.some((query) => query.isLoading);
    const hasErrors = queries.some((query) => query.isError);

    return {
        resolvedRelations,
        isLoading,
        hasErrors
    };
};
