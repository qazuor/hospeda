import { Tabs } from 'expo-router';
import { BuildingsIcon, ChatCircleIcon, HouseIcon } from '../../src/components/icons';
import { theme } from '../../src/design';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';

/**
 * Host group layout — Tabs navigator (SPEC-243 T-040 / T-043).
 *
 * Three tabs:
 * - Inicio (index) — host dashboard
 * - Fichas (accommodations) — host-scoped accommodation list
 * - Consultas (conversations) — owner conversation inbox + thread
 *
 * Tab labels come from `mobile.host.tabs.*` i18n keys.
 * Tab icons from the icons barrel (HouseIcon / BuildingsIcon / ChatCircleIcon).
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
            <Tabs.Screen
                name="conversations"
                options={{
                    title: t('mobile.host.tabs.conversations'),
                    tabBarIcon: ({ color, size }) => (
                        <ChatCircleIcon
                            color={color as string}
                            size={size}
                            weight="regular"
                        />
                    )
                }}
            />
            {/* Metrics screen — navigable via router.push but NOT a visible tab */}
            <Tabs.Screen
                name="metrics"
                options={{ href: null }}
            />
        </Tabs>
    );
}
