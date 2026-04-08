# SPEC-040: Critical Package Coverage -- auth-ui, billing, logger, email

## Metadata

- **ID**: SPEC-040
- **Status**: draft
- **Created**: 2026-03-16
- **Updated**: 2026-03-18
- **Priority**: high
- **Effort**: large (3-4 dias)
- **Owner**: pendiente
- **Deps**: ninguna

---

## Overview

Cuatro packages criticos del monorepo tienen cobertura de tests peligrosamente baja o directamente ausente. Estos packages son utilizados por todas las apps (`admin`, `api`, `web`) y manejan flujos sensibles: autenticacion, pagos, logging e infraestructura de emails. Una falla silenciosa en cualquiera de ellos puede traducirse en perdida de acceso, fraude de pagos, o perdida de trazabilidad en produccion.

Este spec define la estrategia para llevar cada package a una cobertura minima del 90%, con enfasis en los flujos criticos de negocio y los caminos de error.

**Nota importante**: Este spec cubre SOLO tests. No se modifica codigo fuente de los packages, con UNA excepcion: se permite exportar funciones internas de `packages/logger/src/formatter.ts` (`shouldUseWhiteText`, `redactSensitiveData`) para poder testearlas de forma aislada. Fuera de esto, solo se agregan archivos de test y archivos de configuracion (`vitest.config.ts`).

---

## Problem Statement

### Estado actual de cobertura

| Package | Archivos de test | Tests actuales | Cobertura estimada | Riesgo |
|---|---|---|---|---|
| `packages/auth-ui` | 2 (setup + basic) | 4 tests triviales | ~0% codigo real | CRITICO |
| `packages/billing` | 9 archivos | ~2,281 lineas de tests | ~40-50% | ALTO |
| `packages/logger` | 1 archivo | 37 tests | ~60-70% | MEDIO-ALTO |
| `packages/email` | 1 archivo | 7 tests | ~50% codigo real | ALTO |

### Problemas concretos detectados

**auth-ui**: El test actual (`basic.test.tsx`) no importa ni renderiza ningun componente real del package. Prueba un componente inventado (`TestAuthComponent`) y utilidades locales que no existen en el codigo fuente. En la practica, `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `VerifyEmail`, `UserMenu`, `SimpleUserMenu`, `SignOutButton` y el hook `useAuthTranslations` no tienen ningun test. Son componentes React con logica de estado, validacion, manejo de errores y llamadas a Better Auth.. completamente sin cobertura.

**billing**: Los tests existentes (9 archivos, ~2,281 lineas) cubren parcialmente el adaptador de MercadoPago (2 archivos, 45 test cases), la validacion de configuracion (`config-validator` con 622 lineas y 36 escenarios), entitlements (`entitlements.test.ts`, 81 lineas, 9 test cases), config-drift-check (9 test cases), planes (18 test cases), addons (15 test cases), constantes (22 test cases), y sponsorship seeds (11 test cases). La cobertura real es mayor de lo que parece a primera vista, pero quedan gaps en `limits.config.ts` (sin tests directos).

**logger**: El unico archivo de test (`index.test.ts`) tiene 37 tests en 4 suites cubriendo la funcionalidad basica de logging, niveles, categorias, redaccion PII, y truncamiento. Sin embargo, `formatter.ts` (la capa mas critica con logica de redaccion de PII, formateo de objetos, y gestion de chalk) no tiene tests directos. Las funciones publicas `formatValue`, `formatLogMessage`, `formatLogArgs`, `getColorFunction`, `getCategoryBackgroundFunction`, `formatTimestamp` y las funciones privadas `shouldUseWhiteText` y `redactSensitiveData` no estan probadas de forma aislada. **NOTA**: `shouldUseWhiteText` y `redactSensitiveData` son funciones **privadas** (no exportadas). Para poder testearlas de forma aislada, se deben exportar (ver seccion "Excepcion de modificacion de codigo fuente" abajo).

**email**: El test de `sendEmail` tiene buen cubrimiento del camino feliz y errores de red. Lo que falta completamente son tests de los templates React Email (`VerifyEmailTemplate`, `ResetPasswordTemplate`, `BaseLayout`). Tambien falta un test basico para `createEmailClient`.

---

## Scope

### Incluido

- Tests unitarios para TODOS los componentes y hooks de `packages/auth-ui`
- Tests de integracion para el hook `useAuthTranslations` contra el sistema i18n real
- Cobertura de gaps restantes en `packages/billing` (edge cases del adaptador, utilitarios)
- Tests directos para las funciones exportadas de `packages/logger/src/formatter.ts`
- Tests de los modulos `categories.ts`, `config.ts` y `environment.ts` del logger de forma aislada
- Tests de renderizado de templates de `packages/email`
- Test basico de `createEmailClient`
- Actualizacion de coverage thresholds en los `vitest.config.ts` de los 4 packages (NOTA: `packages/email` NO tiene `vitest.config.ts`.. hay que CREAR uno nuevo)
- Instalacion de `@testing-library/user-event` como devDependency en `packages/auth-ui` (actualmente no esta instalado)
- Instalacion de `@react-email/render` como devDependency en `packages/email` (necesario para renderizar templates en tests)
- Exportar `shouldUseWhiteText` y `redactSensitiveData` desde `packages/logger/src/formatter.ts` (unica modificacion de codigo fuente permitida, necesaria para tests unitarios aislados)

### Excluido

- Tests E2E de flujos de autenticacion completos (eso es scope de `apps/web` y `apps/admin`)
- Tests de integracion con MercadoPago real (sandbox).. quedan para SPEC futuro
- Tests de envio real de emails con Resend.. quedan para SPEC futuro
- Modificaciones al codigo fuente de los packages (solo se agregan tests), con la UNICA excepcion de exportar 2 funciones privadas en `packages/logger/src/formatter.ts`
- **`packages/notifications`**: Excluido explicitamente. Aunque tiene funcionalidad de email (NotificationService con 642 lineas, 20+ templates, sistema de retry, preferencias de usuario), su complejidad y alcance ameritan un SPEC dedicado. `packages/notifications` NO es lo mismo que `packages/email`.. `packages/email` son 3 templates basicos de auth (~100 lineas), mientras que `packages/notifications` es un sistema completo de notificaciones con templates de billing, suscripciones, y lifecycle de addons. Se recomienda crear un SPEC-04X exclusivo para `packages/notifications`.

---

## Priority Order

### 1. `packages/auth-ui` -- Prioridad maxima

**Justificacion**: Es el unico package con 0% de cobertura real. Maneja el acceso a la plataforma (sign-in, sign-up, recuperacion de contrasena) para 2 apps distintas. Un bug en `SignInForm` podria bloquear completamente el acceso de todos los usuarios sin que ningun test lo detecte. Ademas, los componentes tienen logica de estado compleja (SSR hydration guard, manejo de errores, redireccion) que es facil romper en refactors.

### 2. `packages/billing` -- Prioridad alta

**Justificacion**: Maneja pagos reales con MercadoPago. Aunque la cobertura actual es mejor de lo esperado (~40-50%), quedan gaps en edge cases de produccion. Las funciones de `config-drift-check` y `config-validator` son las que detectan inconsistencias entre la configuracion de planes y la base de datos.. si fallan silenciosamente en startup, la plataforma podria operar con planes incorrectos. El impacto economico de un bug aqui es directo.

### 3. `packages/logger` -- Prioridad alta

**Justificacion**: Infraestructura critica usada en todo el monorepo. La funcionalidad de redaccion de PII en `formatter.ts` es especialmente sensible.. un bug podria llevar a que passwords, tokens JWT o datos personales aparezcan en los logs de produccion. Actualmente `formatter.ts` no tiene tests directos.

### 4. `packages/email` -- Prioridad media-alta

**Justificacion**: Los templates de email son la cara visible de la plataforma en flujos criticos (verificacion de cuenta, reset de contrasena). Un template roto podria bloquear el onboarding. Sin embargo, el riesgo es mas bajo que billing/auth porque los errores de email son no-bloqueantes (la funcion `sendEmail` loguea pero no lanza excepciones).

---

## Estructura de archivos de test

Cada test nuevo va en la ubicacion indicada. Los archivos marcados como "existing (keep)" se mantienen sin modificar.

```
packages/auth-ui/test/
  setup.tsx                          # existing (keep)
  basic.test.tsx                     # existing (REMOVE - no testa codigo real, solo placeholders)
  sign-in-form.test.tsx              # NEW
  sign-up-form.test.tsx              # NEW
  forgot-password-form.test.tsx      # NEW
  reset-password-form.test.tsx       # NEW
  verify-email.test.tsx              # NEW
  sign-out-button.test.tsx           # NEW
  user-menu.test.tsx                 # NEW
  simple-user-menu.test.tsx          # NEW
  hooks/
    use-auth-translations.test.ts    # NEW

