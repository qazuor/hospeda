import { useQuery } from '@tanstack/react-query';
import type { GetDestinationsInput, GetDestinationsOutput } from '../api/getDestinations';
import { getDestinations } from '../api/getDestinations';

export type UseDestinationsQueryInput = GetDestinationsInput;

export const useDestinationsQuery = ({ page, pageSize, q, sort }: UseDestinationsQueryInput) =>
    useQuery<GetDestinationsOutput, Error>({
        queryKey: ['destinations', { page, pageSize, q, sort }],
        queryFn: () => getDestinations({ page, pageSize, q, sort }),
        staleTime: 30_000,
        select: (d) => d
    });
