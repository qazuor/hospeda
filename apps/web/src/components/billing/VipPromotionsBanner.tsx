/**
 * VIP Promotions Banner Component
 *
 * Displays exclusive VIP promotions with EntitlementGate protection.
 * Shows an upgrade fallback for users without VIP access.
 *
 * @module components/billing/VipPromotionsBanner
 */

import { EntitlementGate } from '@qazuor/qzpay-react';
import { UpgradeFallback } from './UpgradeFallback';

/**
 * VipPromotionsBanner Component
 *
 * Displays VIP promotions section with entitlement-based access control.
 * Users without VIP access see an upgrade fallback message.
 *
 * Features:
 * - Entitlement-gated content (vip-promotions-access)
 * - Upgrade fallback for non-VIP users
 * - Call-to-action link to VIP promotions page
 * - Visual purple theme matching VIP branding
 *
 * @example
 * ```tsx
 * import { VipPromotionsBanner } from '@/components/billing';
 *
 * <VipPromotionsBanner />
 * ```
 *
 * @returns JSX element representing the VIP promotions banner
 */
export function VipPromotionsBanner() {
    return (
        <EntitlementGate
            entitlementKey="vip-promotions-access"
            fallback={
                <UpgradeFallback
                    featureName="Promociones VIP exclusivas"
                    requiredPlan="Tourist VIP"
                    upgradeLink="/precios/turistas"
                    description="Accedé a descuentos y ofertas exclusivas de alojamientos solo para miembros VIP."
                />
            }
        >
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 text-center">
                <h3 className="mb-2 font-semibold text-lg text-purple-900">
                    Promociones VIP Disponibles
                </h3>
                <p className="text-purple-700">
                    Accedé a descuentos y ofertas exclusivas de alojamientos solo para miembros VIP.
                </p>
                <a
                    href="/mi-cuenta/promociones"
                    className="mt-4 inline-block rounded-lg bg-purple-600 px-6 py-2 text-white transition-colors hover:bg-purple-700"
                >
                    Ver promociones
                </a>
            </div>
        </EntitlementGate>
    );
}
