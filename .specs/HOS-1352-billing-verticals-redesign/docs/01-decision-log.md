---
title: Decision Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Decision Log

Registro explícito de las decisiones del programa, exigido por el [PDR](./00-PDR.md) §3.4.

**Ninguna decisión vive en otro lado**: ni en un comentario de código, ni en un mensaje de
chat, ni en la memoria de un agente, ni en un sistema de tracking. Si no está acá, no se
decidió.

Si una decisión se aparta del PDR, el PDR **no se edita** (§3.1): se registra acá el
apartamiento y por qué.

## Formato

Cada entrada lleva, según §3.4:

```
### DEC-<AREA>-<NNN> — <título>

- Fecha · Estado · Decide
- Problema
- Alternativas
- Decisión
- Motivo
- Implicaciones
- Reemplaza a
- Origen (ID de FASE 1A)
```

Áreas: `TRIAL` · `SUB` · `BILL` · `MP` · `ENT` · `LIM` · `ADDON` · `PROMO` · `AUTH` ·
`DATA` · `MAIL` · `ADMIN` · `ARCH` · `MIG` · `GRANT` · `LEGAL` · `TEST` · `METH`.

## Reglas

1. Una decisión `ACCEPTED` **no se edita**. Se cambia creando otra que la marque
   `SUPERSEDED`, con el motivo del cambio.
2. Toda decisión que cierre un ítem de [`04-open-decisions.md`](./04-open-decisions.md)
   actualiza ese documento en el mismo commit.
