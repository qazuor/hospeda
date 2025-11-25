# E2E Tests - Análisis Profundo y Plan de Acción

**Fecha:** 2025-11-24
**Analista:** Claude (Opción C - Análisis Profundo)
**Estado:** 17 tests fallidos, 5 pasando (de 22 total)

---

## 📊 Resumen Ejecutivo

### Estado Actual

- ✅ **Problemas de Enum RESUELTOS**: Todos los valores enum ahora usan formato correcto (`lowercase_with_underscores`)
- ❌ **Nuevos Problemas Identificados**: Errores 500/404/400 en rutas API
- 📈 **Progreso**: De 0% funcional a 22.7% funcional (5/22 tests pasan)

### Tests por Escenario

| Escenario | Tests | Pasando | Fallando | Estado |
|-----------|-------|---------|----------|--------|
| Setup | 3 | 3 ✅ | 0 | ✅ OK |
| Scenario 1: Complete Flow | 3 | 0 | 3 ❌ | 🔴 500 errors |
| Scenario 2: Upgrade Flow | 3 | 0 | 3 ❌ | 🔴 404 errors |
| Scenario 3: Renewal Flow | 3 | 0 | 3 ❌ | 🔴 404 errors |
| Scenario 4: Cancellation Flow | 5 | 0 | 5 ❌ | 🔴 404 errors |
| Scenario 5: Failed Payment | 5 | 0 | 5 ❌ | 🔴 400 errors |

---

## 🔍 Análisis Detallado de Problemas

### 1. Problemas Resueltos ✅

#### 1.1 Valores Enum Incorrectos

**Problema:** Tests y seed helpers usaban valores enum en mayúsculas que no coincidían con el schema de base de datos.

**Archivos Corregidos:**

1. `test/e2e/setup/seed-helpers.ts`
   - `billingScheme`: `'RECURRING'` → `'recurring' as const`
   - `interval`: `'MONTHLY'` → `'month' as const`
   - `type`: `ProductTypeEnum.SUBSCRIPTION` (no existe) → `'listing_plan' as const`
   - `status`: Agregado default `'active' as const`

2. `test/e2e/flows/subscription/scenario-1-complete-flow.test.ts`
   - Líneas 67-68: billingScheme e interval corregidos

3. `test/e2e/flows/subscription/scenario-2-upgrade-flow.test.ts`
   - Líneas 59-60, 67-68: billingScheme e interval corregidos (2 planes)

4. `test/e2e/flows/subscription/scenario-3-renewal-flow.test.ts`
   - Líneas 57-58: billingScheme e interval corregidos

5. `test/e2e/flows/subscription/scenario-4-cancellation-flow.test.ts`
   - Líneas 58-59: billingScheme e interval corregidos
   - Múltiples líneas: `'CANCELLED'` → `'cancelled'`, `'ACTIVE'` → `'active'`

6. `test/e2e/flows/subscription/scenario-5-failed-payment.test.ts`
   - Múltiples líneas: Todos los status corregidos
   - `'PENDING'` → `'pending'`
   - `'PAST_DUE'` → `'past_due'`
   - `'ACTIVE'` → `'active'`

**Estado:** ✅ COMPLETAMENTE RESUELTO

---

### 2. Problemas Nuevos Identificados ❌

#### 2.1 Error 500 - Internal Server Error (Scenario 1)

**Afecta a:** 3 tests del Scenario 1

**Síntomas:**

```
Service
API message Route error
[ERROR]

AssertionError: expected 500 to be 201 // Object.is equality
```

**Endpoint:** `POST /api/v1/subscriptions`

**Causa Probable:**

- Error interno en `SubscriptionService.create()`
- Posible problema con permisos del actor
- Error de validación no manejado
- Problema con el schema `SubscriptionCreateHttpSchema`

**Evidencia:**

