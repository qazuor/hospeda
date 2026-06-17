import { Tabs } from 'expo-router';
import { HouseIcon, UserIcon } from '../../src/components/icons';
import { theme } from '../../src/design';
import { getTranslation } from '../../src/lib/i18n';
import { useLocale } from '../../src/lib/locale-context';

/**
 * Tourist group layout — Tabs navigator (SPEC-243 T-050).
 *
 * Two tabs:
 * - Inicio (index) — tourist home
 * - Perfil (profile) — account, settings, language, sign-out
 *
 * Converted from a Stack placeholder to Tabs as part of Sub-4 (T-050).
 * Tab labels come from `mobile.tourist.tabs.*` i18n keys resolved via the
 * runtime locale from `useLocale()`.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 */
export default function TouristLayout() {
    const { locale } = useLocale();
    const t = (key: string) => getTranslation(key, locale);

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
                    title: t('mobile.tourist.tabs.home'),
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
                name="profile"
                options={{
                    title: t('mobile.tourist.tabs.profile'),
                    tabBarIcon: ({ color, size }) => (
                        <UserIcon
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