packages/billing/test/               # existing structure, agregar gaps
  ... (archivos existentes se mantienen)

packages/logger/test/
  index.test.ts                      # existing (keep)
  formatter.test.ts                  # NEW
  categories.test.ts                 # NEW
  config.test.ts                     # NEW
  environment.test.ts                # NEW

packages/email/test/
  send.test.ts                       # existing (keep)
  client.test.ts                     # NEW
  templates/
    verify-email.test.tsx            # NEW
    reset-password.test.tsx          # NEW
    base-layout.test.tsx             # NEW
```

---

## Patrones de mock reutilizables

Estos patrones se usan en multiples archivos de test. Se documentan aca para consistencia.

### window.location mock

**IMPORTANTE**: Los componentes usan DOS metodos distintos de redireccion:
- `SignInForm` y `SignUpForm` usan `window.location.replace(url)` (reemplaza la entrada en el historial)
- `SignOutButton`, `VerifyEmail`, `UserMenu`, `SimpleUserMenu` usan `window.location.href = url` (nueva entrada en historial)

El mock debe cubrir AMBOS metodos:

```typescript
const locationMock = { replace: vi.fn(), href: '', pathname: '/' };
Object.defineProperty(window, 'location', { value: locationMock, writable: true });
```

Para verificar redirects en tests:
- SignInForm/SignUpForm: `expect(locationMock.replace).toHaveBeenCalledWith(expectedUrl)`
- Otros componentes: verificar que `locationMock.href` se asigno al URL esperado

### @repo/i18n mock

```typescript
vi.mock('@repo/i18n', () => ({
  useTranslations: () => (key: string) => key
}));
```

Este mock hace que `t('auth-ui.signIn.email')` devuelva la clave como string, permitiendo assertear que se usan las claves correctas sin depender de traducciones reales.

### Better Auth mock (SignInMethods)

```typescript
const mockSignIn: SignInMethods = {
  email: vi.fn().mockResolvedValue({ data: { session: { id: 'ses-1' } }, error: null }),
  social: vi.fn().mockResolvedValue({})
};
```

### Better Auth mock (SignUpMethods)

```typescript
const mockSignUp: SignUpMethods = {
  email: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-1' } }, error: null })
};
```

### Nota sobre userEvent vs fireEvent

Para tests de formularios (auth-ui), usar `@testing-library/user-event` para simular interacciones realistas (typing, clicking). `fireEvent` es aceptable para eventos simples (click en boton).

**PREREQUISITO**: `@testing-library/user-event` **NO esta instalado** en `packages/auth-ui`. Debe agregarse como devDependency ANTES de escribir los tests:

```bash
cd packages/auth-ui && pnpm add -D @testing-library/user-event
```

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
await user.type(screen.getByLabelText('Email'), 'test@example.com');
await user.click(screen.getByRole('button', { name: /submit/i }));
```

---

## Prerequisites de instalacion

Ejecutar ANTES de escribir tests:

### 1. packages/auth-ui
```bash
cd packages/auth-ui && pnpm add -D @testing-library/user-event
```

### 2. packages/email
```bash
cd packages/email && pnpm add -D @react-email/render
```

### 3. packages/email -- crear vitest.config.ts
Ver seccion de `packages/email` test strategy para el template exacto del archivo.

### 4. packages/logger -- exportar funciones privadas
Exportar `shouldUseWhiteText` y `redactSensitiveData` en `packages/logger/src/formatter.ts`. Ver seccion "Excepcion de modificacion de codigo fuente".

---

## Per-Package Specifications

### packages/auth-ui

#### Estado actual

```
src/
  hooks/use-auth-translations.ts    # sin tests
  logger.ts                          # sin tests (trivial, wrapper)
  sign-in-form.tsx                   # sin tests
  sign-up-form.tsx                   # sin tests
  forgot-password-form.tsx           # sin tests
  reset-password-form.tsx            # sin tests
  verify-email.tsx                   # sin tests
  sign-out-button.tsx                # sin tests
  user-menu.tsx                      # sin tests
  simple-user-menu.tsx               # sin tests
  types.ts                           # solo tipos, no requiere tests
```

Tests actuales: `test/basic.test.tsx` -- no importa ni un solo componente real del package.

#### Target de cobertura

**90%** de statements sobre el codigo real de `src/`. Se excluyen `types.ts` y `logger.ts` (wrapper trivial).

#### Test strategy

Usar `@testing-library/react` con `vitest` (ya configurado en el setup existente). Cada componente se prueba de forma aislada inyectando mocks de los metodos de Better Auth como props. Los componentes estan disenados con dependency injection via props, lo que los hace altamente testeables.

#### Nota sobre i18n y texto hardcodeado

Los siguientes componentes NO usan `useAuthTranslations`. Tienen texto hardcodeado directamente en el JSX:

- **SignOutButton**: "Cerrar sesion" hardcodeado en espanol (sin acento en "sesion")
- **UserMenu**: "Dashboard" (ingles), "Mi Perfil" (espanol), "Cerrar Sesion" (espanol) -- mezcla de idiomas
- **SimpleUserMenu**: "Iniciar sesion", "Registrarse", "Cerrar sesion" (espanol, sin acentos)
- **ForgotPasswordForm**: Todo en INGLES: "Reset your password", "Email", "Send reset link", "Sending...", "Check your email", "Back to sign in", "you@example.com", "Enter your email address and we will send you a reset link.", "Please enter your email address"
- **ResetPasswordForm**: Todo en INGLES: "Set new password", "New password", "Confirm password", "Reset password", "Resetting...", "Passwords do not match", "Password reset successful", "Sign in", "At least 8 characters", "Repeat your password", "Enter your new password below.", "Your password has been updated. You can now sign in with your new password.", "Invalid or missing reset token"
- **VerifyEmail**: Todo en INGLES: "Verifying your email...", "Email verified", "Verification failed", "Continue", "Please wait while we verify your email address.", "Your email has been verified successfully. Redirecting...", "The verification link may be expired or invalid.", "Please try signing in again to receive a new verification email.", "Invalid or missing verification token"

Solo **SignInForm** y **SignUpForm** usan `useAuthTranslations` para i18n.

Los tests deben assertear el texto EXACTO que usa cada componente (en el idioma que corresponda). Usar las strings exactas listadas arriba.

#### Nota sobre inconsistencia en fallback map de useAuthTranslations

**HALLAZGO**: El mapa de fallbacks en `useAuthTranslations` tiene claves que NO coinciden con las que usa `SignUpForm`:

- El componente usa `auth-ui.signUp.name` y `auth-ui.signUp.namePlaceholder` (tiene UN solo campo de nombre)
- El fallback map tiene `auth-ui.signUp.firstName` y `auth-ui.signUp.lastName` en su lugar (asume dos campos separados)
- Las claves `auth-ui.signUp.emailPlaceholder` y `auth-ui.signUp.passwordPlaceholder` usadas por el componente NO existen en el fallback map
- Las claves `auth-ui.signUp.confirmPassword` en el fallback map NO son usadas por ningun componente

**Impacto**: Si i18n no esta disponible, SignUpForm mostraria las claves raw (`auth-ui.signUp.name`) en vez de texto legible. Esto es un bug en el codebase, no un problema de tests. Los tests del hook `useAuthTranslations` deben DOCUMENTAR esta inconsistencia verificando que las claves usadas por los componentes no siempre tienen fallback.

**No corregir en este spec** (este spec es solo tests, no modifica codigo fuente excepto las 2 funciones del logger). Crear un ticket separado para sincronizar el fallback map con las claves reales de los componentes.

#### Nota sobre SSR hydration guard

Tanto `SignInForm` como `SignUpForm` tienen un patron `isClientReady` que arranca en `false` y cambia a `true` en un `useEffect`. Mientras `isClientReady` es `false`, el componente muestra un skeleton/loading. En los tests, hay que usar `waitFor` de `@testing-library/react` para esperar que el componente pase al estado "ready":

