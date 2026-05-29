import { useHasRole } from '@/hooks/use-auth-context';
import { RoleEnum } from '@repo/schemas';

/**
 * Whether the current user should see entitlement gates (Premium upsell,
 * limit warnings, gated sections).
 *
 * Per spec §4.7 of the entity view/edit redesign:
 *
 * > El **host** sin plan ve los gates con upsell; el **staff/admin** no
 * > tiene plan → **ve todo habilitado, sin gating**.
 *
 * Staff roles (ADMIN, SUPER_ADMIN, EDITOR, CLIENT_MANAGER) reach the same
 * endpoints with full permissions but have no plan in the billing sense, so
 * surfacing "Mejorar plan" CTAs at them is misleading. The gate components
 * stay agnostic; consumers decide whether to bypass them based on this hook.
 *
 * @returns `true` only when the user is a HOST and gates should apply.
 */
export function useShouldShowEntitlementGates(): boolean {
    return useHasRole(RoleEnum.HOST);
}