- Ruta registrada correctamente (línea 160 en `src/routes/index.ts`)
- Servicio existe (`packages/service-core/src/services/subscription/`)
- Schema HTTP existe (`packages/schemas/src/entities/subscription/subscription.http.schema.ts`)

**Tests Afectados:**

1. `should complete full subscription creation flow`
2. `should reject subscription with invalid client ID`
3. `should reject subscription with invalid pricing plan ID`

---

#### 2.2 Error 404 - Not Found (Scenarios 2, 3, 4)

**Afecta a:** 9 tests (3+3+3)

**Síntomas:**

```
AssertionError: expected 404 to be 200 // Object.is equality
```

**Endpoints Afectados:**

- `PUT /api/v1/subscriptions/{id}` - Update subscription

**Causa Probable:**

- Ruta UPDATE de subscriptions no está funcionando correctamente
- Posible problema con el routing de parámetros dinámicos `/:id`
- El subscription ID no se está encontrando

**Tests Afectados:**

**Scenario 2 (Upgrade Flow):**

1. `should successfully upgrade subscription to premium plan`
2. `should handle upgrade to same plan`
3. `should handle downgrade from premium to basic`

**Scenario 3 (Renewal Flow):**

1. `should successfully renew subscription for next period`
2. `should handle renewal of active subscription with time remaining`
3. `should maintain subscription status during renewal`

**Scenario 4 (Cancellation Flow):**

1. `should successfully cancel active subscription`
2. `should handle cancellation of already cancelled subscription`
3. `should allow deletion (soft delete) of cancelled subscription`
4. `should maintain client and plan references after cancellation`

---

#### 2.3 Error 400 - Bad Request (Scenario 5)

**Afecta a:** 4 tests del Scenario 5

**Síntomas:**

```
AssertionError: expected 400 to be 201 // Object.is equality
```

**Endpoints Afectados:**

- `POST /api/v1/payments` - Create payment

**Causa Probable:**

- Validación del schema `PaymentCreateHttpSchema` fallando
- Campos requeridos faltantes en el payload
- Tipo de datos incorrecto en el request body

**Tests Afectados:**

1. `should handle failed payment and update subscription to PAST_DUE`
2. `should handle multiple failed payment attempts`
3. `should recover subscription after successful payment following failure`
4. `should handle payment rejection reasons correctly`

---

## 🗂️ Estructura de API Verificada

### Rutas Registradas Correctamente ✅

Todas las siguientes rutas están registradas en `src/routes/index.ts`:

```typescript
// Línea 160
app.route('/api/v1/subscriptions', subscriptionRoutes);

// Línea 172
app.route('/api/v1/payments', paymentRoutes);

// Línea 152
app.route('/api/v1/pricing-plans', pricingPlanRoutes);

// Línea 148
app.route('/api/v1/products', productRoutes);

// Línea 140
app.route('/api/v1/clients', clientRoutes);
```

### Archivos de Ruta Verificados ✅

**Subscription Routes** (`src/routes/subscription/`):

- ✅ `index.ts` - Router principal
- ✅ `create.ts` - POST /
- ✅ `update.ts` - PUT /:id
- ✅ `getById.ts` - GET /:id
- ✅ `list.ts` - GET /
- ✅ `delete.ts` - DELETE /:id

**Payment Routes** (`src/routes/payment/`):

- ✅ `index.ts` - Router principal
- ✅ `create.ts` - POST /
- ✅ `update.ts` - PUT /:id
- ✅ `getById.ts` - GET /:id
- ✅ `list.ts` - GET /
- ✅ `delete.ts` - DELETE /:id

### Servicios Verificados ✅

**SubscriptionService:**

- ✅ Ubicación: `packages/service-core/src/services/subscription/subscription.service.ts`
- ✅ Extiende: `BaseCrudService`
- ✅ Métodos: create, update, findById, findAll, softDelete, hardDelete, restore
- ✅ Permisos: Implementados (líneas 62-74 para create)