```typescript
await waitFor(() => {
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});
```

#### Props de cada componente (referencia exacta)

**IMPORTANTE**: Estos son los props REALES de los componentes. Usar estos nombres exactos en los mocks y assertions.

**SignInForm**:
```typescript
{
  signIn: SignInMethods;         // { email: fn, social: fn }
  redirectTo?: string;
  onSuccess?: () => void;
  showOAuth?: boolean;           // Default: true
}
```

**SignUpForm**:
```typescript
{
  signUp: SignUpMethods;         // { email: fn }
  signIn: Pick<SignInMethods, 'social'>;  // Usado para OAuth (Google, etc.)
  redirectTo?: string;
  onSuccess?: () => void;
  showOAuth?: boolean;           // Default: true
}
```
NOTA: `SignUpForm` necesita TANTO `signUp` como `signIn`. El prop `signIn` se usa para los botones OAuth (Google, etc.), que llaman a `signIn.social(...)`.

**ForgotPasswordForm**:
```typescript
{
  onForgotPassword: (params: {
    email: string;
    redirectTo: string;
  }) => Promise<{
    data?: unknown;
    error?: { message?: string; code?: string } | null;
  }>;
  redirectTo?: string;           // Default: '/auth/reset-password'
  signInUrl?: string;            // Default: '/auth/signin'
}
```

**ResetPasswordForm**:
```typescript
{
  token: string;                 // REQUERIDO: se pasa como prop, NO se lee de URL
  onResetPassword: (params: {
    newPassword: string;
    token: string;
  }) => Promise<{
    data?: unknown;
    error?: { message?: string; code?: string } | null;
  }>;
  signInUrl?: string;            // Default: '/auth/signin'
  onSuccess?: () => void;
}
```
NOTA: `token` es un prop, NO se lee de `URLSearchParams`. No se necesita mockear `URLSearchParams` ni `window.location.search`.

**VerifyEmail**:
```typescript
{
  token: string;                 // REQUERIDO: se pasa como prop, NO se lee de URL
  onVerifyEmail: (params: {
    token: string;
  }) => Promise<{
    data?: unknown;
    error?: { message?: string; code?: string } | null;
  }>;
  redirectTo?: string;           // Default: '/'
  redirectDelay?: number;        // Default: 3000ms, 0 para deshabilitar
  onSuccess?: () => void;
}
```
NOTA: `token` es un prop, NO se lee de URL. No se necesita mockear `URLSearchParams`.

**SignOutButton**:
```typescript
{
  isAuthenticated: boolean;
  onSignOut: () => Promise<void>;
  onComplete?: () => void;
  className?: string;
  redirectTo?: string;
}
```

**UserMenu**:
```typescript
{
  session: AuthSession | null;   // NO es "user: SessionUser"
  isPending?: boolean;
  onSignOut: () => Promise<void>;
  dashboardUrl?: string;         // Default: '/dashboard/'
  profileUrl?: string;           // Default: '/profile/'
}
```

**SimpleUserMenu**:
```typescript
{
  session: AuthSession | null;
  isPending?: boolean;
  onSignOut: () => Promise<void>;
  redirectTo?: string;           // Default: '/'
}
```

#### Tipos de referencia (definidos en `types.ts`)

**IMPORTANTE**: `SignInMethods`, `SignUpMethods` y `AuthSession` son tipos **custom** definidos en `packages/auth-ui/src/types.ts`. NO son tipos exportados de Better Auth. Los tests deben importarlos desde `../src/types` (o desde el index del package).

```typescript
// types.ts - tipos relevantes para tests
interface SignInMethods {
    email: (params: { email: string; password: string }) => Promise<AuthResult>;
    social: (params: { provider: string; callbackURL: string }) => Promise<unknown>;
}

interface SignUpMethods {
    email: (params: { email: string; password: string; name: string }) => Promise<AuthResult>;
}

interface AuthResult {
    data?: { session?: { id: string }; user?: { id: string; name?: string; email: string } } | null;
    error?: { message?: string; code?: string; status?: number } | null;
}

interface AuthSession {
    user: SessionUser;
}

interface SessionUser {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
}
```

#### Mocking approach (Better Auth)

Los componentes reciben los metodos de auth como props (no los importan directamente), por lo que **no se necesita mockear el modulo Better Auth**. Se crean funciones mock directamente en cada test usando los tipos de `types.ts`. Ver seccion "Patrones de mock reutilizables" arriba.

Para `useAuthTranslations`, se necesita mockear `@repo/i18n` en el setup del test. El mock hace que `t('key')` devuelva la clave como string.

#### Nota sobre error handling dual

Los componentes `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm` y `VerifyEmail` tienen DOBLE manejo de errores:
1. **Check de `result.error`**: Verifica `result.error.message` despues de la llamada
2. **try/catch**: Captura excepciones lanzadas por la funcion

Los tests deben cubrir AMBOS caminos por separado:
- Caso 1: La funcion retorna `{ error: { message: 'Error message' } }` -> verifica que se muestra el error
- Caso 2: La funcion lanza una excepcion (`throw new Error(...)`) -> verifica manejo graceful

**Diferencia de logging entre componentes**:
- `SignInForm`, `SignUpForm`, `SignOutButton`, `UserMenu`, `SimpleUserMenu`: Usan `authLogger.error()` en el catch
- `ForgotPasswordForm`, `ResetPasswordForm`: NO usan `authLogger`. Usan `setError('An unexpected error...')` directamente
- `VerifyEmail`: NO usa `authLogger`. Usa `setState('error')` + `setErrorMessage()` directamente

#### Key scenarios to test

**SignInForm** (`sign-in-form.test.tsx`):
- Muestra skeleton/loading antes de que `isClientReady` sea true
- Despues de hydration: renderiza los campos de email y password
- Muestra botones OAuth cuando `showOAuth=true` (default)
- Oculta botones OAuth cuando `showOAuth=false`
- Muestra estado de loading durante el submit (boton deshabilitado o spinner)
- Llama `signIn.email` con `{ email, password }` al hacer submit
- Muestra el mensaje de error cuando `result.error` esta presente
- Llama `onSuccess` cuando el login es exitoso
- Redirige a `redirectTo` cuando es exitoso y hay URL configurada
- Llama `signIn.social({ provider: 'google', callbackURL })` al hacer click en el boton de Google
- Llama `signIn.social({ provider: 'facebook', callbackURL })` al hacer click en el boton de Facebook
- `callbackURL` se calcula como `redirectTo ?? window.location.pathname ?? '/'`
- No crashea cuando `onSuccess` no esta definido y el login es exitoso
- No crashea cuando `signIn.email` lanza una excepcion (try/catch manejo graceful, loguea via `authLogger`)
- Redirige usando `window.location.replace(redirectTo)` (NO `.href`, usa `.replace()`)
- No redirige cuando `redirectTo` es undefined y el login es exitoso (solo llama `onSuccess`)

**SignUpForm** (`sign-up-form.test.tsx`):
- Muestra skeleton/loading antes de que `isClientReady` sea true (MISMO patron que SignInForm)
- Despues de hydration: renderiza campos de nombre, email y password
- Llama `signUp.email` con `{ name, email, password }` al hacer submit
- Muestra error cuando el registro falla (`result.error` presente)
- Estado de loading durante el submit
- Muestra botones OAuth cuando `showOAuth=true`
- Llama `signIn.social({ provider: 'google', callbackURL })` al hacer click en Google (usa el prop `signIn`, no `signUp`)
- Llama `signIn.social({ provider: 'facebook', callbackURL })` al hacer click en Facebook
- Oculta botones OAuth cuando `showOAuth=false`
- Llama `onSuccess` cuando el registro es exitoso
- Redirige usando `window.location.replace(redirectTo)` (NO `.href`, usa `.replace()`)
- No crashea cuando `signUp.email` lanza una excepcion (try/catch manejo graceful, loguea via `authLogger`)

