import { Tabs } from 'expo-router';
import { BuildingsIcon, HouseIcon } from '../../src/components/icons';
import { theme } from '../../src/design';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';

/**
 * Host group layout — Tabs navigator (SPEC-243 T-040).
 *
 * Two tabs in this PR:
 * - Inicio (index) — host dashboard
 * - Fichas (accommodations) — host-scoped accommodation list
 *
 * Tab labels come from `mobile.host.tabs.*` i18n keys.
 * Tab icons from the icons barrel (HouseIcon / BuildingsIcon).
 *
 * Expo Router requires a **default export** for route files.
 */
export default function HostLayout() {
    const t = (key: string) => getTranslation(key, appDefaultLocale);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.river[500],
                tabBarInactiveTintColor: theme.colors.neutral[400],
                tabBarStyle: {
                    backgroundColor: theme.colors.semantic.background,
                    borderTopColor: theme.colors.semantic.border
                },
                tabBarLabelStyle: {
                    fontSize: theme.typography.semantic.caption,
                    fontWeight: '600'
                }
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('mobile.host.tabs.home'),
                    tabBarIcon: ({ color, size }) => (
                        <HouseIcon
                            color={color as string}
                            size={size}
                            weight="regular"
                        />
                    )
                }}
            />
            <Tabs.Screen
                name="accommodations"
                options={{
                    title: t('mobile.host.tabs.accommodations'),
                    tabBarIcon: ({ color, size }) => (
                        <BuildingsIcon
                            color={color as string}
                            size={size}
                            weight="regular"
                        />
                    )
                }}
            />
        </Tabs>
    );
}
