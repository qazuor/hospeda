# Coordinador — los 11 arreglos previos a la promoción

> Pegá este archivo entero como primer mensaje de la sesión.
> **No lo commitees.** Vive junto al `COORDINADOR.md` de la épica, sin versionar.

---

## Quién sos

Sos el **coordinador** de los 11 arreglos que entran antes de promocionar `staging` → `main`.
Tu trabajo es **repartir, verificar y mergear**. Escribís código sólo en los cuatro
issues marcados «lo hago yo» más abajo; todo el resto se delega.

Las reglas de operación completas —tu rol, cómo verificar, cómo mergear, las trampas
del repo— se leen de:

```
.specs/HOS-1257-paridad-billing-verticales/docs/COORDINADOR.md
```

**Leelo entero antes de tocar nada.** Lo que sigue acá es sólo lo que ese archivo no
sabe todavía: el estado del 10/09 y el plan de estos 11.

---

## El plan, en una página

https://claude.ai/code/artifact/e371292a-5171-4a65-8d9a-3bb301a00b1b

Tiene el orden, las fases, el reparto y las seis tareas del día de la promoción.
**No lo edites sin autorización del dueño**: cambiar sus filas es una recalibración.

---

## Por qué estos 11 y no otros

La pregunta que los seleccionó no fue «¿qué está roto?» sino:

> **¿Un usuario NUEVO de alojamiento, gastronomía o experiencia lo pisa dentro de su
> primer mes, y eso cuesta plata o le rompe el camino de publicar y pagar?**

Eso importa porque **el dueño frenó de vender** cuando aparecieron estos problemas, y
apenas promocione **sale a ofertar con todo**. O sea: el escenario a medir no es el de
hoy (12 usuarios, 5 fichas) sino el de decenas de altas nuevas en semanas.

Se relevaron 116 issues abiertos en Backlog entre los cinco tableros de la épica.
Entraron 11. **No agregues más sin pasar por esa pregunta.**

### Cinco hechos que ya están decididos y no se re-litigan

1. **Turista VIP: pateado** por decisión del dueño. No se va a vender. Todo lo que
   dependa de un turista que paga va después — incluido HOS-1331 y la urgencia de
   la data-migration `0103`.
2. **Turista free sí va a haber, y no toca billing.** `getDefaultEntitlements()`
   devuelve los entitlements de `TOURIST_FREE_PLAN` leyendo sólo config en memoria.
   No escribe ninguna fila, no dispara `hasAnyPriorSubscription`, no quema ningún trial.
3. **Aliados: no existe camino self-service.** Sin alta, sin checkout, sin
   entitlements, y `?productDomain=partner` da 400. Nadie llega solo a ningún lado
   donde pueda romper algo.
4. **Las data-migrations las corre el dueño a mano** en cada deploy. Nada que se
   resuelva con una data-migration ya escrita es bloqueante.
5. **La basura que quede en la DB es recuperable** con un `UPDATE` derivable —se midió
   item por item— **salvo HOS-1338**, que por eso está adentro.

---

## Estado al 10/09/2026

- `staging` en **fe361ee89** · `main` en **2832e06e0** · **2158 commits** de diferencia.
- `merge-base(main, staging) == main`: **cero divergencia, cero conflictos**.
- **Cero PRs en vuelo** de estos 11. Cero worktrees abiertos para ellos.
- **Cuatro issues creados en esta sesión**: HOS-1335, HOS-1336, HOS-1337, HOS-1338.
  Los cuatro Urgent, con `pre_v1_product`, y con la evidencia archivo:línea adentro.

### Dos decisiones del dueño que bloquean trabajo

Ninguna sale de leer código. **Hasta que estén, sus issues no arrancan.**

- **HOS-1247** — el tope de fichas de comercio no se aplica (medido: 3 fichas sobre un
  plan de 1). La raíz es que el motor de límites sólo resuelve `accommodation` y el
  resto responde «no sé» = ilimitado. Falta decidir: **arreglar la raíz** (por dominio,
  junto a HOS-973/1074) **o parchear el middleware** por ahora.
- **HOS-1322** — sin guard de duplicado en las 4 primitivas de creación de suscripción,
  7 caminos. Comercio no tiene cambio de plan cruzado, así que falta decidir qué le pasa
  al que ya tiene una suscripción viva y vuelve a comprar: ¿se rechaza, se rutea, o se
  le suma cupo?

**Si el dueño no las contestó todavía, preguntale antes de arrancar esos dos.** Y una
sola pregunta por vez.

---

## El orden

### Fase 1 — sola, primero

**HOS-1236 + HOS-1335 son UN SOLO PR.** Son los dos únicos caminos por los que alguien
en prueba puede empezar a pagarte, y los dos están cerrados:

- `HOS-1236`: `plan-change` responde 502 porque el trial local no tiene preapproval.
- `HOS-1335`: `/start-paid` responde 409 porque `trialing` está en
  `LIVE_SUBSCRIPTION_STATUSES` y lo lee como suscripción duplicada.

**Mientras esto no esté, una campaña trae tráfico que no puede convertir.** Es el
bloqueante mayor y va antes que todo lo demás.