**ForgotPasswordForm** (`forgot-password-form.test.tsx`):
- Renderiza campo de email con placeholder "you@example.com"
- Renderiza heading "Reset your password"
- Renderiza link "Back to sign in" (usando `signInUrl` prop, default '/auth/signin')
- Llama `onForgotPassword` con `{ email, redirectTo }` al hacer submit
- Usa el prop `redirectTo` (default '/auth/reset-password') en la llamada
- Muestra confirmacion de exito con heading "Check your email" y mensaje "If an account exists for {email}, you will receive a password reset link shortly." cuando no hay error en la respuesta
- Muestra error cuando `result.error.message` esta presente
- Estado de loading durante el submit (boton muestra "Sending..." en vez de "Send reset link")
- Valida que el campo email no este vacio antes de llamar (muestra "Please enter your email address")
- No crashea cuando `onForgotPassword` lanza una excepcion (muestra 'An unexpected error...')

**ResetPasswordForm** (`reset-password-form.test.tsx`):
- Renderiza heading "Set new password"
- Renderiza campos "New password" (placeholder "At least 8 characters") y "Confirm password" (placeholder "Repeat your password")
- Valida que las contrasenas coincidan antes de llamar al backend (muestra "Passwords do not match")
- Valida longitud minima de contrasena (MIN_PASSWORD_LENGTH, default 8 caracteres)
- Muestra "Password must be at least 8 characters" cuando la contrasena tiene menos de 8 caracteres
- Si no hay token: muestra error "Invalid or missing reset token" y no renderiza formulario
- Llama `onResetPassword` con `{ newPassword, token }` al hacer submit
- Usa el `token` recibido como prop (NO lee de URL)
- Muestra mensaje de exito "Password reset successful" + "Your password has been updated..." cuando la respuesta no tiene error
- Muestra link "Sign in" despues del exito
- Muestra error cuando `result.error.message` esta presente
- Estado de loading: boton muestra "Resetting..." en vez de "Reset password"
- Llama `onSuccess` cuando la operacion es exitosa
- Renderiza link a sign-in usando `signInUrl` prop
- No crashea cuando `onResetPassword` lanza una excepcion (muestra 'An unexpected error...')

**VerifyEmail** (`verify-email.test.tsx`):
- Si no hay token: muestra error "Invalid or missing verification token" y no intenta verificar
- Llama `onVerifyEmail` automaticamente al montar (con el `token` recibido como prop)
- Muestra estado de loading "Verifying your email..." + "Please wait while we verify your email address." mientras espera respuesta
- Muestra mensaje de exito "Email verified" + "Your email has been verified successfully." cuando la verificacion es exitosa. Si `redirectDelay > 0`, apende " Redirecting..." al mensaje (son strings separadas)
- Muestra boton "Continue" en estado de exito
- Estado de error cuando `result.error` tiene `message`: heading muestra "Verification failed", body muestra `result.error.message` (NO "The verification link may be expired or invalid.")
- Estado de error cuando `result.error` sin `message`: heading muestra "Verification failed", body muestra "Verification failed" (default del setErrorMessage en linea 65)
- Estado de error cuando `onVerifyEmail` lanza excepcion: heading muestra "Verification failed", body muestra "An unexpected error occurred during verification."
- El texto "The verification link may be expired or invalid." es un fallback en el JSX que solo se mostraria si `errorMessage` fuera null/empty, cosa que NO ocurre con ninguna ruta de codigo actual (es efectivamente dead code)
- Muestra texto adicional "Please try signing in again to receive a new verification email." en TODOS los estados de error
- Llama `onSuccess` despues de verificacion exitosa
- Redirige a `redirectTo` (default '/') via `window.location.href` despues de `redirectDelay` ms (default 3000)
- No redirige cuando `redirectDelay=0`
- No crashea cuando `onVerifyEmail` lanza una excepcion

**SignOutButton** (`sign-out-button.test.tsx`):
- Retorna `null` cuando `isAuthenticated=false` (no renderiza nada)
- Renderiza un boton cuando `isAuthenticated=true`
- El texto del boton es "Cerrar sesion" (hardcoded en espanol)
- Llama `onSignOut` cuando se hace click en el boton
- Llama `onComplete` despues de que `onSignOut` se resuelve exitosamente
- Navega a `redirectTo` via `window.location.href` despues de sign out
- Maneja error de `onSignOut` gracefully (loguea via `authLogger`, no crashea)
- Acepta `className` custom y lo aplica al boton
- El estilo por defecto incluye fondo rojo

**UserMenu** (`user-menu.test.tsx`):
- Muestra loading skeleton cuando `isPending=true`
- Retorna `null` cuando `session` es `null`
- Muestra boton de avatar con la inicial del usuario cuando no hay imagen
- Muestra la imagen del usuario cuando `session.user.image` existe
- `displayName` tiene fallback chain: `user.name` -> `user.email` -> `'User'`
- El dropdown se abre al hacer click en el boton de avatar
- El dropdown se cierra al hacer click en el backdrop
- El dropdown se cierra al presionar Escape
- El dropdown tiene links a Dashboard (`dashboardUrl`, default '/dashboard/') y Mi Perfil (`profileUrl`, default '/profile/')
- El boton de "Cerrar Sesion" en el dropdown llama `onSignOut`
- Despues de sign out navega a `'/'` via `window.location.href = '/'` SOLO si `!window.location.pathname.includes('/auth')`. Si ya esta en una pagina `/auth/*`, NO redirige. Hardcoded, NO usa ningun prop `redirectTo`
- No redirige despues de sign out si `window.location.pathname` contiene '/auth'
- `aria-expanded` refleja el estado del dropdown
- `aria-haspopup="true"` esta presente en el boton trigger

**SimpleUserMenu** (`simple-user-menu.test.tsx`):
- Muestra loading skeleton cuando `isPending=true`
- Muestra links de sign-in y sign-up cuando `session` es `null`
- El boton de sign-up tiene fondo con gradiente
- Los textos son: "Iniciar sesion", "Registrarse" (hardcoded espanol)
- Muestra informacion del usuario (avatar, nombre, email) cuando esta autenticado
- Usa `session.user.image` para avatar si esta disponible, avatar con gradiente e inicial si no
- Oculta nombre/email en mobile (responsive classes, verificar con media queries o classes CSS)
- El boton de "Cerrar sesion" llama `onSignOut`
- Navega a `redirectTo` (default '/') despues de sign out
- Maneja error de `onSignOut` gracefully (no crashea)
- Links de sign-in y sign-up usan URLs con trailing slash: `/auth/signin/` y `/auth/signup/`

**useAuthTranslations** (`hooks/use-auth-translations.test.ts`):
- Importa `useTranslations` de `@repo/i18n` y wrappea la llamada en un try/catch
- Si `useTranslations()` funciona: retorna `{ t, isI18nAvailable: true }` donde `t` intenta traducir con fallback
- Si `useTranslations()` falla (ej. no hay provider): retorna `{ t: getFallbackText, isI18nAvailable: false }`
- `getFallbackText` usa un mapa interno con 55 claves de fallback en ESPANOL
- El mapa soporta parametros via `{paramKey}` replacement (ej. `t('signUp.passwordMinLength', { min: 8 })`)
- Si la clave no existe en el mapa de fallbacks: retorna la clave misma como string
- Las claves base son `auth-ui.*` (ej. `auth-ui.signIn.email`, `auth-ui.signUp.name`)
- Tests:
  - Con `@repo/i18n` mockeado para funcionar: verifica `isI18nAvailable: true` y que `t()` retorna traducciones
  - Con `@repo/i18n` mockeado para fallar (throw): verifica `isI18nAvailable: false` y que `t()` retorna fallbacks en espanol
  - Verifica que claves inexistentes retornan la clave como string
  - Verifica que parametros `{min}` se reemplazan correctamente

---

### packages/billing

#### Estado actual

```
src/
  adapters/mercadopago.ts         # ~80% cubierto (tests en 2 archivos)
  config/
    plans.config.ts                # cubierto via config-validator y plans.test.ts
    addons.config.ts               # cubierto via config-validator y addons.test.ts
    entitlements.config.ts         # cubierto via entitlements.test.ts (80 lineas)
    limits.config.ts               # sin tests directos
    promo-codes.config.ts          # cubierto via config-validator tests
  validation/config-validator.ts   # bien cubierto (621 lineas de tests, 36 escenarios)
  utils/
    config-drift-check.ts          # bien cubierto (9 test cases)
    index.ts                       # solo re-exporta checkConfigDrift, formatDriftReport y tipos de config-drift-check.ts. No tiene logica propia, no requiere tests.
  constants/billing.constants.ts   # cubierto via constants.test.ts
  types/                           # solo tipos, no requieren tests
```