**PaymentService:**

- ⚠️ Necesita verificación (no revisado en este análisis)

### Schemas Verificados ✅

**Subscription Schemas:**

- ✅ `SubscriptionSchema` - Schema base
- ✅ `SubscriptionCreateInputSchema` - Para create operations
- ✅ `SubscriptionCreateHttpSchema` - Con coerción HTTP
- ✅ `SubscriptionUpdateInputSchema` - Para update operations
- ✅ `SubscriptionQuerySchema` - Para búsquedas

**Payment Schemas:**

- ⚠️ Necesita verificación

---

## 🔬 Investigación Necesaria

### Prioridad Alta 🔴

#### 1. Debug Error 500 en Subscription Create

**Acciones:**

1. Agregar logging detallado en `src/routes/subscription/create.ts`
2. Verificar que el actor se está extrayendo correctamente
3. Verificar validación del schema `SubscriptionCreateHttpSchema`
4. Revisar permisos requeridos vs. permisos del mock actor
5. Verificar que `SubscriptionService.create()` no tenga errores

**Comandos para debugging:**

```bash
# Ver logs detallados del test
cd apps/api && pnpm test:e2e --reporter=verbose test/e2e/flows/subscription/scenario-1-complete-flow.test.ts

# Verificar estructura del mock actor
grep -r "createMockAdminActor" test/
```

#### 2. Debug Error 404 en Subscription Update

**Acciones:**

1. Verificar que la ruta `PUT /:id` está registrada correctamente
2. Verificar que el ID del subscription creado existe antes del UPDATE
3. Revisar route handler en `src/routes/subscription/update.ts`
4. Verificar path parameters parsing

**Test manual:**

```bash
# Crear subscription primero, guardar ID
# Luego intentar UPDATE con ese ID
```

#### 3. Debug Error 400 en Payment Create

**Acciones:**

1. Revisar schema `PaymentCreateHttpSchema`
2. Comparar payload del test con schema esperado
3. Verificar campos requeridos
4. Agregar logging en `src/routes/payment/create.ts`

---

### Prioridad Media 🟡

#### 4. Verificar Actor Permissions

**Mock Actor Actual:**

```typescript
// test/helpers/auth.ts
export function createMockAdminActor()
```

**Permisos Necesarios:**

- `SUBSCRIPTION_CREATE`
- `SUBSCRIPTION_UPDATE`
- `SUBSCRIPTION_DELETE`
- `PAYMENT_CREATE`
- `PAYMENT_UPDATE`

**Acción:** Verificar que el mock actor tiene todos los permisos necesarios.

#### 5. Revisar Transaction Rollback

Los tests usan transacciones para aislar datos:

```typescript
beforeEach(async () => {
    transactionClient = await testDb.beginTransaction();
});

afterEach(async () => {
    await testDb.rollbackTransaction(transactionClient);
});
```

**Posible problema:** Las rutas API no están usando el mismo transaction client.

---

## 📋 Plan de Acción Detallado

### Fase 1: Investigación y Diagnóstico (1-2 horas)

#### Step 1.1: Agregar Logging Detallado

- [ ] Agregar console.log en `src/routes/subscription/create.ts` para ver:
  - Actor recibido
  - Body recibido
  - Resultado del servicio
- [ ] Agregar console.log en `src/routes/subscription/update.ts`
- [ ] Agregar console.log en `src/routes/payment/create.ts`

#### Step 1.2: Ejecutar Tests con Logging

```bash
cd apps/api
pnpm test:e2e test/e2e/flows/subscription/scenario-1-complete-flow.test.ts 2>&1 | tee test-output.log
```

#### Step 1.3: Analizar Errores Específicos

- [ ] Identificar stacktrace completo de error 500
- [ ] Verificar qué está devolviendo la API exactamente
- [ ] Revisar si es problema de permissions, validation, o código

---

### Fase 2: Corrección de Problemas (2-3 horas)