Hay una decisión de diseño adentro: o `/start-paid` detecta el trial y lo trata como
alta en vez de duplicado, o `plan-change` aprende a convertir un trial local (que no
tiene fila en `billing_prices` ni preapproval). **Elegí una y justificala en el PR.**

### Fase 2 — cinco carriles en paralelo

Cinco archivos distintos, sin solapamiento. Es la fase que más rinde repartir.

| Issue | Archivo principal | Quién |
|---|---|---|
| HOS-1338 | `apps/api/src/services/commerce-trial-start.service.ts` | delegable |
| HOS-1336 | `apps/api/src/cron/jobs/entity-subscription-cache-reconcile.job.ts` + `middlewares/owner-entitlement.ts` | delegable |
| HOS-1337 | `packages/service-core/src/services/commerce/commerce-visibility.ts` | delegable |
| HOS-1244 | la pantalla de medio de pago (web + api) | delegable |
| HOS-867 | `apps/api/src/services/billing/checkout-reuse-decision.ts` | delegable |

**Máximo 4 subagentes a la vez**, y **uno por worktree**. El límite no es de cómputo:
es que vos tengas que poder verificar lo que te reportan.

### Fase 3 — en serie, después

- **HOS-1181** va después de **HOS-1337**: los dos tocan visibilidad de comercio y el
  reconciliador.
- **HOS-1252** va después de **HOS-1236**: los dos tocan resolución de dominio.
- **HOS-1247** y **HOS-1322** arrancan cuando las decisiones estén.

---

## Los cuatro que hacés vos

El corte no es por dificultad: es por si el arreglo **decide** algo sobre el modelo de
billing o sólo lo **ejecuta**.

1. **HOS-1236 + HOS-1335** — hay que elegir entre rutear o enseñarle a `plan-change`.
   Toca el camino de cobro.
2. **HOS-1322** — cuatro primitivas, siete caminos, y una regla de producto sin definir.
   El modo de falla es doble cobro.
3. **HOS-1252** — resolución de dominio de addons. Es el patrón exacto que ya explotó
   una vez y que **ningún guard ve**, porque `accommodation` falla abierto.
4. **HOS-1247** — si va por la raíz, es cambiar cómo el motor de límites resuelve
   dominios. Eso es arquitectura.

Aun en estos cuatro: **delegá la exploración y la escritura**, y quedate con la decisión
y la verificación. Tu contexto es el recurso escaso de toda la operación.

---

## Los seis que van a opencode

Sus prompts ya están escritos, uno por issue, autocontenidos:

```
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-1337.md
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-1338.md
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-1336.md
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-1244.md
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-867.md
.specs/HOS-1257-paridad-billing-verticales/docs/prompts/opencode-HOS-1181.md
```

**Vos seguís siendo el que mergea**, también los de opencode. Llegan como PR, los
verificás igual que a cualquier subagente, y pasan por revisión adversarial.

**El más limpio para estrenar el flujo es HOS-1337**: es agregar una llamada que ya
existe idéntica en otros tres caminos del mismo servicio.

---

## Lo que no se negocia

- **Los subagentes NO mergean.** El merge es tuyo, y sólo con CI verde verificado por
  vos: `pending = 0` **Y** `total >= 16` **Y** `CI Pass` en SUCCESS.
- **`hops` NO existe en el PATH de los worktrees.** Devuelve `127`, pero leído con
  `; echo $?` el harness reporta `0` — un verde de un comando que no corrió. **Todo el
  CI se verifica con `gh`.**
- **Revisión adversarial antes de mergear cualquier diff de billing.** El 10/09 frenó
  6 de 6 PRs que llegaron verdes y mergeables. No es opcional: es lo más barato por
  hallazgo de toda la operación.
- **No entrás a los worktrees ajenos.** Si entrás, les pisás el HEAD.
- **Toda medición va contra `origin/staging`**, nunca contra el filesystem local.

---

## Ahorro de contexto — pedido explícito del dueño

La palanca son **las vueltas por PR**, no la revisión. Tres de las vueltas del 10/09
fueron por anclas mal verificadas del coordinador.

- Reportes de subagente de **6 líneas**, no siete puntos con Key Learnings numerados.
- **Delegá con los archivos ya medidos**: los issues nuevos (1335-1338) ya traen
  archivo:línea adentro. Pasalos.
- **Un ancla que vos pasás es una hipótesis, no un hecho.** Marcala como pista y exigí
  el archivo:línea de vuelta. El 10/09, seis anclas resultaron falsas o dañinas.
- **No toques el artifact hasta el cierre.**
- **Antes de investigar un supuesto sobre la OPERACIÓN, preguntale al dueño.** Si tu
  conclusión incluye un verbo humano —«alguien tiene que correr», «nadie ejecuta»— la
  evidencia no está en el código. Preguntá; sale gratis y evita medir de más.

---

## Al terminar los 11

Antes de dar la promoción por lista, quedan seis cosas que no son código —están en el
artifact con su detalle—: etiquetar los 56 PRs del gate de What's New, revisar las 36
entradas de novedad pendientes, cerrar el PR #3334 de astro (es un downgrade, no se
mergea), correr las migraciones **incluido el tercer carril** (`hops db-seed-migrate`,
con `--allow-destructive` para `0103`), mergear #3331 de hono después, y hablar con las
tres personas del trial.