Tests actuales: 9 archivos con ~2,281 lineas de tests:
- `test/addons.test.ts` (~87 lineas, 15 test cases)
- `test/config-drift-check.test.ts` (~204 lineas, 9 test cases)
- `test/constants.test.ts` (~143 lineas, 22 test cases)
- `test/entitlements.test.ts` (~80 lineas, 9 test cases)
- `test/plans.test.ts` (~126 lineas, 18 test cases)
- `test/sponsorship-seeds.test.ts` (~188 lineas, 11 test cases)
- `test/adapters/mercadopago.test.ts` (~228 lineas, 16 test cases)
- `test/adapters/mercadopago-adapter.test.ts` (~604 lineas, 29 test cases)
- `test/validation/config-validator.test.ts` (~621 lineas, 36 test cases)

#### Target de cobertura

**90%** sobre el codigo de `src/`. Los tipos (`types/`) se excluyen.

#### Test strategy

El package es mayormente logica pura (configuracion, validacion, utilities) sin dependencias de red ni base de datos, excepto el adaptador de MercadoPago que usa `@qazuor/qzpay-mercadopago`. La estrategia es:

1. **Config pura** (`plans.config.ts`, `addons.config.ts`, `entitlements.config.ts`, `limits.config.ts`): La mayoria ya tiene tests. Verificar gaps y agregar tests para `limits.config.ts`.
2. **Utilities** (`config-drift-check.ts`, `config-validator.ts`): Ya tienen buena cobertura. Solo agregar edge cases faltantes si los hay.
3. **Adaptador MercadoPago**: Ya tiene buen cubrimiento. Solo agregar casos edge faltantes.
4. **`utils/index.ts`**: Solo re-exporta de `config-drift-check.ts`. No tiene logica propia. No necesita tests directos.

Los 9 archivos de test existentes sirven como referencia para patrones de import y estructura.

#### Mocking approach (MercadoPago)

El adaptador MercadoPago ya usa el patron de `vi.stubEnv` para las variables de entorno. No hay necesidad de mockear el modulo `@qazuor/qzpay-mercadopago`.. los tests de configuracion verifican que el adaptador se instancia correctamente, no que llama a la API real.

Para los tests de `config-validator` y `config-drift-check`, no hay dependencias externas.. son funciones puras.

#### Key scenarios to test

**config-drift-check.ts** (ya tiene 9 test cases, verificar completitud):
- `checkConfigDrift` con sync total (no drift)
- `checkConfigDrift` con planes faltantes en DB (`missing_in_db`)
- `checkConfigDrift` con addons faltantes en DB
- `checkConfigDrift` con registros huerfanos en DB (orphaned records)
- `checkConfigDrift` con DB vacia (full drift)
- `checkConfigDrift` con drift mixto (missing + orphaned)
- `formatDriftReport` cuando no hay drift (mensaje "No drift detected")
- `formatDriftReport` con errores y warnings (formato esperado, agrupado por entityType)
- `formatDriftReport` items de warning con prefijo WARN

**config-validator.ts** (ya tiene 621 lineas / 36 test cases, verificar branches):
- `validateBillingConfig` con config valida -> `{ valid: true, errors: [], warnings: [] }`
- `validateBillingConfig` con plan con `monthlyPriceArs < 0` -> error
- `validateBillingConfig` con plan con `hasTrial=true` y `trialDays < 0` -> error
- `validateBillingConfig` con entitlement key invalido en plan -> error
- `validateBillingConfig` con sortOrder duplicado en misma categoria -> error
- `validateBillingConfig` con 0 planes default por categoria -> error
- `validateBillingConfig` con multiples planes default en misma categoria -> error
- `validateBillingConfig` con addon con `priceArs <= 0` -> error
- `validateBillingConfig` con addon que tiene `affectsLimitKey` pero `limitIncrease <= 0` -> error
- `validateBillingConfig` con promo code con `discountPercent > 100` -> error
- `validateBillingConfig` con promo code que referencia plan inexistente -> error
- `validateBillingConfig` con promo code vencido -> warning (no error)
- `validateBillingConfig` con codigo de promo duplicado -> error
- `validateBillingConfigOrThrow` lanza cuando hay errores
- `validateBillingConfigOrThrow` no lanza cuando config es valida

**config de entitlements y limits**:
- `EntitlementKey` enum contiene todos los valores esperados (smoke test de contratos)
- `LimitKey` enum no tiene duplicados
- Todos los entitlements referenciados en planes existen en `EntitlementKey`

**limits.config.ts** (sin tests directos, 33 lineas):
- Exporta `LIMIT_METADATA: Record<LimitKey, { name: string; description: string }>`
- Contiene 6 limits: `MAX_ACCOMMODATIONS`, `MAX_PHOTOS_PER_ACCOMMODATION`, `MAX_ACTIVE_PROMOTIONS`, `MAX_FAVORITES`, `MAX_PROPERTIES`, `MAX_STAFF_ACCOUNTS`
- Tests: Verificar que todas las claves de `LimitKey` tienen metadata, que los nombres y descripciones no estan vacios

**entitlements.config.ts** (211 lineas, con tests directos en `entitlements.test.ts` - 81 lineas, 8 test cases):
- Exporta `ENTITLEMENT_DEFINITIONS: EntitlementDefinition[]` con 40 entitlements organizados por categoria (12 owner, 7 accommodation, 6 complex, 15 tourist)
- Tests: Verificar que todos los `EntitlementKey` tienen definicion, que no hay keys duplicados, que las categorias existen

**Nota sobre imports**: Los archivos de billing usan `.js` en los imports relativos (ESM). Los 9 archivos de test existentes sirven como referencia para el patron de imports correcto. **CRITICO**: Los imports DEBEN usar extension `.js` incluso en archivos `.ts`. Ejemplo correcto: `import { LIMIT_METADATA } from '../src/config/limits.config.js'`. Sin la extension `.js`, el import fallara en runtime porque el package es ESM-only (`"type": "module"`).

---

### packages/logger

#### Estado actual

```
src/
  logger.ts         # parcialmente cubierto (funciones core en index.test.ts)
  formatter.ts      # sin tests directos (logica mas compleja del package)
  categories.ts     # sin tests directos
  config.ts         # sin tests directos
  types.ts          # solo tipos
  environment.ts    # sin tests directos
  audit-types.ts    # solo tipos/enum
```

El test actual (`index.test.ts`) importa desde `src/index.ts` y prueba el comportamiento observable del logger a traves de su API publica. Tiene 37 tests en 4 suites cubriendo: Logger outer, truncamiento, category formatting, y redaccion de datos sensibles (PII filtering).

**Gap critico**: `formatter.ts` contiene las funciones de redaccion de PII, formateo de objetos, y composicion del mensaje de log. Estas funciones tienen logica condicional compleja (branches por nivel de log, configuracion de categorias, expand levels, truncamiento) que no esta cubierta de forma aislada.

#### Target de cobertura

**90%** sobre el codigo TypeScript fuente de `src/`. Se excluyen los archivos `.js` y `.d.ts` generados, y los archivos de solo tipos (`types.ts`, `audit-types.ts`).

#### Excepcion de modificacion de codigo fuente

Las funciones `shouldUseWhiteText` y `redactSensitiveData` en `formatter.ts` son **privadas** (no exportadas). Para poder testearlas de forma aislada (que es critico para la cobertura de PII), se deben exportar. Esta es la UNICA modificacion de codigo fuente permitida en este spec:

```typescript
// En packages/logger/src/formatter.ts
// ANTES (linea ~130):
function redactSensitiveData(value: unknown, key?: string): unknown {
// DESPUES:
export function redactSensitiveData(value: unknown, key?: string): unknown {

// ANTES (linea ~239):
function shouldUseWhiteText(color: LoggerColorType): boolean {
// DESPUES:
export function shouldUseWhiteText(color: LoggerColorType): boolean {
```

Tambien agregar la re-exportacion en `packages/logger/src/index.ts` si es necesario para que los tests puedan importarlas.

#### Variables de entorno del logger

Las variables de entorno reales son (NO existe `LOG_FORMAT`):

