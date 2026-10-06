# Sonda 50: desactivar un `preapproval_plan` (2026-09-24, producción)

Script: [`probe-50-desactivar-un-plan.mjs`](./probe-50-desactivar-un-plan.mjs). Sujeto propio:
`d256f5eb9b76482bafa0e8d78c7a640e` (`HOS1352 sonda 50 desactivar plan`, ARS 15/mes, sin
suscriptores). Ninguno de los cinco planes viejos se tocó.

## Lo que se midió, cada paso releído por id

| paso | acto | respuesta | relectura |
|---|---|---|---|
| alta | `POST /preapproval_plan` | 201 | `active`, 22:38:46 `-04` |
| A1 | `PUT {status:"inactive"}` | 200, devuelve `cancelled` | **`cancelled`**, `last_modified` 22:38:47 |
| A4 | `PUT {status:"active"}` | 200 | **`active`**, `last_modified` 22:38:50 |
| cierre | `PUT {status:"cancelled"}` | 200 | **`cancelled`**, 22:39:05 (así quedó) |

- **Se puede desactivar por API**, y el proveedor traduce `inactive` a `cancelled`.
- **Es reversible.** La documentación del proveedor dice que cancelar un plan es irreversible, y
  lo describe sólo desde el panel. Por API, un plan cancelado **volvió a `active`**.
- **El `init_point` no cambia** al cancelar.

## El link, en el navegador

Desde un script el checkout responde `403`, **también con el plan activo**: el 403 no distingue
nada. Por eso se abrió en Chrome, sin completar nada:

- **control**, plan viejo Basic `87e4dae6…` activo: *«Hospeda · Basic — mensual — 30 días de
  prueba · $18.000/mes · Elegir medio de pago»*. **Vende.**
- **plan de la sonda, cancelado**: *«Este plan no está aceptando suscripciones. Para asociarte,
  comunicate con el vendedor.»* **No vende.**

## Lo que NO mide

- Qué les pasa a los **suscriptores existentes** de un plan cancelado. La documentación dice que
  siguen cobrando. Acá no había ninguno.
- Si al reactivar un plan el link vuelve a vender. Por la relectura (`active`, mismo
  `init_point`) es lo esperable, pero no se abrió en el navegador después de A4.