3. **Una decisión sobre Mercado Pago no puede tomarse mientras su fila de
   [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN`** (§61).
4. Toda decisión declara de dónde sale su fundamento, y sólo hay tres fuentes admitidas:
   **el PDR**, **una medición propia fechada**, o **una respuesta explícita del owner**.
   Ninguna otra. En particular no se admite como fundamento: el código existente,
   documentación del repo, un sistema de tracking, la memoria de un agente, ni una decisión
   de un programa anterior.
5. Si una decisión cita un `§`, **el texto se verifica contra el PDR antes de escribirla**.
   Atribuirle al PDR algo que no dice falsifica el origen de la afirmación y la vuelve
   irrastreable.

---

## Metodología

### DEC-METH-001 — Reset total: el PDR es la única herencia del programa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: una primera pasada de este programa produjo análisis, decisiones y mediciones
  que resultaron contaminados por fuentes que el PDR prohíbe explícitamente usar como
  fundamento (§0: recuerdos, comportamiento legacy, documentación obsoleta, comentarios
  viejos, implementaciones actuales, suposiciones sobre Mercado Pago). Entre otras cosas se
  le atribuyó al PDR una afirmación que el PDR no hace. Una decisión tomada sobre un análisis
  contaminado no se puede auditar hacia atrás: no se sabe cuál de sus premisas sigue en pie.
- **Alternativas**: (1) conservar las decisiones y reescribir sólo el análisis; (2) conservar
  además los hechos medidos; (3) reset total — sobrevive únicamente el PDR.
- **Decisión**: **(3)**. El único documento que se conserva es `00-PDR.md`, verbatim y con su
  integridad verificada contra el historial de git. Todo lo demás se rehace desde cero.
- **Motivo**: cero herencia. Ni siquiera un resultado medido por una sesión contaminada, para
  que no quede ninguna afirmación cuyo origen haya que reconstruir de memoria.
- **Implicaciones**:
  1. Las decisiones funcionales **se vuelven a preguntar** desde un FASE 1A nuevo.
  2. La experimentación contra Mercado Pago **se vuelve a ejecutar** en FASE 1C. Ningún
     resultado anterior se da por válido, ni siquiera para orientar.
  3. Cualquier conteo de producción **se vuelve a medir** en el momento de usarlo.
  4. **No se mira código hasta que el diseño esté cerrado.** Eso incluye esquema,
     migraciones, tests, jobs y superficies. El PDR ya lo ordena en §67 para FASE 1A; acá se
     extiende explícitamente: no se lee código para fundamentar ninguna decisión funcional.
  5. Ningún documento de este programa referencia trabajo anterior. Un enlace a algo previo
     es un defecto, no una fuente.
- **Origen**: instrucción del owner, 2026-09-15.

### DEC-METH-002 — Se autorizan conteos read-only de producción durante FASE 1A

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §67 ordena no empezar FASE 1B hasta que el owner responda 1A, pero varias
  decisiones de 1A dependen de cuántos clientes reales hay. En particular, el §56 apoya su
  preferencia por la coordinación manual en un *"hay pocos customers actuales"* que **el PDR
  no cuantifica** (`O-MIG-01`).
- **Alternativas**: (1) conteos read-only con fecha y método; (2) sólo el conteo mínimo para
  la migración; (3) ninguna medición, se decide sobre supuesto declarado.
- **Decisión**: **(1)**. Se permiten conteos read-only. El alcance es estricto: **contar
  filas**.
- **Motivo**: §4 lista explícitamente *"ejecutar queries"* e *"inspeccionar DB"* entre lo
  permitido. Contar filas no es leer cómo está escrito el sistema, que es lo que prohíben el
  §0 y el §67. Son restricciones de realidad, no arquitectura legacy.
- **Implicaciones**:
  1. **No habilita** leer código, esquema, migraciones, tests, jobs ni comportamiento. Eso
     sigue siendo FASE 1B y sigue prohibido por `DEC-METH-001`.
  2. Los resultados viven en [`07-facts-inventory.md`](./07-facts-inventory.md) con fecha,
     método y caducidad explícita.
  3. **Los números caducan.** Toda decisión que los cite debe re-verificarlos si pasó tiempo.
- **Origen**: `O-METH-02`.

---

## Decisiones funcionales

### DEC-ARCH-001 — Planes híbridos: se versiona lo que tiene efecto

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR nunca define si un plan es mutable o inmutable, y define encima de esa
  respuesta la derivación del Trial Plan (§10.3), el enforcement de excedentes (§28.1), los
  cambios de precio (§29) y el recálculo del límite efectivo (§37).
- **Alternativas**: (1) híbrido — se versiona precio, limits y entitlements, y lo cosmético
  muta; (2) versionado total, incluido el copy; (3) mutable con efecto inmediato.
- **Decisión**: **(1)**. El plan se parte en dos:
  - **Plan** — identidad y cosmética (nombre, descripción, orden en la pricing). **Muta
    libremente**, sin crear versión.
  - **Versión de plan** — precio, limits y entitlements. **Inmutable.**
  - Cada suscripción queda **anclada a una versión**.
- **Motivo**: el pasado no se reescribe donde importa — dinero y capacidad — y no se versiona
  ruido. Bajar un límite no deja clientes excedidos retroactivamente.
- **Implicaciones**:
  1. **Mover una suscripción a una versión nueva es un acto explícito y auditable**, nunca un
     efecto colateral de editar el plan.
  2. **Toda lectura de configuración comercial resuelve versión primero.** Ninguna lectura
     puede tomar valores del Plan.
  3. Hay que **declarar explícitamente qué campos tienen efecto y cuáles son cosméticos**. Esa
     lista es parte del diseño de FASE 2, es cerrada, y equivocarla convierte un cambio con
     efecto en una mutación silenciosa.
  4. §10.3 sigue cumpliéndose: el Trial Plan deriva de la **versión vigente** del plan más
     premium y del más básico. Cómo se comporta esa derivación cuando la versión vigente
     cambia en mitad de un trial lo define `BD-TRIAL-01`.
  5. Habilita §29: mostrar precio anterior y nuevo con fecha efectiva pasa a ser demostrable
     contra un registro, no una afirmación.
  6. `OD-ARCH-01` (retiro de un plan del catálogo) se apoya en esto, pero **no queda
     resuelto**: sigue abierto.
- **Origen**: `BD-ARCH-01` (BLOCKING).

### DEC-ARCH-002 — Rank explícito por plan; sólo participan los vendibles

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 exige derivar del *"plan comercial más premium"* y del *"más básico"*, y
  §27/§28 necesitan el mismo orden para que "upgrade" y "downgrade" signifiquen algo. Ninguno
  de los dos términos está definido, y por precio no se puede: el precio vive en el
  BillingOption (§18), así que un plan tiene cuatro, y dos planes pueden costar lo mismo.
- **Alternativas**: (1) rank explícito, participan sólo los vendibles; (2) rank explícito,
  participan todos los activos; (3) ordenar por el precio de una billing option de referencia.
- **Decisión**: **(1)**. Cada plan declara un **`rank`** dentro de su vertical. La derivación
  del §10.3 y la comparación de tiers miran **únicamente los planes activos y ofrecibles
  hoy**.
- **Motivo**: el orden queda declarado y es independiente del precio, que §29 dice
  explícitamente que va a cambiar. Un plan retirado, interno o de prueba no puede alterar lo
  que recibe un trial sin que nadie se entere — y §10.3 alimenta el trial de cada cliente
  nuevo.
- **Implicaciones**:
  1. **Hacen falta dos flags distintos: "activo" y "vendible".** Un plan retirado sigue activo
     para quien lo tiene y deja de ser vendible para todos.
  2. **Dos planes vendibles con el mismo rank en la misma vertical es un estado inválido**:
     falla en validación, no se resuelve por desempate arbitrario.
  3. Conviene numerar con huecos, porque insertar un plan entre dos existentes obliga a
     renumerar.
  4. El `rank` y el flag de vendible viven **en la versión de plan** (`DEC-ARCH-001`), no en
     la identidad: cambiarlos tiene efecto y por lo tanto se versiona.
  5. Habilita `OD-ARCH-01` (retiro de un plan del catálogo), que **sigue abierto**: el flag de
     vendible es la mitad del mecanismo, falta la política.
- **Origen**: `BD-ARCH-02` (BLOCKING).

### DEC-TRIAL-001 — Los overrides del Trial Plan se declaran en DB, por vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 ordena heredar **exactamente** los limits del plan más básico, derivados
  automáticamente y sin copiarse a mano. §10.5 ordena **máximo una ficha** durante el trial.
  Si el plan más básico permite más de una, las dos reglas se contradicen sobre el mismo
  valor, y §64 las congela a las dos como invariantes (#5 y #6). Encima, el "1" está escrito
  como constante en el PDR, lo que choca con §9.
- **Alternativas**: (1) overrides declarados en DB por vertical; (2) el "1" es una regla dura
  aparte, fuera de la derivación; (3) gana la derivación y se retira el "1".
- **Decisión**: **(1)**. La resolución de limits del Trial Plan es **derivar y después aplicar
  overrides declarados explícitamente en DB, por vertical**. El máximo de fichas es el primero
  de esa lista.
- **Motivo**: el apartamiento del §10.3 queda escrito y auditable en vez de escondido en
  código, cumple §9, y una vertical futura puede permitir otra cantidad sin deploy. Respeta
  §10.5 y §64.6 tal como están escritos.
- **Implicaciones**:
  1. **La derivación deja de ser pura**: pasa a ser "derivar + aplicar overrides". Toda
     resolución de limits de trial ejecuta los dos pasos, siempre en ese orden, y el override
     nunca reemplaza a la derivación.
  2. **El conjunto de overrides es finito, declarado y cerrado.** Agregarle un ítem es una
     decisión registrada, no una configuración más. Si la lista crece sin control, la
     derivación del §10.3 se vuelve decorativa y vuelven a existir dos fuentes para el mismo
     valor — que es lo que esta decisión viene a evitar.
  3. Se cruza con `DEC-ARCH-001`: la derivación lee la **versión vigente** del plan más
     básico, y el override se aplica sobre ese resultado.
  4. **No resuelve `BD-TRIAL-01`**: qué pasa cuando la versión de la que se deriva cambia en
     mitad de un trial sigue abierto.
- **Origen**: `C-TRIAL-01` (BLOCKING).

### DEC-TRIAL-002 — Derivación con trinquete: en vivo, pero nunca empeora

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 pide derivación automática y da un ejemplo que **sube** un límite (*"si
  mañana Basic cambia `MAX_PHOTOS: 20 -> 25`, Trial debe pasar automáticamente a 25"*). El
  caso que duele es el que baja: si el plan más básico reduce un límite con un trial en curso
  por encima de ese valor, esa persona queda excedida sin haber hecho nada y dispara el
  enforcement del §28.1 — que además pide *"informar antes"*, y acá no hay a quién informar
  porque el cambio no fue del usuario.
- **Alternativas**: (1) trinquete — en vivo con piso; (2) en vivo literal; (3) snapshot al
  iniciar.
- **Decisión**: **(1)**. Cada resolución compara lo derivado de la **versión vigente** contra
  el **piso derivado al arrancar el trial**, y se queda con lo mejor para el usuario. Las
  mejoras llegan solas; las reducciones no alcanzan a quien ya está adentro.
- **Motivo**: cumple el ejemplo del §10.3 al pie de la letra sin dejar a nadie excedido en
  mitad del trial. Es la única de las tres que cubre las dos direcciones.
- **Implicaciones**:
  1. **Hay que guardar el piso al iniciar el trial**, y compararlo en cada resolución.
  2. El piso se guarda como **referencia a las versiones vigentes al arrancar**
     (`DEC-ARCH-001`), **no como copia de valores**: §10.3 prohíbe expresamente copiar a mano,
     y una copia además quedaría desactualizada.
  3. Un trial en curso puede quedar temporalmente mejor que el plan más básico vigente. Es el
     costo aceptado de no degradar a nadie.
  4. **El trinquete se aplica al final, sobre el resultado completo**, no en el medio. El
     orden es: derivar de la versión vigente → aplicar los overrides vigentes
     (`DEC-TRIAL-001`) → comparar contra el piso y quedarse con lo mejor.

     El **piso es el conjunto efectivo de limits al arrancar el trial**, es decir el resultado
     de esos mismos dos primeros pasos en ese momento. Aplicarlo antes de los overrides
     dejaría un agujero: bajar un override de 2 a 1 degradaría a los trials en curso, que es
     justo lo que esta decisión impide.
- **Origen**: `BD-TRIAL-01` (BLOCKING).

### DEC-SUB-001 — Subir es inmediato, bajar de tier espera, tocar el ciclo se aplica ya

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §27 (upgrade inmediato) y §28 (downgrade a fin de ciclo) definen el cambio de
  plan sobre **un** eje, y §18 crea dos — Plan (tier) y BillingOption (ciclo). De nueve
  celdas, una es un no-cambio y sólo dos tenían política. Quedaban seis sin definir, y son las
  más frecuentes comercialmente.
- **Alternativas**: (1) subir ya / bajar de tier espera / cambio de ciclo inmediato con
  compensación en días; (2) el ciclo sólo cambia en la renovación; (3) todo inmediato,
  incluido bajar de tier.
- **Decisión**: **(1)**.

  | | ciclo ↑ | ciclo = | ciclo ↓ |
  |---|---|---|---|
  | **tier ↑** | inmediato | inmediato | inmediato |
  | **tier =** | inmediato | — | inmediato |
  | **tier ↓** | inmediato | fin de ciclo | inmediato |

  En una línea: **subir de tier es inmediato; bajar de tier con el mismo ciclo espera al fin
  del período; cualquier cambio de ciclo se aplica ya.**
- **Motivo**: es lo que el cliente ya conoce de cualquier otro servicio, y no le cierra la
  puerta a quien quiere pasarse a anual hoy.
- **Implicaciones**:
  1. **La compensación se hace en días, no en pesos.** El cobro nuevo arranca corrido por lo
     ya pagado. Se evita prorratear dinero a propósito.
  2. **Depende entera de FASE 1C.** Si no se puede correr la primera fecha de cobro sobre una
     suscripción ya autorizada (`EX-8`), el mecanismo se cae. **Plan B declarado: el cambio de
     ciclo espera a la renovación** — la alternativa (2). Esta decisión **no se puede
     implementar** hasta que `EX-7` y `EX-8` dejen de decir `UNKNOWN` (§61).
  3. **Agujero declarado**: bajar de tier **y** de ciclo a la vez (anual caro → mensual
     barato) se aplica ya y se compensa en días, o sea que es una **salida anticipada de un
     compromiso anual, en especie**. Queda registrado como consecuencia conocida; si hay que
     acotarlo, es una decisión aparte y no una corrección de ésta.
  4. La comparación de tiers usa el `rank` de `DEC-ARCH-002`. El precio no participa.
  5. El cambio inmediato dispara el enforcement de excedentes del §28.1 cuando el destino es
     más chico — que sigue siendo un hueco transversal (`M-ENT-02`).
- **Origen**: `BD-SUB-01` (BLOCKING).

### DEC-TRIAL-003 — El trial es configurable por plan; Partner lo tiene en cero

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §17 dice que Partner usa el mismo motor *"de trial; plans; billing;
  subscriptions; entitlements; limits; promo; courtesy; addons"*. §17.3 dice que Partner **no
  es self-service** y que sus dos únicos caminos de alta los maneja el admin. §6 le saca el
  listing, así que tampoco tiene el evento del §10.4 — que además exige que toda vertical sin
  ficha declare explícitamente su evento equivalente. Está escrito como que tiene trial y
  descrito como que no puede tenerlo.
- **Alternativas**: (1) la duración del trial es configuración por plan, y Partner la tiene en
  cero; (2) Partner declara estructuralmente que no admite trial; (3) sí tiene, y lo dispara
  la aprobación del admin.
- **Decisión**: **(1)**. *"Tiene trial"* deja de ser una propiedad de la vertical y pasa a ser
  un **número configurable por plan**: días de trial. **Los planes de Partner lo tienen en
  cero hoy.**
- **Motivo**: mantiene el motor genérico sin casos especiales (§7) y respeta el §17 sin
  forzarlo — Partner sí usa el motor de trial, con la duración en cero. Encenderlo mañana es
  cambiar un valor, no escribir código.
- **Implicaciones**:
  1. **La pregunta del evento de activación de Partner queda diferida, no respondida.** Si
     algún día se pone en distinto de cero, hay que declarar su evento equivalente como exige
     el §10.4. El candidato anotado es **la aprobación del admin**, con la salvedad registrada
     en la alternativa (3): el §17.3 hace que el partner valide su email y complete su perfil
     **después** de la aprobación, así que ese evento arrancaría el reloj antes de que la
     persona haya entrado por primera vez, y §10.2 no admite devolverlo.
  2. **Poner ese número en distinto de cero es una decisión registrada**, no una edición de
     configuración cualquiera. Un cero en una tabla es fácil de cambiar sin pensar.
  3. Vale para cualquier vertical futura: una que no deba tener trial se configura en cero, no
     se le agrega una excepción al motor.
  4. No frena FASE 2.
- **Origen**: `C-PARTNER-01` (BLOCKING).

### DEC-MIG-001 — Coordinación manual de las cinco relaciones vivas, cero código de migración

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: qué se le promete a quien hoy está en el sistema cuando llegue el motor nuevo.
  §56 prefiere *"coordinación manual y nueva subscription"* si migrar automáticamente agrega
  complejidad o riesgo, pero apoya esa preferencia en un *"hay pocos customers actuales"* que
  no cuantifica.
- **Contexto medido** (2026-09-15, [`07-facts-inventory.md`](./07-facts-inventory.md)): **cero
  pagos cobrados** en la historia del sistema. **Tres** relaciones con compromiso de cobro
  vivo, las tres en trial, alojamiento, mensual. **Dos** cortesías sin vínculo con el
  proveedor. Gastronomía, experiencia y partner: **cero filas**.
- **Alternativas**: (1) coordinación manual de las cinco, cero código; (2) migración
  automática; (3) congelar altas nuevas hasta el corte.
- **Decisión**: **(1)**. Se los contacta, se los da de alta en el motor nuevo y se cancela el
  compromiso viejo. **Cero código de migración.**
- **Motivo**: es lo que el §56 preveía, y la medición confirma su premisa de forma aplastante:
  no "pocos", **tres**. No hay historial de pagos que preservar.
- **Implicaciones**:
  1. **El diseño nuevo no carga con compatibilidad hacia atrás.** Ninguna decisión posterior
     puede justificarse con "para no romper lo que hay".
  2. Los tres en trial **tienen que volver a autorizar el débito**. Alguno puede no volver.
     Atenuante registrado: nunca se les cobró nada, así que no pierden dinero.
  3. **Gastronomía, experiencia y partner se rediseñan sin migración alguna**: no tienen un
     solo dato. Su deuda es de código, no de datos.
  4. **El primer trial vence el 2026-09-26**, mucho antes que FASE 2. Esa fecha la atiende lo
     que exista ese día, con independencia de esta decisión.
  5. `R-MIG-01` (cómo se convive durante el rewrite) **sigue abierto**: esta decisión define el
     destino, no la transición.
- **Origen**: `BD-MIG-01` (BLOCKING).

### DEC-TRIAL-004 — Identidad: el email normalizado bloquea; el resto observa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.2 dice que el trial no se reinicia por *"volver a registrarse sobre la
  misma identidad si podemos detectarlo"*, sin definir la señal. Cada candidata tiene un falso
  positivo distinto, y la asimetría es fuerte: un falso negativo regala un trial; un falso
  positivo **le niega el trial a un cliente legítimo, que se va sin hablar con nadie**.
- **Contexto medido** (2026-09-15): 22 usuarios en producción. El abuso es teórico a esta
  escala.
- **Contexto derivado del PDR** — no es algo que el PDR diga, es una consecuencia de lo que
  dice: como el trial arranca al publicar (§10.4) y la suscripción viene después (§10.6), **en
  el momento de decidir todavía no hay medio de pago capturado**. El pagador no está
  disponible como señal aunque se lo quisiera usar.
- **Alternativas**: (1) sólo el email normalizado bloquea, el resto observa; (2) email más
  teléfono verificado bloquean; (3) nada bloquea, todo se registra y decide el admin.
- **Decisión**: **(1)**. **Sólo el email normalizado** — puntos y `+alias` — niega el trial
  automáticamente. Teléfono, identificador fiscal y dispositivo **se registran y alertan al
  admin, pero nunca bloquean**.
- **Motivo**: es la única señal sin falso positivo relevante. Registrar sin bloquear permite
  **medir** el abuso antes de endurecer, y decidir con evidencia en vez de con hipótesis.
- **Implicaciones**:
  1. **Se esquiva con una segunda dirección de correo.** El "trial de por vida" del §10.2
     queda como intención, no como garantía. Es una limitación aceptada a conciencia.
  2. Guardar señales de identidad **con fin de bloqueo** tiene implicancias de datos
     personales aunque no se bloquee con ellas: hay que declarar finalidad y plazo de
     conservación. `M-LEGAL-02` **sigue abierto** y es prerequisito para implementar la parte
     de observación.
  3. Las alertas sólo valen si alguien las mira. Conviene que el admin muestre el patrón
     agregado, no un aviso por caso.
  4. **Conviene revisar esta decisión cuando la base crezca.** Hoy se optimiza contra perder
     clientes reales porque hay 22; el cálculo cambia con dos órdenes de magnitud más.
- **Origen**: `BD-TRIAL-02` (BLOCKING).

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | **10** |
| De metodología | 2 — `DEC-METH-001`, `DEC-METH-002` |
| Funcionales | 8 |
| `SUPERSEDED` | 0 |
| Bloqueantes de FASE 2 que decide el owner | **8 de 8 cerradas** |
| Bloqueantes de FASE 2 que decide el experimento | **4 abiertas** — esperan FASE 1C |
| Decisiones que no se pueden implementar todavía | 1 — `DEC-SUB-001`, depende de `EX-7`/`EX-8` |
