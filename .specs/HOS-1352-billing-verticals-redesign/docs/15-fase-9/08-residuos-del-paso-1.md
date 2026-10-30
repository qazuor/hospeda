---
title: "FASE 9 · lo que el PASO 1 dejó abierto, para la 8-bis"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 — residuos del PASO 1

Aplicar las decisiones a los capítulos produce dos clases de resultado: lo que queda escrito, y
**lo que la aplicación descubre que la decisión no cubría**. Esto segundo es lo que vive acá.

**Por qué existe este documento y no una nota suelta.** `D-30` decidió que la FASE 8 vuelve a
correr sobre el diseño que la 9 produjo, *«para asegurarnos que con los cambios de la 9 no aparece
ningún problema nuevo»*, y su evidencia son dos defectos —`D-01` y `D-20`— que **se cazaron de
casualidad** mientras se resolvía otra cosa. Un residuo que sólo viva en el chat es exactamente eso
otra vez. Acá quedan **nombrados**, para que la 8-bis los recorra en vez de redescubrirlos.

**Esto no es una lista de pendientes del owner** (ésos están en el §«Lo que sigue abierto» de
[`07-decisiones-del-owner.md`](./07-decisiones-del-owner.md)) **ni de hallazgos nuevos**. Es lo que
una decisión ya tomada promete y su aplicación no alcanza a cumplir.

---

## RES-01 · `D-04` cierra la mitad `Turista Free` de `F-8A1-005`, no la mitad `Guest`

**Estado**: abierto, con causa declarada. **Decidido el 2026-09-19**: queda para la 8-bis.

`D-04` eligió la salida (a) —el quinto tipo de título— y uno de sus tres argumentos es que *«es la
única que además cierra `F-8A1-005`»*. **La cierra a medias**, y la mitad que no cierra estaba
escrita en el propio hallazgo.

`F-8A1-005` tiene dos sujetos y su camino los trata distinto:

| sujeto | dónde se caía | ¿lo destraba el título `BASE`? |
|---|---|---|
| **`Turista Free`** | paso 5, *«sin cobertura»* — el §14 lo define **sin suscripción real** y ninguno de los cuatro tipos lo representaba | **sí.** Pasa los pasos 1 a 4 sin problema, y ahora tiene fuente en el 5 |
| **`Guest`** | **paso 1**, *«no autenticado»* | **no.** Nunca llega al paso 5 |

El hallazgo es literal: *«Paso 1 pregunta "¿hay un actor?" y responde "no autenticado". El Guest se
cae en el primer paso»*, y recién después dice *«supongamos que pasa»* para razonar sobre los pasos
2, 3 y 5. Un título en el paso 5 no ayuda a quien se cae en el 1.

**La contradicción es interna a `V/17` y es anterior a esta tanda.** El §3.3 declara textual que
*«el `Guest` del §6 es **un actor del modelo, no la falta de uno**»*, y el §1.2 lo rechaza en el
paso 1 por no autenticado. `D-04` no la toca.

**Por qué no se resolvió en el PASO 1**, y son dos razones independientes:

1. **Admitir al `Guest` en el paso 1 deja DOS de los nueve pasos incapaces de rechazar a nadie**
   —el 1 y el 5—, y eso es una decisión de arquitectura, no la aplicación de una decisión tomada.
2. **Arrastra `A-ENT-02`** —qué puede hacer el visitante sin cuenta—, que el capítulo 17 declara
   explícitamente que **no cierra** y delega en el capítulo 15. Resolverlo bien es trabajo de otro
   capítulo.

**Qué tiene que mirar la 8-bis**: si el paso 1 admite al `Guest`, qué lo rechaza entonces —el paso
2 pregunta por correo verificado, que un `Guest` no tiene, y eso bloquearía la lectura pública que
el §36.2 promete gratis—. Los pasos 1, 2 y 3 de `V/17` §1.2 hay que recorrerlos juntos.

**Lo que NO hay que volver a discutir**: la mitad `Turista Free` está cerrada, y la salida barata
—marcar las rutas públicas como exentas de la resolución— ya está descartada por escrito en `R3` §5
y en el propio `F-8A1-005`. Es el fail-open que todo el capítulo 17 existe para impedir.