- `LOG_LEVEL`: Nivel de log (debug, info, warn, error, etc.)
- `LOG_SAVE`: Boolean, si guarda logs
- `LOG_EXPAND_OBJECT_LEVELS`: Numero de niveles de expansion de objetos
- `LOG_TRUNCATE_LONG_TEXT`: Boolean
- `LOG_TRUNCATE_LONG_TEXT_AT`: Numero de caracteres para truncar
- `LOG_TRUNCATE_LONG_TEXT_ON_ERROR`: Boolean
- `LOG_STRINGIFY_OBJECTS`: Boolean

Tambien soporta per-category: `LOG_{CATEGORY}_{VAR}` (ej. `LOG_AUTH_LEVEL=debug`)

#### Catalogo completo de PII patterns

El formatter tiene dos mecanismos de deteccion de datos sensibles:

**75 Sensitive Keys** (verificados case-insensitive contra las claves de objetos):

- Authentication: `password`, `passwd`, `pwd`, `secret`, `token`, `apikey`, `api_key`, `apiKey`, `authorization`, `auth`, `bearer`, `credential`, `credentials`
- Private keys: `private_key`, `privateKey`, `secret_key`, `secretKey`, `accessToken`, `access_token`, `refreshToken`, `refresh_token`, `idToken`, `id_token`, `sessionToken`, `session_token`, `jwt`, `cookie`, `session`
- PII: `ssn`, `socialSecurityNumber`, `social_security_number`, `dni`, `cuil`, `cuit`, `passport`, `driverLicense`, `driver_license`
- Financial: `creditCard`, `credit_card`, `cardNumber`, `card_number`, `cvv`, `cvc`, `ccv`, `pin`, `bankAccount`, `bank_account`, `accountNumber`, `account_number`, `routingNumber`, `routing_number`
- Contact: `phone`, `phoneNumber`, `phone_number`, `mobile`, `mobileNumber`, `mobile_number`, `cellphone`, `email`, `emailAddress`, `email_address`
- Location: `address`, `streetAddress`, `street_address`, `homeAddress`, `home_address`, `ipAddress`, `ip_address`, `ip`, `geolocation`, `coordinates`, `lat`, `lng`, `latitude`, `longitude`

**22 Regex Patterns** agrupados en 11 categorias conceptuales (aplicados sobre valores de tipo string, con flag global):

1. JWT: patron `eyJ[base64].[base64].[signature]`
2. Bearer tokens: `Bearer` seguido de alfanumericos
3. Numeros de tarjeta de credito: 13-19 digitos con separadores opcionales
4. SSN (US): `XXX-XX-XXXX`
5. Emails: patron estandar de email
6. Telefonos US: formato `+1` area code
7. Telefonos argentinos: `+54 9 XX XXXX-XXXX`
8. CUIT/CUIL argentinos: `XX-XXXXXXXX-X`
9. IPv4: octetos 0-255 separados por puntos
10. IPv6: 8 grupos de hex
11. API keys: prefijos `sk_`, `pk_`, `api_`, `key_` seguidos de 20+ caracteres

#### Nota sobre inconsistencia de truncamiento

Hay una inconsistencia de spacing en el texto de truncamiento que los tests deben DOCUMENTAR (no corregir, ya que este spec no modifica codigo fuente):
- Top-level `formatValue`: usa `"...[TRUNCATED]"` (sin espacio antes del bracket)
- Recursivo en `expandObject`: usa `"... [TRUNCATED]"` (con espacio antes del bracket)

Los tests deben assertear el comportamiento ACTUAL, documentando la inconsistencia con un comentario.

#### Key scenarios to test

**formatter.ts -- `formatValue`**:
- `null` -> `"null"`
- `undefined` -> `"undefined"`
- string corto -> retorna el string sin cambios
- string largo con `truncateText=true` -> trunca con `"...[TRUNCATED]"`
- string largo con `truncateText=false` -> no trunca
- objeto simple con `expandLevels=2` -> JSON expandido
- objeto simple con `expandLevels=0` -> `"[Object]"`
- objeto simple con `expandLevels=-1` -> JSON completo (sin limite)
- array de objetos -> expandido correctamente
- referencia circular en objeto -> contiene `"[Circular]"`
- objeto con clave sensible (ej. `password`) -> valor reemplazado por `"[REDACTED]"`
- objeto con `email` como valor string -> `"[REDACTED]"` via pattern matching
- JWT en string -> `"[REDACTED]"`
- Bearer token en string -> `"[REDACTED]"`
- numero de tarjeta en string -> `"[REDACTED]"`
- IP v4 en string -> `"[REDACTED]"`
- objeto con datos no sensibles -> no redacta nada
- CUIT/CUIL argentino en string -> `"[REDACTED]"`
- telefono argentino en string -> `"[REDACTED]"`
- API key con prefijo `sk_` en string -> `"[REDACTED]"`

**formatter.ts -- `formatLogMessage`**:
- sin categoria -> no incluye prefix de categoria
- con categoria registrada -> incluye el nombre en mayusculas
- con `INCLUDE_TIMESTAMPS=true` -> incluye timestamp en formato `[YYYY-MM-DD HH:MM:SS]`
- con `INCLUDE_LEVEL=true` -> incluye `[INFO]`, `[ERROR]`, etc.
- con label -> incluye `[label]`
- nivel ERROR con `TRUNCATE_LONG_TEXT_ON_ERROR=false` -> no trunca
- nivel DEBUG -> nunca trunca (independiente de config)

**formatter.ts -- `formatLogArgs`**:
- Retorna un array con UN SOLO STRING formateado (no multiples argumentos)
- El string contiene el mensaje completo con colores, categoria, timestamp y nivel segun configuracion
- Se puede testear indirectamente verificando el output de `console.log` spy (patron usado en tests existentes)

**formatter.ts -- Objetos exportados (smoke tests)**:
- `levelIcons`: mapeo de LogLevel a string con icono unicode. Verificar que todos los niveles tienen icono
- `levelColors`: mapeo de LogLevel a funcion chalk. Verificar que todos los niveles tienen color
- `levelBgColors`: mapeo de LogLevel a funcion chalk de fondo. Verificar que todos los niveles tienen color de fondo

**formatter.ts -- `formatTimestamp`**:
- Retorna string en formato `[YYYY-MM-DD HH:MM:SS]` (con brackets)
- El formato incluye ceros a la izquierda en componentes de un digito

**formatter.ts -- `getColorFunction`**:
- Retorna una funcion para cada color de `LoggerColors`
- La funcion retorna un string (no lanza)

**formatter.ts -- `getCategoryBackgroundFunction(color)`**:
- Retorna una funcion de chalk con fondo del color especificado
- El texto usa color contrastante (blanco o negro segun el fondo)

**formatter.ts -- `shouldUseWhiteText(color)`**:
- Retorna `true` para colores oscuros: `BLACK`, `RED`, `BLUE`, `MAGENTA`
- Retorna `false` para colores claros: `GREEN`, `YELLOW`, `CYAN`, `WHITE`, `GRAY`, `BLACK_BRIGHT`, `RED_BRIGHT`, `GREEN_BRIGHT`, `YELLOW_BRIGHT`, `BLUE_BRIGHT`, `MAGENTA_BRIGHT`, `CYAN_BRIGHT`, `WHITE_BRIGHT`
- Los tests deben cubrir al menos los 4 oscuros y 4-5 claros representativos

**formatter.ts -- `redactSensitiveData(value, key?)`**:
- Funcion standalone que maneja redaccion por claves, patterns, arrays y objetos recursivamente
- Con `key='password'` y `value='secret123'` -> `"[REDACTED]"`
- Con `key='name'` y `value='John'` -> `'John'` (no redacta)
- Con string conteniendo JWT -> `"[REDACTED]"`
- Con array de objetos -> redacta recursivamente dentro de cada elemento
- Con objeto anidado -> redacta claves sensibles en todos los niveles
- Redaccion es case-insensitive: `key='PASSWORD'` con `value='secret'` -> `'[REDACTED]'` (verifica que `key.toLowerCase()` funciona)

**categories.ts**:
- `registerCategoryInternal` registra una nueva categoria
- `getCategoryByKey` devuelve la categoria DEFAULT para claves desconocidas
- `getCategoryByKey` devuelve la categoria correcta para claves registradas
- `getMaxCategoryNameLength` retorna el largo de la categoria mas larga registrada
- `clearCategories` limpia todas las categorias excepto DEFAULT