#### Opción A: Si es problema de Permissions

- [ ] Actualizar `createMockAdminActor()` con permisos faltantes
- [ ] Verificar que permisos existen en `PermissionEnum`
- [ ] Re-ejecutar tests

#### Opción B: Si es problema de Validation

- [ ] Revisar schemas HTTP
- [ ] Ajustar payloads en tests
- [ ] Verificar coerción de tipos (dates, booleans)

#### Opción C: Si es problema de Código

- [ ] Debuggear servicio línea por línea
- [ ] Verificar que modelos funcionan correctamente
- [ ] Revisar manejo de errores en routes

---

### Fase 3: Verificación y Documentación (30 min)

- [ ] Ejecutar todos los tests E2E
- [ ] Verificar que pasan al menos 19/22 tests (85%+)
- [ ] Actualizar SEGUIR.md con estado final
- [ ] Documentar fixes aplicados

---

## 💡 Recomendaciones

### Inmediatas

1. **Agregar Better Error Logging:** Los errores 500 deben mostrar stacktrace completo en desarrollo
2. **Verificar Actor Mock:** Asegurar que tiene TODOS los permisos necesarios
3. **Test Manual de API:** Usar Postman/curl para probar endpoints directamente

### A Mediano Plazo

1. **Mejorar Mensajes de Error:** Los tests deberían mostrar qué falló exactamente
2. **Agregar Integration Tests:** Tests unitarios de rutas API
3. **CI/CD Integration:** Ejecutar E2E tests en cada PR

---

## 📌 Próximos Pasos Sugeridos

### Opción 1: Debug Rápido (30 min - 1 hora)

1. Agregar console.logs en create/update routes
2. Re-ejecutar scenario 1
3. Ver qué error exacto se está lanzando
4. Fix rápido si es obvio

### Opción 2: Investigación Completa (2-3 horas)

1. Seguir Fase 1 completa
2. Identificar TODOS los problemas
3. Crear lista de fixes necesarios
4. Ejecutar Fase 2
5. Verificar con Fase 3

### Opción 3: Pausar y Documentar (15 min)

1. Actualizar SEGUIR.md con este análisis
2. Marcar como "blocked - needs API fixes"
3. Continuar con otras tareas del backlog

---

## 🎯 Estimaciones

| Tarea | Tiempo Estimado | Confianza |
|-------|-----------------|-----------|
| Debug completo error 500 | 1-2 horas | Media |
| Fix error 500 | 30 min - 1 hora | Alta (si es permissions) |
| Debug error 404 | 30 min - 1 hora | Alta |
| Fix error 404 | 15-30 min | Alta |
| Debug error 400 | 30 min | Alta |
| Fix error 400 | 15-30 min | Media |
| Verificación final | 30 min | Alta |
| **TOTAL** | **3-6 horas** | - |

---

## ✅ Conclusiones

### Lo Que Sabemos

1. ✅ Rutas están registradas correctamente
2. ✅ Servicios existen y tienen estructura correcta
3. ✅ Schemas están definidos
4. ✅ Problemas de enum completamente resueltos
5. ⚠️ Hay errores internos en la ejecución de las rutas

### Lo Que NO Sabemos

1. ❓ Qué error específico causa el 500 en create
2. ❓ Por qué UPDATE devuelve 404
3. ❓ Qué campo exacto falta en payment create
4. ❓ Si el mock actor tiene permisos correctos

### Camino Crítico

Para desbloquear los E2E tests necesitamos:

1. **DEBE:** Fix error 500 en subscription create
2. **DEBE:** Fix error 404 en subscription update
3. **DEBE:** Fix error 400 en payment create
4. **DEBERÍA:** Agregar mejor logging
5. **PODRÍA:** Refactorizar tests para mejor debugging

---

**Documento generado por:** Claude Code
**Fecha:** 2025-11-24 10:25 ART
