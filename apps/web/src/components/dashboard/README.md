# Dashboard Components

Componentes React para el panel de facturación del usuario en la aplicación web.

## Componentes

### ActiveAddons

Muestra los complementos activos del usuario con opciones de gestión.

**Características:**

- Lista de complementos activos
- Badges de estado (activo, por vencer, vencido)
- Fechas de compra y vencimiento
- Botones para renovar/cancelar
- Estados de carga y error
- Estado vacío con CTA

**API Endpoint:** `GET /api/v1/billing/addons/mine`

**Uso:**

```astro
---
import { ActiveAddons } from '@/components/dashboard';
---

<ActiveAddons client:load />
```

### UsageMeters

Muestra barras de progreso para el uso de recursos del plan.

**Características:**

- Barras de progreso con código de colores
- Verde (<80%), Amarillo (80-89%), Naranja (90-99%), Rojo (100%)
- Texto descriptivo del uso (X / Y usado)
- Alertas cuando se acerca/alcanza el límite
- CTA para mejorar plan cuando es necesario
- Oculta límites en cero o muestra "Ilimitado"
- Accesible (aria labels, color + texto)

**API Endpoint:** `GET /api/v1/billing/usage`

**Uso:**

```astro
---
import { UsageMeters } from '@/components/dashboard';
---

<UsageMeters client:load />
```

### BillingHistory

Lista cronológica de eventos de facturación con paginación.

**Características:**

- Lista de eventos (pagos, cambios de plan, compras de add-ons)
- Badges de tipo y estado
- Filtro por tipo de evento
- Paginación con "cargar más"
- Enlaces a comprobantes cuando disponibles
- Estados de carga y error

**API Endpoint:** `GET /api/v1/billing/history`

**Uso:**

```astro
---
import { BillingHistory } from '@/components/dashboard';
---

<BillingHistory client:load />
```

## Ejemplo de Página Completa

Ver `/apps/web/src/pages/mi-cuenta/billing.astro` para un ejemplo de cómo integrar todos los componentes en una página.

## Directivas de Cliente

Todos los componentes son React islands y requieren una directiva de cliente:

- `client:load` - Carga inmediata (recomendado para contenido above-the-fold)
- `client:visible` - Carga cuando es visible (recomendado para contenido below-the-fold)
- `client:idle` - Carga cuando el navegador está inactivo

**Ejemplo con diferentes directivas:**

```astro
<!-- Visible inmediatamente -->
<UsageMeters client:load />

<!-- Más abajo en la página -->
<ActiveAddons client:visible />
<BillingHistory client:visible />
```

## Estilos

Los componentes usan Tailwind CSS y siguen los patrones de diseño existentes en `/apps/web/src/components/pricing/`.

## Autenticación

Estos componentes están diseñados para páginas autenticadas. Asegurarse de:

1. Configurar `prerender = false` en la página Astro
2. Verificar autenticación con Clerk
3. Redirigir usuarios no autenticados

```astro
---
export const prerender = false;

const { userId } = Astro.locals.auth();

if (!userId) {
  return Astro.redirect('/auth/sign-in?redirect=/mi-cuenta/billing');
}
---
```

## Variables de Entorno

Los componentes utilizan `PUBLIC_API_URL` para construir las URLs de la API:

```env
PUBLIC_API_URL=http://localhost:3001
```

En producción, esta variable debe apuntar a la URL de la API en producción.

## Manejo de Errores

Todos los componentes manejan errores de manera consistente:

- Muestran un mensaje de error amigable
- Logean el error en la consola
- Mantienen la UI estable (no rompen la página)

## Accesibilidad

- **UsageMeters**: Usa `role="progressbar"` y atributos ARIA
- **Todos**: Colores + texto para indicadores (no solo color)
- **Todos**: Textos descriptivos en botones y enlaces
- **Todos**: Estados de carga claramente indicados

## Testing

Los tests para estos componentes se encuentran en tareas separadas:

- T-037: Tests de Active Add-ons
- T-038: Tests de Usage Meters
- T-039: Tests de Billing History