**config.ts**:
- `configureLogger` actualiza la configuracion con merge parcial
- `getConfig` retorna la configuracion actual
- `resetLoggerConfig` restaura los defaults

**environment.ts**:
- `getBooleanEnv(key)`: retorna `null` si la variable de entorno no existe. Si existe, retorna `true` cuando el valor lowercase es `'true'`, y `false` para cualquier otro valor (ej. `'false'`, `'0'`, `'yes'`)
- `getNumberEnv(key)`: retorna entero parseado, `null` si el valor es NaN o no existe
- `getLogLevelEnv(key)`: valida contra el enum `LogLevel`, retorna `null` si el valor es invalido
- `getConfigFromEnv(categoryKey?)`: construye config desde variables de entorno
  - Sin `categoryKey`: usa prefijo `LOG_`
  - Con `categoryKey`: usa prefijo `LOG_{CATEGORY}_` con fallback a `LOG_`
  - Retorna `Partial<BaseLoggerConfig>`
- Lee `LOG_LEVEL` y lo traduce al tipo correcto
- Lee `LOG_SAVE`, `LOG_TRUNCATE_LONG_TEXT` como booleanos
- Lee `LOG_EXPAND_OBJECT_LEVELS`, `LOG_TRUNCATE_LONG_TEXT_AT` como numeros
- Retorna defaults cuando las variables no estan definidas
- **NO** existe variable `LOG_FORMAT`.. verificar que los tests no la referencien

---

### packages/email

#### Estado actual

```
src/
  client.ts                     # parcialmente cubierto (DI test en send.test.ts)
  send.ts                       # bien cubierto (~90%) via send.test.ts
  templates/
    base-layout.tsx             # sin tests
    verify-email.tsx            # sin tests
    reset-password.tsx          # sin tests
```

El test actual (`test/send.test.ts`) cubre los principales casos de `sendEmail`:
- Exito con messageId
- Multiples destinatarios
- Custom `from` y `replyTo`
- Default `from` address
- Error de API (`error` en response)
- Excepcion de red (thrown)
- Excepcion no-Error (string thrown)
- Integracion con `createEmailClient` via DI

**Gaps**: Los templates de React Email no tienen tests. No hay verificacion de que el HTML generado por `VerifyEmailTemplate` o `ResetPasswordTemplate` contiene los elementos esperados (URL de verificacion, nombre del usuario, texto de expiracion, etc.).

**Nota sobre `createEmailClient`**: El constructor de Resend NO valida la API key contra el servidor (eso ocurre en el primer request). Sin embargo, SI verifica que el parametro `apiKey` exista. Si no se pasa API key Y no hay variable de entorno `RESEND_API_KEY`, el constructor lanza error `"Missing API key..."`. El test debe verificar:
1. Que `createEmailClient({ apiKey: 'test-key' })` retorna una instancia con `emails.send`
2. Que `createEmailClient` sin apiKey lanza error (si no hay env var)

**Nota sobre `sendEmail`**: La funcion NUNCA lanza excepciones. Siempre retorna `{ success: false, error: string }` en caso de error. Los tests deben verificar este comportamiento (no usar `expect(...).toThrow()` sino verificar el resultado).

#### Aclaracion sobre paquetes de email en el monorepo

Este spec cubre `packages/email` (3 templates basicos de auth, ~100 lineas). **NO** cubre `packages/notifications` (20+ templates, NotificationService de 642 lineas, retry, preferencias). Ver seccion "Excluido" arriba.

#### Target de cobertura

**90%** del codigo fuente real. Los templates son el mayor gap.

#### Test strategy

Los templates de React Email se prueban renderizandolos a HTML y verificando el contenido.

**Estado de dependencias**: El package tiene `@react-email/components` (v0.0.30) pero **NO tiene `@react-email/render` instalado**. En produccion, el rendering lo hace el cliente Resend internamente (el componente JSX se pasa directamente a `client.emails.send({ react: <Component /> })`).

**Enfoque recomendado para tests**: Instalar `@react-email/render` como devDependency y usar su funcion `render()` (asincrona). Esta es la funcion oficial de React Email y es future-proof (React Email recomienda no usar `renderToStaticMarkup` ya que anticipa que React podria deprecarlo en futuras versiones, aunque a la fecha NO esta oficialmente deprecado):

```typescript
import { render } from '@react-email/render';
import { VerifyEmailTemplate } from '../src/templates/verify-email';

// render() es ASINCRONO (retorna Promise<string>)
const html = await render(<VerifyEmailTemplate name="Juan" verificationUrl="https://hospeda.com.ar/verify?token=abc" />);
expect(html).toContain('Juan');
expect(html).toContain('https://hospeda.com.ar/verify?token=abc');
```

**Alternativa**: Si se prefiere evitar la dependencia adicional, se puede usar `renderToStaticMarkup` de `react-dom/server` (sincrono). Requiere instalar `react-dom` como devDependency. **NOTA**: React Email recomienda no usar `renderToStaticMarkup` ya que anticipa una futura deprecacion. A la fecha NO esta oficialmente deprecado, pero `@react-email/render` es el approach future-proof recomendado:

```bash
cd packages/email && pnpm add -D react-dom @types/react-dom
```

```typescript
import { renderToStaticMarkup } from 'react-dom/server';
// NOTA: renderToStaticMarkup es SINCRONO pero sera deprecado por React
const html = renderToStaticMarkup(<VerifyEmailTemplate name="Juan" verificationUrl="https://..." />);
```

**Nota sobre `vitest.config.ts`**: Este package **NO tiene** `vitest.config.ts`. Hay que CREAR uno nuevo con la siguiente estructura (usar `packages/auth-ui/vitest.config.ts` como referencia):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node', // templates se renderizan server-side via @react-email/render
        include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            },
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            // No excluir index.ts: re-exporta templates y funciones, excluirlo podria ocultar re-exports rotos
            exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx']
        }
    }
});
```

#### Props exactos de templates

**VerifyEmailTemplate**:
```typescript
{
    name: string;              // REQUERIDO (readonly)
    verificationUrl: string;   // REQUERIDO (readonly)
}
```

**ResetPasswordTemplate**:
```typescript
{
    name: string;              // REQUERIDO (readonly)
    resetUrl: string;          // REQUERIDO (readonly) -- NOTA: se llama resetUrl, NO resetPasswordUrl
}
```

**BaseLayout**:
```typescript
{
    children: ReactNode;       // REQUERIDO (readonly)
    showUnsubscribe?: boolean; // Default: true (readonly)
}
```

#### Key scenarios to test

**templates/verify-email.tsx** (`VerifyEmailTemplate`):
- Renderiza "Hola {name}," con el nombre del usuario (texto en ESPANOL)
- Incluye el heading "Verifica tu dirección de correo electrónico"
- Contiene texto: "Gracias por registrarte en Hospeda. Para completar tu registro, necesitamos verificar tu dirección de correo electrónico."
- Contiene texto: "Haz clic en el botón de abajo para verificar tu correo electrónico:"
- Incluye `verificationUrl` como href en el boton "Verificar correo electrónico"
- Contiene texto de expiracion: "Este enlace expira en 24 horas"
- Incluye nota de seguridad: "Si no solicitaste esta verificación, puedes ignorar este correo de forma segura"
- Contiene el fallback text: "O copia y pega este enlace en tu navegador:"
- Usa `BaseLayout` (verifica que el HTML contiene la estructura de Hospeda)
- Con nombre vacio (`name: ''`) -> no crashea, renderiza "Hola ,"

**templates/reset-password.tsx** (`ResetPasswordTemplate`):
- Renderiza "Hola {name}," con el nombre del usuario (texto en ESPANOL)
- Incluye el heading "Restablece tu contraseña"
- Contiene texto: "Recibimos una solicitud para restablecer la contraseña de tu cuenta en Hospeda."
- Contiene texto: "Haz clic en el botón de abajo para crear una nueva contraseña:"
- Incluye `resetUrl` como href en el boton "Restablecer contraseña"
- Contiene texto de expiracion: "Este enlace expira en 1 hora por motivos de seguridad. Si necesitas más tiempo, puedes solicitar un nuevo enlace de restablecimiento."
- Incluye nota de seguridad con bold: "¿No solicitaste esto?" seguido de "Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu contraseña actual seguirá siendo válida y no se realizarán cambios en tu cuenta."
- Contiene el fallback text: "O copia y pega este enlace en tu navegador:"
- Usa `BaseLayout`
- Con nombre vacio (`name: ''`) -> no crashea

**templates/base-layout.tsx** (`BaseLayout`):
- Renderiza children correctamente (verifica que el contenido pasado aparece en el HTML)
- Con `showUnsubscribe=true` (default) -> incluye texto "Si no deseas recibir estos correos, puedes darte de baja aquí" con link a `https://hospeda.com.ar/unsubscribe`
- Con `showUnsubscribe=false` -> no incluye texto de unsubscribe
- Header contiene "Hospeda"
- Footer contiene "Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral"

