import { useTranslations } from '@repo/i18n';

/**
 * Hook for auth-ui components to use translations with fallbacks
 * Provides a safe way to access translations even if i18n is not available
 */
export const useAuthTranslations = () => {
    try {
        const { t } = useTranslations();
        return {
            t: (key: string, params?: Record<string, string | number>) => {
                try {
                    // biome-ignore lint/suspicious/noExplicitAny: i18n type compatibility
                    return t(key as any, params);
                } catch {
                    return getFallbackText(key, params);
                }
            },
            isI18nAvailable: true
        };
    } catch {
        // Fallback when i18n is not available
        return {
            t: (key: string, params?: Record<string, string | number>) =>
                getFallbackText(key, params),
            isI18nAvailable: false
        };
    }
};

/**
 * Fallback translations in Spanish when i18n is not available
 */
const getFallbackText = (key: string, params?: Record<string, string | number>): string => {
    const fallbacks: Record<string, string> = {
        // Sign In
        'auth-ui.signIn.title': 'Iniciar sesión',
        'auth-ui.signIn.subtitle': 'Accedé a tu cuenta',
        'auth-ui.signIn.email': 'Correo electrónico',
        'auth-ui.signIn.password': 'Contraseña',
        'auth-ui.signIn.emailPlaceholder': 'tu@email.com',
        'auth-ui.signIn.passwordPlaceholder': 'Tu contraseña',
        'auth-ui.signIn.signInButton': 'Iniciar sesión',
        'auth-ui.signIn.signInWithGoogle': 'Continuar con Google',
        'auth-ui.signIn.signInWithFacebook': 'Continuar con Facebook',
        'auth-ui.signIn.or': 'o',
        'auth-ui.signIn.loading': 'Iniciando sesión...',
        'auth-ui.signIn.dontHaveAccount': '¿No tenés cuenta?',
        'auth-ui.signIn.signUpLink': 'Registrate acá',
        'auth-ui.signIn.forgotPassword': '¿Olvidaste tu contraseña?',

        // Sign In Errors
        'auth-ui.signIn.errors.invalidCredentials': 'Credenciales inválidas',
        'auth-ui.signIn.errors.emailRequired': 'El correo electrónico es requerido',
        'auth-ui.signIn.errors.passwordRequired': 'La contraseña es requerida',
        'auth-ui.signIn.errors.invalidEmail': 'Correo electrónico inválido',
        'auth-ui.signIn.errors.accountNotFound': 'Cuenta no encontrada',
        'auth-ui.signIn.errors.tooManyAttempts': 'Demasiados intentos. Intentalo más tarde',
        'auth-ui.signIn.errors.networkError': 'Error de conexión. Verificá tu internet',
        'auth-ui.signIn.errors.unknownError': 'Error desconocido. Intentalo de nuevo',

        // Sign Up
        'auth-ui.signUp.title': 'Crear cuenta',
        'auth-ui.signUp.subtitle': 'Sumate a nuestra plataforma',
        'auth-ui.signUp.firstName': 'Nombre',
        'auth-ui.signUp.lastName': 'Apellido',
        'auth-ui.signUp.email': 'Correo electrónico',
        'auth-ui.signUp.password': 'Contraseña',
        'auth-ui.signUp.confirmPassword': 'Confirmar contraseña',
        'auth-ui.signUp.signUpButton': 'Crear cuenta',
        'auth-ui.signUp.signUpWithGoogle': 'Registrarse con Google',
        'auth-ui.signUp.signUpWithFacebook': 'Registrarse con Facebook',
        'auth-ui.signUp.or': 'o',
        'auth-ui.signUp.loading': 'Creando cuenta...',
        'auth-ui.signUp.alreadyHaveAccount': '¿Ya tenés cuenta?',
        'auth-ui.signUp.signInLink': 'Iniciá sesión acá',
        'auth-ui.signUp.confirmPasswordPlaceholder': 'Repetí tu contraseña',
        'auth-ui.signUp.showPassword': 'Mostrar contraseña',
        'auth-ui.signUp.hidePassword': 'Ocultar contraseña',
        'auth-ui.signUp.strength.weak': 'Débil',
        'auth-ui.signUp.strength.medium': 'Media',
        'auth-ui.signUp.strength.strong': 'Fuerte',
        'auth-ui.signUp.rules.length': 'Mínimo 8 caracteres',
        'auth-ui.signUp.rules.upper': 'Al menos una mayúscula',
        'auth-ui.signUp.rules.lower': 'Al menos una minúscula',
        'auth-ui.signUp.rules.digit': 'Al menos un número',
        'auth-ui.signUp.rules.special': 'Al menos un carácter especial (@$!%*?&)',
        'auth-ui.signUp.errors.passwordsDoNotMatch': 'Las contraseñas no coinciden',

        // User Menu
        'auth-ui.userMenu.welcome': 'Bienvenido',
        'auth-ui.userMenu.profile': 'Mi perfil',
        'auth-ui.userMenu.settings': 'Configuración',
        'auth-ui.userMenu.dashboard': 'Panel de control',
        'auth-ui.userMenu.myAccommodations': 'Mis alojamientos',
        'auth-ui.userMenu.notifications': 'Notificaciones',
        'auth-ui.userMenu.help': 'Ayuda',
        'auth-ui.userMenu.signOut': 'Cerrar sesión',
        'auth-ui.userMenu.loading': 'Cargando...',

        // Sign Out
        'auth-ui.signOut.button': 'Cerrar sesión',
        'auth-ui.signOut.loading': 'Cerrando sesión...',

        // Common
        'auth-ui.common.loading': 'Cargando...',
        'auth-ui.common.error': 'Error',
        'auth-ui.common.retry': 'Reintentar',
        'auth-ui.common.cancel': 'Cancelar',
        'auth-ui.common.continue': 'Continuar',
        'auth-ui.common.back': 'Atrás',
        'auth-ui.common.next': 'Siguiente',
        'auth-ui.common.close': 'Cerrar'
    };

    let text = fallbacks[key] || key;

    // Simple parameter replacement
    if (params) {
        for (const [paramKey, value] of Object.entries(params)) {
            text = text.replace(`{${paramKey}}`, String(value));
        }
    }

    return text;
};
