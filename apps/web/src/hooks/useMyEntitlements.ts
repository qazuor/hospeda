import type { VerticalEnum } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import {
    clearEntitlementsCache as clearSharedEntitlementsCache,
    getEntitlementsCached
} from '@/lib/entitlements-cache';

export interface UseMyEntitlementsParams {
    readonly vertical: `${VerticalEnum}`;
    readonly skip?: boolean;
}
export interface UseMyEntitlementsReturn {
    readonly has: (key: string) => boolean;
    readonly limit: (key: string) => number;
    readonly isLoading: boolean;
    readonly error: Error | null;
}
export function clearEntitlementsCache(): void {
    clearSharedEntitlementsCache();
}

export function useMyEntitlements({
    vertical,
    skip = false
}: UseMyEntitlementsParams): UseMyEntitlementsReturn {
    // Hydration-safe: the server and first browser render both begin loading; read cache after hydration (HOS-85).
    const [data, setData] = useState<EntitlementsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    const { data: session, isPending: isSessionPending } = useSession();
    const hasSession = !!session;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    useEffect(() => {
        if (skip) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        if (isSessionPending) return;
        if (!hasSession) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        getEntitlementsCached({ vertical }).then((result) => {
            if (cancelled || !mountedRef.current) return;
            setData(result.failed ? null : result);
            setError(result.failed ? new Error('') : null);
            setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [vertical, isSessionPending, hasSession, skip]);

    const has = useCallback(
        (key: string) => !data?.failed && (data?.entitlements[key] ?? 0) > 0,
        [data]
    );
    const limit = useCallback((key: string) => data?.limits[key] ?? 0, [data]);
    return { has, limit, isLoading, error };
}