**client.ts** (`createEmailClient`):
- `createEmailClient({ apiKey: 'test-key' })` retorna una instancia con `emails.send` disponible
- El constructor de Resend verifica que apiKey exista (lanza `"Missing API key..."` si no hay key ni env var `RESEND_API_KEY`)
- El cliente resultante se puede usar con `sendEmail` (ya cubierto via DI test en send.test.ts)

---

## Acceptance Criteria

1. Todos los nuevos tests pasan en `pnpm test` sin errores
2. Cobertura de cada package alcanza >=90% segun el reporte de Vitest:
   - `packages/auth-ui`: >=90% statements
   - `packages/billing`: >=90% statements
   - `packages/logger`: >=90% statements
   - `packages/email`: >=90% statements
3. Ningun test nuevo usa `any` implicito ni `as any` sin justificacion
4. Todos los tests siguen el patron AAA (Arrange, Act, Assert)
5. Los mocks de Better Auth no importan el modulo real.. solo mockean las interfaces (`SignInMethods`, `SignUpMethods`, etc.)
6. Los tests de `auth-ui` usan `@testing-library/react` y prueban comportamiento observable (no detalles de implementacion)
7. Los tests de `formatter.ts` son unitarios puros.. no llaman a `logger.info` indirectamente
8. Los tests de templates de email producen HTML verificable con props reales (sin mocks de las props), usando `render()` de `@react-email/render` (async) o `renderToStaticMarkup` de `react-dom/server` (sync, con deprecation warning)
9. Ningun test hace `vi.mock('@repo/logger')` dentro de tests del propio logger
10. Pre-commit hooks (biome + typecheck) pasan sin errores en todos los packages modificados
11. Los `vitest.config.ts` de los 4 packages deben tener sus coverage thresholds actualizados a 90% (statements, branches, functions, lines). Thresholds actuales: `auth-ui` 70/70/60/70, `billing` 70/70/60/70, `logger` 70/70/60/70, `email` **NO TIENE vitest.config.ts** (hay que crearlo)
12. `@testing-library/user-event` debe estar instalado como devDependency en `packages/auth-ui`
13. `shouldUseWhiteText` y `redactSensitiveData` deben estar exportadas en `packages/logger/src/formatter.ts`
14. Todos los tests de templates de email assertean texto en ESPANOL (los templates estan escritos en espanol)
15. Ningun test de `sendEmail` usa `expect(...).toThrow()` (la funcion NUNCA lanza, siempre retorna resultado)
16. `@react-email/render` debe estar instalado como devDependency en `packages/email`

---

## Risk Assessment

### Riesgo 1 -- Complejidad del setup de auth-ui (MEDIO)

**Descripcion**: Los componentes de `auth-ui` usan `useAuthTranslations` (solo `SignInForm` y `SignUpForm`). Si el hook hace imports dinamicos o depende de un contexto global, puede necesitar un mock mas complejo.

**Mitigacion**: Revisar la implementacion de `use-auth-translations.ts` antes de empezar. Si el hook usa `useTranslation` de algun provider, se crea un wrapper de test con el provider. Si importa directamente del modulo i18n, se mockea el modulo en `test/setup.tsx`. Los demas componentes (SignOutButton, UserMenu, SimpleUserMenu, ForgotPasswordForm, ResetPasswordForm, VerifyEmail) tienen texto hardcodeado y NO necesitan mock de i18n.

### Riesgo 2 -- SSR hydration guard en componentes (BAJO-MEDIO)

**Descripcion**: `SignInForm` y `SignUpForm` tienen un guard de `isClientReady` basado en `useEffect`. En JSDOM, el efecto se ejecuta sincronicamente despues del render inicial, por lo que el componente deberia pasar al estado "ready" correctamente. Pero puede haber timing issues con `act()`.

**Mitigacion**: Wrappear renders con `act()` y usar `waitFor` de testing-library cuando se espera el estado post-hydration. Ejemplo:

```typescript
await waitFor(() => {
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### Riesgo 3 -- Renderizado de templates React Email (BAJO)

**Descripcion**: Los templates de React Email son componentes React estandar que usan `@react-email/components` para la estructura HTML del email.

**Estado de dependencias**:
- `@react-email/components` (v0.0.30): SI instalado (dependencia de produccion)
- `@react-email/render`: **NO instalado** (el rendering en produccion lo hace Resend internamente)

**Mitigacion**: Instalar `@react-email/render` como devDependency y usar su funcion `render()` (asincrona, retorna `Promise<string>`). Esta es la funcion oficial de React Email y es future-proof. Alternativa: `renderToStaticMarkup` de `react-dom/server` (sincrono, no oficialmente deprecado pero React Email recomienda no usarlo).

### Riesgo 4 -- Biome `noExplicitAny` en tests de logger (BAJO)

**Descripcion**: El test actual de logger usa `(logger as any).http(...)` para llamar metodos custom registrados dinamicamente. Esto viola la regla `noExplicitAny`.

**Mitigacion**: Usar type assertions mas especificas o castear a `ILogger & Record<string, (params: unknown, options?: LoggerOptions) => void>` en lugar de `any`.

### Riesgo 5 -- `packages/email` no tiene vitest.config.ts (BAJO)

**Descripcion**: A diferencia de los otros 3 packages, `packages/email` no tiene `vitest.config.ts`. Hay que crearlo desde cero.

**Mitigacion**: Usar la estructura del vitest.config.ts de `packages/auth-ui` como referencia. Ver seccion "Test strategy" del package email para el template exacto. Configurar `environment: 'node'` (los templates se renderizan server-side via `@react-email/render`).

### Riesgo 6 -- `packages/billing` puede requerir atencion en imports (BAJO)

**Descripcion**: Los archivos de billing usan `.js` en los imports relativos (ESM). Al escribir nuevos tests, hay que asegurarse de importar desde rutas correctas.

**Mitigacion**: Seguir el patron de imports de los 9 archivos de test existentes (ej. `../../src/adapters/mercadopago`). Estos archivos sirven como referencia confiable para la estructura de imports del package.

---

## Definition of Done

- [ ] Cobertura >=90% en los 4 packages (verificado con `pnpm test:coverage`)
- [ ] Coverage thresholds en `vitest.config.ts` de los 4 packages actualizados a 90%
- [ ] 0 tests saltados (`it.skip`) sin comentario explicativo
- [ ] 0 tests pendientes (`it.todo`) que deberian estar implementados
- [ ] `pnpm typecheck` pasa sin errores en los 4 packages
- [ ] `pnpm lint` pasa sin errores en los 4 packages
- [ ] Todos los tests nuevos documentados con JSDoc en los `describe` principales
- [ ] Spec actualizado a `status: completed`
- [ ] Al menos un test de regresion por cada bug conocido o comportamiento ambiguo descubierto durante la implementacion
- [ ] Los props de cada componente de auth-ui coinciden con los documentados en este spec
- [ ] Ningun test mockea `URLSearchParams` para `ResetPasswordForm` ni `VerifyEmail` (token es prop)
- [ ] Los tests de email usan `await render()` de `@react-email/render` (asincrono, recomendado) o `renderToStaticMarkup` de `react-dom/server` (sincrono, con deprecation warning)
- [ ] `@react-email/render` fue instalado como devDependency en `packages/email`
- [ ] Los tests de templates assertean texto en espanol (los templates de Hospeda estan en espanol)
- [ ] `packages/email/vitest.config.ts` fue CREADO (no existia previamente)
- [ ] `@testing-library/user-event` fue instalado en `packages/auth-ui`
- [ ] `shouldUseWhiteText` y `redactSensitiveData` fueron exportadas en `formatter.ts` y re-exportadas en el index del logger
