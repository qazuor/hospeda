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

### DEC-METH-003 — El criterio de FASE 5 se define al empezar FASE 5, y es su gate de entrada

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §2 dice que *"La carga de prueba debe estar del lado de conservar código
  legacy. No del lado de justificar reescribirlo"*, y la FASE 5 define `KEEP` como *"sólo si
  estamos prácticamente 100% seguros"* de cinco cosas. Esa frase sólo tiene efecto si existe
  algo concreto que rendir: sin criterio operable, la carga se invierte sola, porque conservar
  nunca requiere defensa activa y reescribir siempre sí. Y con el programa atravesando varias
  ventanas de contexto (§3.3), dos piezas equivalentes se clasifican al revés en sesiones
  distintas y nadie lo nota.
- **Alternativas**: (1) se define al empezar FASE 5, como gate de entrada; (2) se define
  ahora, vinculante; (3) sin criterio fijo, caso por caso argumentado.
- **Decisión**: **(1)**. El criterio se define **al empezar FASE 5**, con el inventario real de
  FASE 1B terminado a la vista.
- **Motivo**: con las piezas concretas enfrente se puede juzgar si un criterio ayuda o estorba,
  en vez de diseñarlo a ciegas.
- **Implicaciones — esto es un gate, no un pendiente**:
  1. **No se clasifica ninguna pieza antes de haber tomado esa decisión.** Empezar a clasificar
     "mientras tanto" equivale a elegir la alternativa (3) sin decirlo.
  2. La decisión se toma **con el inventario de 1B terminado**, no con una muestra.
  3. **Si el criterio que se elija excluye o trata distinto al Eje 2, tiene que decirlo
     explícitamente.** Es la trampa conocida: cualquier regla del tipo *"no nombra ninguna
     vertical en su lógica"* manda **todo el Eje 2 a `REWRITE` por definición**, porque §8
     define el Eje 2 como comportamiento específico de vertical.
  4. **Sea cual sea el resultado, toda clasificación lleva su argumento escrito.** Eso no está
     en discusión y vale también si se elige no tener criterio. Es lo que le da efecto al §2
     aunque el criterio final sea flexible.
  5. El gate tiene que sobrevivir a varias ventanas de contexto entre hoy y FASE 5: vive en el
     handoff y en `04-open-decisions.md`, no en la memoria de nadie.
- **Origen**: `O-METH-03`.

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

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED por `DEC-SUB-005`** · **Decide**: owner
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
- **Reemplazada**: el mismo día, cuando FASE 1C midió que el ciclo de una suscripción
  autorizada **no se puede mutar** (`EX-4`, `NOT_SUPPORTED`). **La política de la matriz no
  cambió**; lo que se cayó fue el mecanismo. Ver `DEC-SUB-005`.

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

### DEC-TRIAL-005 — La publicación es inmediata: publicar es quedar visible

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.4 fija el disparador del trial en *"PUBLICAR la primera ficha"* y cierra
  con *"La publicación **efectiva** dispara el consumo del trial"*. Si publicar y quedar
  visible son el mismo instante no hay nada que decidir; si media algo entre la acción de la
  persona y la visibilidad pública son dos eventos, y hay que elegir cuál consume el trial —
  que es único de por vida y no se devuelve (§10.2).
- **Alternativas**: (1) hay revisión y el trial arranca al quedar visible; (2) publicación
  inmediata; (3) hay revisión y el trial arranca al enviar.
- **Decisión**: **(2)**. **No hay paso intermedio.** La persona publica, la ficha se ve y el
  trial arranca: un solo evento.
- **Motivo**: cero fricción, cero espera y ningún proceso operativo que sostener. El §10.4 se
  cumple literalmente, porque "publicar" es un acto único.
- **Implicaciones**:
  1. **`E-TRIAL-01` queda disuelto**: no existe el rechazo posterior a la publicación, porque
     no hay revisión previa.
  2. **Nada filtra el contenido antes de que sea público.** Una ficha mal cargada, spam o
     contenido inapropiado sale al sitio y se corrige después.
  3. **Consecuencia nueva, registrada como `E-TRIAL-04`**: toda moderación pasa a ser
     reactiva, y bajar una ficha ya publicada **no devuelve el trial** (§10.2). Alguien puede
     quedarse sin ficha **y** sin trial. Si eso amerita una excepción al §10.2 es una decisión
     aparte y **sigue abierta**.
  4. El evento de dominio del trial para las verticales con ficha es la publicación, sin
     ambigüedad.
- **Origen**: `A-TRIAL-01`.

### DEC-TRIAL-006 — El disparador del trial se declara por vertical; Turista usa "Empezar"

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.4 cierra diciendo que *"Partner y cualquier vertical futura sin Listing
  deberán definir su evento funcional equivalente explícitamente"*. **Turista no es ninguna de
  las dos**: es una vertical actual (§6) y sin ficha (§6: *"Turista NO tiene ficha/listing
  comercial"*). La frase no la cubre, y §64.1 habla de trial *"por user + vertical"* sin
  excluir a ninguna.
- **Alternativas**: (1) Turista sin trial, configurado en cero como Partner; (2) sí tiene, y
  lo dispara el botón `Empezar` del §47; (3) sí tiene, y arranca al usar una capacidad VIP.
- **Decisión**: **(2)**. Y con eso queda establecida la forma general: **cada vertical declara
  su evento de activación en configuración**, de un catálogo cerrado de eventos de dominio.

  | vertical | evento de activación |
  |---|---|
  | alojamiento · gastronomía · experiencia | la ficha queda publicada (`DEC-TRIAL-005`) |
  | turista | el botón `Empezar` del §47 |
  | partner | ninguno declarado — trial en cero hoy (`DEC-TRIAL-003`) |

- **Motivo**: el evento no se inventa, ya está escrito en el §47, y es el único que el PDR le
  da a Turista. Un click consciente evita el reclamo de *"me lo gastaron sin avisar"*, que es
  grave porque el trial es irreversible.
- **Implicaciones**:
  1. **Cero condiciones especiales en el motor** (§7): una vertical sin evento declarado
     simplemente no otorga trial, y falla cerrado en vez de abierto.
  2. **El click de `Empezar` debe decir explícitamente que consume el trial.** Es un botón de
     baja fricción en una página de precios y el trial es de por vida: sin ese aviso, el
     reclamo es legítimo.
  3. Turista entra en la campaña de recuperación del §10.7 como cualquier otra vertical, lo
     que suma una secuencia más al problema de superposición (`M-TRIAL-03`, sigue abierto).
  4. Si algún día Partner enciende su trial, tiene que sumar su evento a esta misma tabla.
- **Origen**: `M-TRIAL-01`.

### DEC-TRIAL-007 — Pre-trial: borradores ilimitados, sin capacidades, archivado por inactividad

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.4 enumera qué **no** dispara el trial — registrarse, crear draft, entrar
  al onboarding, guardar un formulario parcial — con lo cual reconoce explícitamente un estado
  *"entró a la vertical y todavía no publicó"*, y después no le da ninguna regla. Es donde va
  a estar la mayor parte de la gente.
- **Alternativas**: (1) borradores ilimitados, sin capacidades, archivado por inactividad;
  (2) un solo borrador hasta publicar; (3) ilimitados y sin vencimiento.
- **Decisión**: **(1)**. Borradores **ilimitados**, **sin ninguna capacidad comercial**, **sin
  consumir trial**. Tras **N meses sin actividad se archivan automáticamente**.
- **Motivo**: cero fricción justo donde más conviene evitarla — antes de que la persona haya
  visto valor — y el trial arranca cuando hay valor real, que es lo que el §10.4 busca al
  excluir el registro y el draft.
- **Implicaciones**:
  1. **`N` es configuración**, no una constante (§9).
  2. **Archivar no es borrar.** Qué significa exactamente y cómo se relaciona con la retención
     del §25 lo define `C-DATA-01`, que **sigue abierta**. Esta decisión depende de esa.
  3. Se puede sostener contenido indefinidamente sin consumir nada, pero **sin obtener nada a
     cambio**: no se publica y no hay capacidades. El costo es de almacenamiento, no de
     entitlements regalados.
  4. El estado pre-trial es un estado real del modelo y entra en el glosario que pide
     `M-ARCH-01`.
- **Origen**: `M-TRIAL-02`.

### DEC-ENT-001 — Existen entitlements medidos, y el trial tiene cuota propia en ellos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 ordena que el Trial Plan otorgue *"exactamente los entitlements del plan
  comercial más premium"*. Si alguno tiene costo marginal real por uso — el chat con IA del
  §36.2 es el candidato obvio — el trial lo regala sin tope, por vertical, y con cinco
  verticales (§6) una misma persona puede consumir cinco veces. El PDR no distingue
  entitlements booleanos de medidos ni le da cuota propia al trial.
- **Alternativas**: (1) todas las funciones, con cuota propia de trial en las medidas;
  (2) todo ilimitado, como dice la letra del §10.3; (3) las funciones caras no entran en el
  trial.
- **Decisión**: **(1)**. El trial muestra **todas** las funciones de Premium. Los entitlements
  **medidos** declaran **dos cuotas**: la del plan y la del trial, menor.
- **Motivo**: demuestra el producto completo, que es el punto del trial, y acota el costo. Se
  cumple el espíritu del §10.3 sin su consecuencia económica literal.
- **Implicaciones**:
  1. **Apartamiento declarado del §10.3**, que dice *"exactamente"*. El PDR no se edita
     (§3.1): queda registrado acá.
  2. **`OD-ENT-01` queda respondido en su mitad**: **sí existen entitlements medidos**, no son
     todos booleanos. Eso obliga a construir un subsistema de consumo que el PDR no menciona
     en ningún lado — contador, ventana, momento de reset y qué pasa con lo no usado.
  3. **Queda abierto cómo se resetea la cuota**, y tiene una trampa concreta: si se reseteara
     "por período de facturación", un plan anual entregaría doce meses de cuota el primer día.
     Se decide aparte.
  4. Cada entitlement medido lleva su cuota **en la versión de plan** (`DEC-ARCH-001`), porque
     cambiarla tiene efecto.
  5. La cuota de trial no participa del trinquete de `DEC-TRIAL-002` como si fuera un limit
     derivado: es un valor propio del trial, no una derivación de Premium.
- **Origen**: `R-TRIAL-01`, `OD-ENT-01`.

### DEC-ENT-002 — Las cuotas de consumo son mensuales, independientes del ciclo de pago

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ENT-001` estableció que existen entitlements medidos, pero el PDR no
  menciona cuotas en ningún lado y por lo tanto no dice cuándo se resetean. Si el reset
  acompañara al período de facturación, **un plan anual entregaría doce meses de cuota el
  primer día**.
- **Alternativas**: (1) mensual siempre, lo no usado se pierde; (2) mensual con acumulación
  del sobrante; (3) por período de facturación.
- **Decisión**: **(1)**. La cuota se resetea **todos los meses**, sea cual sea el ciclo de
  pago. **Lo no usado se pierde**, no se acumula.
- **Motivo**: desactiva la trampa del plan anual y mantiene el costo por uso parejo en el
  tiempo, que es como se comporta el gasto real. Sin acumulación no hay saldo que administrar,
  mostrar ni discutir al cancelar.
- **Implicaciones**:
  1. **Dos relojes distintos conviven**: el del ciclo de facturación y el de la cuota. No hay
     que confundirlos en ningún cálculo.
  2. **Falta definir si el mes corre por calendario o por aniversario de la suscripción.** Es
     un detalle de FASE 2 y no cambia el fondo de esta decisión.
  3. **Consecuencia aceptada**: quien pagó un año por adelantado y no usó su cuota la pierde
     igual, y el uso concentrado choca contra el tope mensual. Conviene que la UI muestre la
     cuota restante del mes para que no sea una sorpresa.
  4. Se cruza con `M-MAIL-01`: el momento exacto del reset es una ventana temporal y tiene que
     computarse en el huso del mercado, no en UTC.
- **Origen**: `OD-ENT-01` (segunda mitad).

### DEC-ENT-003 — La herencia de Turista VIP cubre entitlements y limits, y bloquea la compra

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §16 dice que un plan comercial *"puede configurar desde DB si hereda beneficios
  de Turista VIP"*, sin precisar qué son "beneficios" — el PDR trata entitlements (§36) y
  limits (§37) como cosas distintas en todos lados — ni qué pasa si además paga VIP por su
  cuenta.
- **Alternativas**: (1) hereda entitlements y limits, y no puede comprar VIP; (2) hereda sólo
  entitlements; (3) hereda todo y puede comprar VIP igual.
- **Decisión**: **(1)**. Hereda **entitlements y limits**. Mientras su plan comercial se lo dé,
  **no puede comprar Turista VIP**: la UI no lo ofrece y la API lo rechaza. Al perder el plan
  comercial, recupera la posibilidad de comprarlo.
- **Motivo**: nunca cobrarle dos veces lo mismo. El problema se evita en vez de resolverse
  después.
- **Implicaciones**:
  1. **No resuelve al que ya lo paga** en el momento de contratar el plan comercial. Ese caso
     se decide aparte.
  2. Cuando los limits de turista y los de la vertical se superponen hay que declarar cuál
     gana. Lo resuelve la estrategia de agregación de `M-ENT-01`, que **sigue abierta**.
  3. **Consecuencia nueva, registrada como `E-ENT-01`**: si su plan comercial cae en
     `SUSPENDED` (§21), pierde beneficios que usaba **como turista**, en una parte del producto
     ajena a su impago — y por esta misma decisión tampoco pudo haberlos comprado. **Sigue
     abierta.**
- **Origen**: `A-ENT-01`.

### DEC-ENT-004 — Un VIP previo se cancela de inmediato, sin reembolso

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ENT-003` impide comprar Turista VIP mientras un plan comercial lo regale,
  pero no dice qué pasa con quien **ya lo está pagando** en el momento de contratar ese plan.
- **Contexto medido** (2026-09-15): hoy **no existe ningún caso**. La única suscripción de
  turista en producción está `abandoned` y nunca se cobró nada. Se decide en frío.
- **Alternativas**: (1) no se renueva, conservando el período pagado; (2) se cancela ya, con
  reembolso proporcional; (3) se cancela ya, sin reembolso.
- **Decisión**: **(3)**. Se corta el VIP en el acto y **no se devuelve lo ya pagado**. El
  beneficio lo sigue teniendo gratis por el plan nuevo.
- **Motivo**: decisión del owner. Es la más simple de implementar, el servicio no se
  interrumpe, y no depende de ninguna fila de la matriz.
- **Implicaciones y riesgo declarado**:
  1. **Retener dinero de un servicio que cancelamos nosotros, unilateralmente, es discutible
     bajo la ley de defensa del consumidor.** Queda asumido explícitamente.
  2. **Hoy el riesgo es bajo porque todas las suscripciones vivas son mensuales** (medido): se
     retendría un mes parcial como máximo. **El día que exista un ciclo anual de Turista VIP,
     el monto retenido puede ser de hasta once meses y esta decisión debe revisarse.** Queda
     anotada con su disparador de revisión.
  3. Si después cancela el plan comercial, **se queda sin VIP y sin la suscripción que tenía**:
     hay que pedirle que autorice una nueva.
  4. **Conviene —no forma parte de la decisión— avisarle por correo antes de cancelar.** Al
     cancelar contra el proveedor, es posible que éste le escriba por su cuenta un *"tu
     suscripción fue cancelada"* sin contexto; eso es `M-MAIL-04`, y su fila `EX-3` está en
     `UNKNOWN`. Llegar antes es lo único que se puede controlar.
- **Origen**: `A-ENT-01` (b).

### DEC-SUB-002 — Grace configurable en DB por plan, default 10 días

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: cuatro afirmaciones del PDR que no pueden ser ciertas a la vez. §20 fija
  *"Duración: **10 días**"*; §30 lo repite para pagos manuales; §42.3 habla de *"Schedule
  configurable durante 10 días"*, o sea schedule variable dentro de ventana fija; y §9 dice
  que toda regla comercial sale de DB.
- **Alternativas**: (1) configurable en DB por plan, default 10; (2) configurable por
  vertical; (3) constante del dominio, con §9 excepcionado.
- **Decisión**: **(1)**. Los días de grace son un campo **de la versión de plan**, con **10 de
  default**.
- **Motivo**: cumple §9 sin perder el número que el PDR eligió, y deja una palanca comercial
  real — un plan caro puede tener más aire.
- **Implicaciones**:
  1. Al vivir en la **versión** de plan (`DEC-ARCH-001`), cambiarlo queda versionado: **nadie
     ve su grace acortado retroactivamente**.
  2. **El schedule de correos del §42.3 tiene que ser relativo al vencimiento, no absoluto.**
     Si la ventana es variable, un schedule con días fijos se cae fuera de la ventana en los
     planes con grace más corto.
  3. Dos planes de la misma vertical pueden tener grace distinto. Tiene que poder explicarse
     en soporte y mostrarse en la UI del cliente, no sólo aplicarse.
  4. Vale igual para pagos manuales (§30): el mecanismo es el mismo, cambia el método de pago.
- **Origen**: `C-SUB-01`.

### DEC-SUB-003 — Cambiar de plan en grace está permitido, y es el camino de recuperación

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §26 sólo permite pausar desde `ACTIVE`, pero el PDR no dice nada sobre cambiar
  de plan en `GRACE_PERIOD`. Si se prohíbe, el control impide el propio remedio — bajarse a un
  plan más barato es cómo alguien sale de un impago. Si se permite, hay dos abusos simétricos:
  cambiar de plan para generar un cobro nuevo que "limpie" el fallido, o para esquivar la
  deuda del ciclo anterior.
- **Alternativas**: (1) se permite, con cobro inmediato del plan nuevo; (2) hay que estar al
  día; (3) sólo se permite bajar de tier.
- **Decisión**: **(1)**. Se permite. **Se intenta el cobro del plan nuevo de inmediato**: si
  entra, vuelve a `ACTIVE` con el plan nuevo; si falla, **sigue en grace con el plan anterior
  y no cambia nada**.
- **Motivo**: convierte el cambio de plan en una salida del problema en vez de un muro, y
  cierra los dos abusos a la vez — no se puede limpiar el fallido porque el cobro nuevo tiene
  que entrar de verdad, y no se puede esquivar la deuda porque si falla se queda con el plan
  viejo y su deuda.
- **Implicaciones**:
  1. **La transacción debe ser atómica.** No puede quedar con el plan nuevo y el pago fallido.
     Es el punto exacto donde esto se rompe si se implementa mal, y entra en los cruces de
     concurrencia de `E-CONC-01`.
  2. **Se cruza con `DEC-SUB-001`**: si además cambia el ciclo, habría que compensar días
     sobre una suscripción que está en deuda. **Qué pasa con el período impago al compensar
     queda abierto** y se registra como `E-SUB-05`.
  3. El intento de cobro inmediato depende del comportamiento del proveedor, que está en
     `UNKNOWN` (`GR-1`, recuperación durante el grace).
- **Origen**: `E-SUB-03`.

### DEC-SUB-004 — La ventana de límites de pausa se cuenta por user + vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §26.3 define tres límites con precisión — 3 pausas por ventana móvil de 12
  meses, 120 días por pausa, 240 días acumulados — y **no dice sobre qué entidad se cuentan**.
  Si fuera por suscripción, cancelar y volver a suscribirse resetearía los tres.
- **Alternativas**: (1) por `user + vertical`; (2) por suscripción; (3) por suscripción con
  arrastre del historial al re-suscribirse.
- **Decisión**: **(1)**. El contador vive en la relación **persona + vertical** y **sobrevive
  a cancelar y volver a suscribirse**.
- **Motivo**: es el único que hace que el límite limite. Con tres números tan específicos el
  §26.3 claramente quiso poner un techo; contarlo por suscripción lo volvería decorativo.
- **Implicaciones**:
  1. Es **el mismo eje que ya usa el resto del modelo**: el trial es por `user + vertical`
     (§10.1) y la suscripción principal también (§11). No se introduce un eje nuevo.
  2. El contador vive **fuera** de la fila de suscripción: hay una entidad más que mantener.
  3. **Queda abierto qué pasa con el historial si la persona borra la cuenta y vuelve.** Se
     cruza con `DEC-TRIAL-004`, que ya eligió el email normalizado como señal de identidad
     para un problema de la misma forma. Conviene que usen la misma señal.
  4. Se descartó la variante con arrastre explícito porque es un **fail-open**: si un camino
     de creación de suscripción se olvida de copiar el historial, el contador se resetea en
     silencio.
- **Origen**: `OD-SUB-01`.

### DEC-ADDON-001 — El addon se pierde con la ficha, y su reloj no se congela

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §40 define el scope `LISTING` y §41 ordena cancelar *"solo cuando queda
  efectivamente huérfano"*. Dos casos quedan sin cubrir: la ficha **se borra** (el addon
  apunta a algo que ya no existe) y la ficha queda **despublicada por suspensión** (§21) — ahí
  el addon **no está huérfano**, la ficha existe, y sin embargo no sirve para nada mientras el
  reloj sigue corriendo.
- **Alternativas**: (1) se pierde con la ficha y el reloj no se congela; (2) el reloj se
  congela mientras la ficha no se vea; (3) el addon se libera y se puede reasignar.
- **Decisión**: **(1)**. Borrar la ficha **consume** el addon: no se libera ni se reasigna. Y
  el addon **vence cuando vence**, esté la ficha publicada o no.
- **Motivo**: la regla más simple posible — una fecha de fin y nada más que calcular, sin
  estados intermedios. No abre la puerta a usar el borrado o la despublicación para estirar un
  addon comprado.
- **Implicaciones**:
  1. **Mitigación obligatoria**: la confirmación de borrado de una ficha **debe advertir qué
     addons se pierden y por cuánto**. Sin eso el reclamo entra por soporte y es justo.
  2. Un cliente suspendido dos meses **pierde dos meses de algo que pagó**. Conviene que el
     aviso de suspensión lo diga explícitamente.
  3. Coherente con cómo el §10.2 trata el trial: borrar no devuelve nada.
  4. No resuelve *"quiero mover el destaque a otra ficha"*, que el PDR tampoco cubre y que
     queda fuera de alcance por ahora.
- **Origen**: `E-ADDON-01`, `E-ADDON-02`.

### DEC-PROMO-001 — Cupo total de canjes más ventana de validez

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §31 define *"Cada user: máximo un uso de cada código"* y nada más. Sin cupo
  total ni ventana de validez, un código filtrado es una pérdida abierta: el límite por persona
  no limita nada cuando hay usuarios ilimitados y crear una cuenta es gratis.
- **Alternativas**: (1) cupo total más ventana de validez; (2) sólo cupo total; (3) sólo el
  límite por persona del §31.
- **Decisión**: **(1)**. Cada código declara **cuántos canjes admite en total** y **entre qué
  fechas es válido**, además del límite por persona.
- **Motivo**: dos defensas independientes. Si el código se filtra lo corta el cupo; si alguien
  se olvida de desactivarlo, lo apaga la fecha. Que fallen las dos a la vez es mucho menos
  probable que fallar una.
- **Implicaciones**:
  1. **El cupo acota la pérdida máxima a un número conocido de antemano**, así que una campaña
     se puede presupuestar.
  2. **Hay que definir qué ve quien llega tarde** cuando el cupo se agota: un error claro que
     diga que el código ya no está disponible, no un silencio que se lea como "el código no
     existe".
  3. Los dos campos necesitan default, porque el modo de falla más común es el olvido. Un
     default generoso deja el agujero abierto igual.
  4. No resuelve el corte por presupuesto consumido (cortar cuando el descuento acumulado
     supera un monto), que es un tercer mecanismo y queda fuera de alcance.
  5. Se cruza con `A-PROMO-01` (orden de aplicación y piso del apilado), que **sigue abierta**.
- **Origen**: `M-PROMO-01`.

### DEC-PROMO-002 — El scope "todas las verticales futuras" se permite sin restricción

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el scope aparece en §31, §34 y §35.1, y significa que una concesión creada hoy
  otorga acceso automático a una vertical **que todavía no existe**, cuyo costo no se conoce y
  cuyo modelo de negocio puede ser completamente distinto. Una vertical nueva **nace regalada**
  a esa lista.
- **Alternativas**: (1) se permite tal cual; (2) se permite con vencimiento obligatorio;
  (3) una vertical nueva entra sólo si se la incluye explícitamente.
- **Decisión**: **(1)**. Se permite tal cual lo escribe el PDR, **sin tope y sin vencimiento
  obligatorio**.
- **Motivo**: decisión del owner. Es una herramienta comercial real para un acuerdo
  fundacional, y esos acuerdos son efectivamente "para siempre y para todo".
- **Implicaciones**:
  1. **Una vertical nueva nace regalada a esa lista**, con un costo que no se conocía cuando se
     otorgó la concesión.
  2. **Mitigación sugerida — no forma parte de la decisión**: que el acto de **crear una
     vertical liste explícitamente qué concesiones la alcanzan automáticamente**, para que sea
     una decisión consciente y no un descubrimiento posterior.
  3. Si la vertical futura tiene entitlements medidos (`DEC-ENT-001`), el regalo es de dinero
     por uso y no sólo de acceso. Conviene que esa lista incluya el costo estimado.
  4. Se descartó el vencimiento obligatorio porque contradice el §35, que modela Free Forever
     como permanente.
- **Origen**: `OD-PROMO-01`.

### DEC-GRANT-001 — Free Forever corta el cobro de inmediato, sin reembolso; revocar no restaura

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §35.3 ordena *"Cancelar toda obligación de pago cubierta"*, incluidos
  MercadoPago y manual, pero no dice qué pasa con el período **ya cobrado** ni qué pasa si el
  grant se **revoca** después.
- **Contexto medido** (2026-09-15): hay 2 cortesías en producción, ninguna con vínculo al
  proveedor de pagos, y cero pagos cobrados en la historia del sistema.
- **Alternativas**: (1) se corta ya, sin reembolso, y revocar no restaura; (2) no se renueva,
  conservando el período pagado; (3) se corta ya, con reembolso proporcional.
- **Decisión**: **(1)**. Se corta el cobro **en el acto** y **no se devuelve lo pagado**. Si el
  grant se **revoca**, **no se reanuda el débito viejo**: hay que pedirle al cliente que
  autorice uno nuevo.
- **Motivo**: consistente con `DEC-ENT-004`, que resolvió el mismo dilema de la misma forma.
  Cumple el §35.3 literalmente y no depende de poder reembolsar, que sigue en `UNKNOWN`.
- **Implicaciones y riesgo declarado**:
  1. **Mismo riesgo que `DEC-ENT-004`**: retener dinero de un servicio cancelado por nosotros
     es discutible bajo la ley de defensa del consumidor. Acá **además el cliente no pidió
     nada**: le otorgamos un beneficio y en el mismo acto le retuvimos un período.
  2. **Revocar es una acción destructiva.** Deja al cliente **sin grant y sin suscripción**,
     o sea **sin servicio**, hasta que autorice un débito nuevo. **La UI del admin debe
     decirlo explícitamente al revocar**, o alguien lo va a hacer sin entender que está
     cortando el servicio de alguien.
  3. Si el proveedor no permite reanudar una autorización cancelada (`PA-5`, `UNKNOWN`), esto
     es **irreversible por construcción**, no por política.
  4. **Conviene avisar por correo antes**, tanto al otorgar como al revocar: al cancelar contra
     el proveedor es posible que éste le escriba por su cuenta (`M-MAIL-04`, fila `EX-3` en
     `UNKNOWN`). El §35.4 exige auditar el grant, pero **auditar no es avisar**.
  5. Hereda el disparador de revisión de `DEC-ENT-004`: el día que exista un ciclo anual, el
     monto retenido puede ser de once meses.
- **Origen**: `M-GRANT-01`.

### DEC-GRANT-002 — La cortesía temporal también es exclusiva de SUPER_ADMIN

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR es asimétrico y no dice si a propósito. §35, para Free Forever: *"Solo:
  `SUPER_ADMIN`"*. §34, para la cortesía temporal: apenas *"Admin puede otorgar"*. Las dos
  regalan servicio, y es una autorización con dinero atrás.
- **Alternativas**: (1) cualquier admin, con tope de días y auditoría; (2) sólo `SUPER_ADMIN`,
  igual que Free Forever; (3) cualquier admin, sin tope.
- **Decisión**: **(2)**. **Toda concesión gratuita, temporal o permanente, la firma
  `SUPER_ADMIN`.**
- **Motivo**: decisión del owner. Una sola regla para todo lo que regala servicio: imposible
  confundirse y sin configuración que mantener.
- **Implicaciones**:
  1. **Apartamiento declarado del §34**, que dice *"Admin puede otorgar"*. El PDR no se edita
     (§3.1): queda registrado acá.
  2. **Cierra un agujero real**: una cortesía "temporal" sin tope de días es un Free Forever
     con otro nombre. Si la pudiera otorgar un admin común, la exclusividad del §35 existiría
     en un camino y se podría esquivar por el otro.
  3. **Costo operativo declarado**: compensar a alguien unos días por un problema de servicio
     pasa a requerir al `SUPER_ADMIN`. **El riesgo concreto es que se termine compartiendo la
     cuenta**, que es peor que el riesgo que se evita. Conviene vigilarlo y, si aparece,
     resolverlo con un permiso acotado y no con una cuenta compartida.
  4. El catálogo de acciones administrativas de `M-ADMIN-01` tiene que reflejar que estas dos
     acciones comparten el mismo permiso.
  5. §35.4 ya exige auditar el grant; la cortesía temporal debe auditarse igual.
- **Origen**: `A-GRANT-01`.

### DEC-DATA-001 — Retención: oculto del público, visible para el dueño, con dos avisos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §21 promete que al suspender los *"datos conservados"* y la *"recuperación
  posible"*. §25 hace **soft delete a los 90 días** y **hard delete a los 180**. Y entre el
  `+60` en que la campaña del §10.7 ordena dejar de contactar y el día 90 hay **silencio
  total**: alguien que vuelve el día 200 encuentra su contenido borrado sin haber recibido
  nunca una advertencia.
- **Alternativas**: (1) oculto del público, visible para el dueño, con dos avisos; (2) oculto
  para todos, con dos avisos; (3) se conserva todo, sin hard delete.
- **Decisión**: **(1)**.
  - **Día 90**: la ficha **sale del sitio público**, pero **el dueño la sigue viendo** y puede
    **exportarla** o **reactivarla** suscribiéndose.
  - **Día 180**: hard delete de lo eliminable.
  - **Dos avisos**: uno antes del día 90 y otro antes del día 180.
- **Motivo**: es lo único que cumple la promesa del §21 sin incumplir el §25. Nadie pierde su
  contenido sin advertencia previa, y poder exportarlo antes es lo que hace defendible el hard
  delete.
- **Implicaciones**:
  1. **Los dos avisos son correos transaccionales no suprimibles.** No pueden caer bajo el
     opt-out comercial, o se deja de avisar justo a quien más lo necesita. Depende de
     `M-MAIL-03` (jerarquía de supresión), que **sigue abierta**.
  2. **"Visible para el dueño" obliga a que la suspensión no apague el acceso de lectura**, lo
     que es coherente con el *"Mi Cuenta read-only"* del §21 y se cruza con `A-AUTH-01` (si el
     rol se revoca al suspender), que **sigue abierta**.
  3. **Cierra el hueco de `DEC-TRIAL-007`**: "archivar" un borrador por inactividad significa
     esto mismo — sale de circulación, el dueño lo sigue viendo, y no es borrar.
  4. **Qué es exactamente "dato operativo eliminable"** a los 180 sigue sin definirse
     (`M-DATA-01`, abierta). Si la auditoría del §49 guarda copias del contenido, el hard
     delete puede no eliminar nada.
  5. Los dos avisos tapan el silencio entre el `+60` y el día 90 que señalaba `R-DATA-01`.
- **Origen**: `C-DATA-01`.

### DEC-LEGAL-001 — Comprobante no fiscal hasta ARCA, sin fecha ni disparador de revisión

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §54 ordena que hasta integrar ARCA cada cobro genere un comprobante o recibo
  PDF y que **no** se lo llame factura fiscal; §53 difiere ARCA *"salvo decisión separada"*.
  Cobrar a consumidores finales sin comprobante fiscal tiene consecuencias impositivas, y el
  PDR lo dejaba como detalle de implementación que nadie había firmado.
- **Contexto medido** (2026-09-15): **cero pagos cobrados** en la historia del sistema. Hoy no
  hay ni un comprobante que emitir.
- **Alternativas**: (1) confirmado, con disparador al primer cobro real; (2) confirmado, sin
  fecha ni disparador; (3) se integra ARCA antes de cobrar.
- **Decisión**: **(2)**. Se avanza con comprobante no fiscal. La revisión ocurre *"cuando entre
  ARCA"*, **sin disparador agendado**.
- **Motivo**: decisión del owner. Es exactamente lo que dicen el §53 y el §54, sin agregar
  maquinaria.
- **Implicaciones y riesgo declarado**:
  1. **Lo que la objeción pedía queda cumplido**: esto es ahora una decisión firmada con su
     riesgo impositivo asumido, y no un detalle de implementación.
  2. **`"cuando entre ARCA"` no es una fecha ni un evento observable.** Queda explícito que no
     hay nada agendado ni ninguna condición que alguien vaya a verificar: la revisión depende
     de que alguien la recuerde.
  3. **El riesgo impositivo crece con cada cobro** y no hay ningún momento definido en que
     alguien se pregunte si sigue siendo tolerable. Hoy es cero porque no se cobró nunca nada.
  4. Se descartó adelantar ARCA porque metería una integración externa entera en el camino
     crítico de un programa de diez fases, y hoy no hay a quién cobrarle.
- **Origen**: `O-LEGAL-01`.

### DEC-SUB-005 — El cambio de ciclo se hace cancelando y recreando, no mutando

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED por `DEC-SUB-006`** (2026-09-16) · **Decide**:
  owner (delegado al criterio técnico, con el hecho medido a la vista)
- **Reemplaza a**: `DEC-SUB-001`.
- **Qué se cayó y qué no**: la **política no cambió** —el cambio de ciclo se sigue haciendo
  cancelando y recreando— pero el **mecanismo de re-autorización sí**: esta decisión daba por
  hecho tokenizar la tarjeta guardada del lado del servidor y pedirle el código de seguridad al
  cliente. `DEC-SUB-006` lo reemplaza por el checkout del proveedor, y además fija la
  compensación y el momento exacto de la cancelación, que acá quedaban sin definir.
- **Problema**: `DEC-SUB-001` fijó que cualquier cambio de ciclo se aplica de inmediato
  compensando en días, y eso presuponía poder **mutar** el ciclo de la suscripción vigente.
  FASE 1C midió que **no se puede**: `EX-4` salió `NOT_SUPPORTED`, y además **falla en
  silencio** — dos intentos aislados devolvieron `200` con `frequency` intacta.
- **Contexto medido** (2026-09-15, sandbox,
  [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md)):
  - `EX-4` **el ciclo no se puede cambiar** sobre una suscripción autorizada.
  - `EX-8` **`VERIFIED`**: crear una suscripción autorizada con `start_date` futura respeta esa
    fecha **y no cobra al crearse**.
  - **Recrear no exige recargar la tarjeta**: se puede tokenizar la tarjeta ya guardada
    server-side con `card_id` **más el código de seguridad**. Verificado de punta a punta y por
    relectura independiente: quedó `authorized`, con el ciclo nuevo, el primer cobro corrido y
    cero cobro al crear.
  - Con `card_id` **sin** código de seguridad el token se genera (`201`) pero **no sirve**:
    `400 "Card token was generated without cvv validation"`.
- **Alternativas**: (1) cancelar y recrear con la fecha corrida; (2) el plan B declarado en
  `DEC-SUB-001` — el cambio de ciclo espera a la renovación; (3) prohibir el cambio de ciclo.
- **Decisión**: **(1)**. **La política de `DEC-SUB-001` se mantiene sin cambios** — subir de
  tier es inmediato, bajar de tier con el mismo ciclo espera al fin del período, y cualquier
  cambio de ciclo se aplica ya. **Lo único que cambia es cómo se ejecuta**: cancelando la
  suscripción vigente y creando una nueva con la primera fecha de cobro corrida por los días
  ya pagados.
- **Motivo**: entrega exactamente el efecto que la decisión original buscaba, medido, y evita
  el plan B — que degradaba la experiencia sin necesidad.
- **Implicaciones**:
  1. **El cliente tiene que ingresar su código de seguridad** para cambiar de ciclo. Es
     fricción real, pero de un campo, no de un checkout entero. **Es el costo de esta decisión
     y conviene que la UI lo anticipe** en vez de sorprender con un formulario.
  2. **La operación no es atómica del lado del proveedor**: son dos llamadas, cancelar y
     crear, y cancelar es **irreversible** (`PA-5`). Si la creación falla después de haber
     cancelado, **el cliente queda sin suscripción**. El orden correcto es **crear primero y
     cancelar después**, y hace falta una reconciliación para el caso en que se caiga en el
     medio y queden dos vivas — que conviven sin conflicto (`EX-6`), así que el estado
     intermedio no es destructivo.
  3. **Toda mutación exige relectura y comparación**, no alcanza con el código de estado. Es
     la regla general que dejó FASE 1C y acá es lo que habría evitado dar por bueno el cambio
     de ciclo.
  4. `DEC-SUB-003` (cambiar de plan en grace) se cruza con esto: si el cambio además mueve el
     ciclo, se recrea. Qué pasa con el período impago al compensar sigue abierto (`E-SUB-05`).
  5. El agujero declarado en `DEC-SUB-001` — bajar de tier y de ciclo a la vez como salida
     anticipada de un compromiso anual — **sigue vigente sin cambios**.
- **Origen**: `BD-SUB-01` (BLOCKING) + FASE 1C.

### DEC-MP-001 — Los cambios de precio sobre suscripciones vigentes se aplican mutando el monto

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: el experimento (`BD-MP-03`)
- **Problema**: el §29 contempla explícitamente que un cambio de precio afecte *"subscriptions
  existentes"*, pero no dice cómo se ejecuta sobre una suscripción que el cliente ya autorizó.
  `BD-MP-03` era una de las cuatro bloqueantes de FASE 2 que no se podían cerrar por
  conversación.
- **Contexto medido** (2026-09-15, sandbox,
  [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md)):
  - `PC-1` **`VERIFIED`**: el monto de una suscripción **autorizada** se muta. 1500 → 2200 → 15
    → 1500, los cuatro pasos verificados **por relectura**, no por el código de estado.
  - `PC-3` **`VERIFIED`**: **no requiere nuevo consentimiento** del usuario. La suscripción
    sigue `authorized` y conserva su medio de pago.
  - `PC-2` **`VERIFIED`**: el piso es **ARS 15**. Cero y negativo se rechazan.
  - `EX-4` **`NOT_SUPPORTED`**: el **ciclo** no se puede mutar. Un cambio de precio que además
    mueva el ciclo no entra por acá.
- **Alternativas**: (1) mutar `transaction_amount` sobre la suscripción vigente; (2) cancelar y
  recrear con el precio nuevo, que es el mecanismo de `DEC-SUB-005`; (3) no aplicar cambios de
  precio a las vigentes y dejarlos sólo para clientes nuevos.
- **Decisión**: **(1)**.
- **Motivo**: es la única que **no le pide nada al cliente**. La (2) exige el código de
  seguridad (`EX-9`) a **toda la base instalada** por un cambio que el cliente no pidió:
  convierte un aumento en una renegociación, y quien no complete el formulario se queda sin
  suscripción. La (3) contradice el §29, que nombra a las suscripciones existentes entre las
  que un cambio de precio *puede afectar*.
- **Implicaciones**:
  1. **Que el proveedor no pida re-consentimiento no significa que no haya que avisar.** El §29
     exige aviso, precio anterior y nuevo, fecha efectiva y derecho a cancelar, y **el proveedor
     no hace nada de eso**: es responsabilidad entera de Hospeda. Acá sólo se cerró la pregunta
     técnica.
  2. **La mutación se verifica por relectura y comparación campo por campo** (§0 de los
     resultados). Es precisamente el terreno donde este proveedor ya demostró aceptar cambios
     que no aplica, y un aumento "aplicado" que no se aplicó no lo nota nadie hasta la
     conciliación.
  3. **El cambio se ejecuta en la fecha efectiva, no cuando se decide.** Eso implica una cola de
     cambios programados, que es el hueco `M-SUB-02`, y no un `PUT` en el momento de la
     decisión comercial.
  4. **Un precio nuevo por debajo de ARS 15 no es aplicable por este camino** (`PC-2`).
  5. Si el cambio de precio **viene con un cambio de ciclo**, no es este camino: es
     `DEC-SUB-005` (cancelar y recrear), con su fricción de código de seguridad.
  6. El §29 cierra con *"Investigar normativa actual antes de implementar"*. **Eso sigue
     pendiente** y no lo resuelve esta decisión: queda en `M-LEGAL-03`.
- **Origen**: `BD-MP-03` (BLOCKING) + FASE 1C.

### DEC-SUB-006 — El cambio de ciclo se re-autoriza en el checkout, y se compensa por valor

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Reemplaza a**: `DEC-SUB-005` (sólo su mecanismo; la política es la misma).
- **Problema**: `DEC-SUB-005` fijó que el cambio de ciclo se hace cancelando y recreando, pero
  dejó tres cosas sin definir que resultaron ser las que deciden el diseño: **cómo vuelve a
  autorizar el cliente**, **qué pasa con los días que ya pagó**, y **en qué momento exacto se
  cancela la suscripción vieja**.
- **Contexto medido**:
  - `EX-4` **`NOT_SUPPORTED`**: el ciclo de una suscripción viva no se muta — `200` y nada cambia.
  - `EX-21` **`NOT_SUPPORTED`**: tampoco se la puede mover de un plan a otro — `200` y sigue en el
    plan viejo. **La documentación oficial del proveedor lo confirma**: una suscripción creada sin
    plan no se puede migrar a un plan después.
  - `EX-9` **`PARTIALLY_SUPPORTED`**: tokenizar la tarjeta guardada **exige el código de
    seguridad**. Sin él el token se genera igual (`201`) y falla recién al usarse.
  - `EX-12` **`NOT_SUPPORTED`**: un token de tarjeta es **de un solo uso**, y el error del segundo
    intento no se parece a «reintentaste».
  - `EX-6` **`VERIFIED`**: varias suscripciones autorizadas del mismo pagador **conviven sin
    conflicto** (seis a la vez, en producción). El estado intermedio no es destructivo.
  - `PA-5`: cancelar es **irreversible**.
  - `EX-3`: cancelar dispara un correo del proveedor que dice *«por cuenta de pagos no realizados
    o por opción del vendedor»* — una baja voluntaria y una por mora le llegan idénticas.
- **Alternativas** para re-autorizar: (1) tokenizar la tarjeta guardada del lado del servidor y
  pedirle el código de seguridad en nuestra página; (2) **crear el `preapproval` en estado
  pendiente y mandarlo al `init_point`**, igual que en el alta.
- **Alternativas** para los días pagados: (a) no compensar; (b) correr la fecha del primer cobro
  tantos días como le quedaban; (c) **correr la fecha por VALOR**: el crédito es lo pagado sin
  usar, y los días que cubre salen de dividirlo por el precio diario del plan nuevo; (d) mover
  plata — cobrar la diferencia o reembolsar.
- **Decisión**: **(2) + (c)**. Se re-autoriza en el **checkout del proveedor**, y los días pagados
  se compensan **por valor**, corriendo la fecha del primer cobro de la suscripción nueva.
- **Motivo**:
  - El checkout **ya hay que tenerlo construido igual**, porque es el flujo del alta —y es el
    modelo que el §5.6 fija como actual—, así que reusarlo no agrega superficie nueva. La
    tokenización sería un flujo entero que existe sólo para este caso.
  - La tokenización **sólo sirve si el cliente paga con tarjeta**. Quien paga con saldo en cuenta
    queda afuera. El checkout acepta todos los medios.
  - Compensar por valor **cuesta lo mismo que no compensar**: en los dos casos hay que mandar una
    fecha de primer cobro futura —es la precondición que evita el doble cobro—, así que la única
    diferencia es qué fecha se calcula. No compensar sólo compra un cliente molesto.
  - Compensar **por días** y no por valor es correcto de mensual a anual y regala plata al revés:
    trasladaría el descuento por compromiso anual a un plan mensual que no lo tiene.
  - Mover plata suma un reembolso con comisión perdida, sobre una API que el proveedor anuncia en
    discontinuación (`R-MP-01`) y con un rechazo que todavía no sabemos explicar (`RF-8`).
- **Implicaciones**:
  1. **La suscripción vieja se cancela al recibir el webhook de autorizada, NUNCA antes.** Si se
     cancela al iniciar el cambio y el cliente abandona el checkout, **se queda sin nada**. Con
     este orden, si nunca autoriza, la vieja sigue viva y no pasó nada.
  2. **La fecha de primer cobro futura no es un detalle: es la precondición de seguridad.** Sin
     ella la nueva cobra en el acto mientras la vieja sigue viva, y el cliente paga dos veces.
  3. **Hace falta una reconciliación** para el caso en que la nueva quede autorizada y la
     cancelación de la vieja falle: quedan dos vivas y el cliente paga dos veces en el ciclo
     siguiente. `EX-6` garantiza que el estado intermedio no rompe nada, no que se limpie solo.
  4. **El correo del proveedor no se puede evitar, pero sí anticipar.** Hay que escribirle antes
     de cancelar, avisándole que va a recibir un aviso de Mercado Pago que habla de cancelación y
     que es parte del cambio que pidió.
  5. **El cliente ve la fecha antes de confirmar**: el checkout le muestra monto y desde cuándo se
     cobra, así que la compensación deja de ser un gesto invisible y pasa a ser parte de lo que
     acepta.
  6. El crédito **se consume entero en la fecha y no deja saldo**, así que no hace falta modelar
     un saldo a favor.
- **CONDICIONADA a `EX-33`**, que está **`UNKNOWN`** (§61): está medido que una fecha futura se
  respeta sobre una suscripción autorizada **por API con token** (`EX-8`), y **nadie midió qué
  pasa cuando la autoriza el cliente en el checkout**. Es la misma distinción que el documento ya
  marca entre `EX-7` y `EX-8`: que el proveedor acepte una fecha al crear no prueba que la respete
  después. Si el checkout la resetea, la compensación no se puede ejecutar por esta vía **y el
  cliente paga dos veces**. Se mide en sandbox, sin costo, completando un checkout a mano una vez.
- **Origen**: punto 1 del contraste PDR ↔ proveedor · §19 · `BD-SUB-01`.

### DEC-SUB-007 — El upgrade se ejecuta con el mismo mecanismo que el cambio de ciclo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende** `DEC-SUB-006` al cambio de **plan**. No la reemplaza.
- **Problema**: el §27 pide que el upgrade sea inmediato y dejó el **impacto económico** marcado
  `PENDING MP VALIDATION`. La medición le dio una respuesta incómoda: **subir de plan es gratis
  hasta el próximo cobro**.
- **Contexto medido**:
  - `UP-1`/`UP-2` **`VERIFIED`** (producción): mutar el monto aplica en el acto y el cobro
    siguiente sale por el monto nuevo — una suscripción que nació en $15 y se subió a $30 cobró
    $30. Pero **el proveedor no prorratea ni cobra la diferencia del ciclo en curso**.
  - `PC-3` **`VERIFIED`**: mutar el monto **no pide un consentimiento nuevo** al cliente.
  - `EX-30` **`VERIFIED`**: una orden de única vez cobra sin habilitación especial — pero
    **necesita un medio de pago**, y no tenemos la tarjeta del cliente de forma reusable
    (`EX-12`: el token es de un solo uso; `EX-9`: tokenizar la guardada pide el código de
    seguridad).
  - `EX-3`: cancelar dispara el correo del proveedor que insinúa mora.
- **Contexto externo** (no es fundamento, es contraste): la industria cobra la diferencia
  prorrateada **al instante** en el upgrade y **difiere** el downgrade al próximo ciclo. La
  asimetría es deliberada y es lo que evita que alguien juegue con los tiempos.
- **Alternativas**: (A) aceptar el upgrade gratis hasta el próximo cobro, que es lo que el
  proveedor hace solo; (B) cobrar la diferencia prorrateada con una orden suelta; (C) **cancelar y
  recrear**, igual que el cambio de ciclo, compensando por valor.
- **Decisión**: **(C)**.
- **Motivo**:
  - **No agrega ni una línea de mecanismo**: es el mismo camino de `DEC-SUB-006` con otro plan en
    vez de otro ciclo. Un solo flujo cubre los dos cambios.
  - **(B) no es viable como parecía**: cobrar una orden suelta **exige un medio de pago**, y ahí
    vuelve exactamente la fricción de tokenización que `DEC-SUB-006` descartó — más un movimiento
    de plata que no hacía falta.
  - **(A) deja un agujero que el downgrade diferido no cierra**: subir de plan y **cancelar antes
    del cobro** entrega un ciclo de plan caro casi gratis.
  - Para un upgrade, un checkout es fricción esperable: el cliente ya decidió gastar más, y de
    paso **ve y acepta el monto nuevo antes de confirmar**, que es lo que el §29 pide comunicar.
- **Implicaciones**:
  1. **Queda una asimetría deliberada entre subir y bajar**, y coincide con la práctica de la
     industria: el **upgrade** se ejecuta cancelando y recreando (pasa por el checkout, cobra
     desde ya), y el **downgrade** se ejecuta como una **mutación programada para el fin del
     ciclo** —sin checkout, porque mutar no pide consentimiento (`PC-3`)—. Esa segunda mitad se
     decide en su propio punto; acá queda anotada la mitad que esta decisión condiciona.
  2. ~~**El downgrade tiene que ser diferido de verdad.** Si se muta el monto en el momento en que
     el cliente lo pide, el proveedor cobrará el monto bajo al fin del ciclo y el cliente habrá
     usado el plan alto pagando el bajo. Cumplir el §28 significa no tocar el monto hasta el fin
     del ciclo, lo que exige la cola de cambios programados de `M-SUB-02`.~~

     ⚠️ **CORREGIDO el 2026-09-16**, el mismo día y antes de decidir el punto 3. Se deja tachado
     en vez de borrado. **La implicación era falsa.** El cobro es **por adelantado**: el del día 1
     ya pagó el período en curso, y el del día 30 paga el mes siguiente, que ya es el plan bajo.
     Así que **mutar el monto cuando el cliente lo pide da el resultado correcto**, y diferirlo
     sería **peor** — una carrera contra el cobro donde perder significa cobrarle el plan caro un
     mes que no va a usar. El agujero que motivó el párrafo era el del **upgrade gratis**, y lo
     cierra la decisión (C) de arriba, no el downgrade. **El downgrade no necesita la cola de
     `M-SUB-02`.** Lo que sí se difiere al fin del ciclo son los **entitlements**, que son
     nuestros y no del proveedor — ver `DEC-SUB-008`.
  3. **Cada upgrade dispara el correo de cancelación del proveedor**, que dice *«por cuenta de
     pagos no realizados o por opción del vendedor»*. Alguien que acaba de **pagar más** recibe un
     aviso que insinúa que lo dieron de baja por no pagar. Se mitiga igual que en `DEC-SUB-006`:
     escribirle **antes** de cancelar. Es el costo declarado de esta decisión.
  4. **Los addons no se cancelan solos.** Como un addon recurrente es una suscripción aparte
     (`EX-6`), cancelar la del plan no los toca. Al recrear hay que decidir si siguen colgando del
     cliente o si hay que re-vincularlos — es el hueco `E-ADDON-04`.
  5. Hereda de `DEC-SUB-006` sus tres precondiciones: fecha de primer cobro futura, cancelación de
     la vieja **sólo al recibir el webhook de autorizada**, y reconciliación para el caso en que
     la nueva quede viva y la cancelación falle.
- **CONDICIONADA a `EX-33`**, igual que `DEC-SUB-006`: si el checkout no respeta la fecha de
  primer cobro futura, el cliente paga dos veces.
- **Para revisar**: si alguna vez la fricción del checkout mide caída de conversión en upgrades,
  la alternativa (A) es defendible como decisión comercial — regala medio ciclo a cambio de cero
  fricción y de no disparar el correo de cancelación.
- **Origen**: punto 2 del contraste PDR ↔ proveedor · §27.

### DEC-SUB-008 — El downgrade muta el monto ya, baja los entitlements al fin del ciclo, y el excedente se avisa antes de tocarlo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §28 pide que el downgrade se aplique al fin del ciclo conservando el plan
  anterior hasta entonces, y **no dice qué pasa con lo que ya no entra** en el plan nuevo — un
  anfitrión con 5 fichas publicadas que baja a un plan de 3. Ese hueco es `M-ENT-02`.
- **Contexto medido**:
  - `DW-1`/`DW-2` **`VERIFIED`** (producción): el proveedor **cobra siempre el monto vigente al
    momento del cobro**. Una suscripción que nació en $30 y se bajó a $15 cobró $15.
  - `PC-3` **`VERIFIED`**: mutar el monto **no pide consentimiento** al cliente.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite ningún webhook**. Nuestro estado sólo se
    entera releyendo.
  - `EX-3`: el cliente recibe *«El vendedor Hospeda cambió el monto»*. En un descenso es benigno,
    pero llega sin contexto y antes que nosotros.
- **Decisión**, en tres partes:
  1. **El monto se muta cuando el cliente lo pide.** No se difiere. El cobro es por adelantado, así
     que el próximo cobro ya corresponde al plan nuevo y sale correcto solo. Diferirlo sería una
     carrera contra el cobro (ver la corrección de `DEC-SUB-007`).
  2. **Los entitlements bajan al fin del ciclo**, no al pedirlo. Son dos relojes distintos: entre
     el pedido y el fin del ciclo el cliente ve el precio nuevo y conserva los beneficios viejos,
     que es exactamente lo que el §28 pide.
  3. **El excedente se avisa, no se ejecuta por sorpresa.** Al pedir el downgrade se le muestra
     qué no va a entrar y se le pide que elija qué conserva. **No es obligatorio**: puede
     confirmar igual, y tiene hasta el fin del ciclo para ordenarlo él. Si llegado ese momento
     sigue excedido, **el sistema despublica automáticamente** hasta dejarlo dentro del límite.
- **Motivo**:
  - Del lado del proveedor **no había nada que elegir**: mutar funciona, no pide consentimiento y
    no dispara el correo de cancelación. Es el único de los tres cambios de plan que sale limpio.
  - **Bloquear el downgrade hasta que ordene empuja a cancelar del todo.** Alguien que baja porque
    no puede pagar y se encuentra bloqueado no vuelve al plan caro: se va. Es mejor que baje.
  - **Automático puro sin aviso puede despublicarle la ficha principal**, que para un anfitrión es
    el negocio. Avisar primero y dejar que elija cuesta una pantalla y evita ese daño.
- **Implicaciones**:
  1. **Despublicar no es borrar.** El automático saca del público; los datos siguen y el dueño los
     ve, según `DEC-DATA-001`. Eso es lo que hace tolerable el fallback.
  2. **Hace falta guardar la elección** del cliente entre el pedido y el fin del ciclo, y un
     proceso que la ejecute. No es la cola de cambios programados del proveedor (`M-SUB-02`): es
     una cola nuestra, de entitlements.
  3. **Arrepentirse es barato**: volver al plan alto antes del fin del ciclo es otra mutación del
     monto más cancelar el descenso programado.
  4. **Toda mutación se verifica releyendo.** Como no emite webhook, un cambio de monto que el
     proveedor acepta y no aplica no lo nota nadie hasta la conciliación.
  5. **Nuestro aviso tiene que salir antes** que el del proveedor, o al menos explicar el que ya
     le llegó.
- **El criterio del automático: se despublican primero las publicadas MÁS RECIENTEMENTE**, hasta
  quedar dentro del límite. Cerrado el 2026-09-16 por el owner. Se descartaron «las de menos
  visitas» y «pedirle un orden de prioridad» por el mismo motivo: **es el único criterio que el
  cliente puede predecir sin mirar métricas**. Si el aviso dice «vamos a despublicar las últimas
  que publicaste», sabe qué va a pasar y puede actuar; con un criterio por rendimiento no puede
  anticiparlo, y una sorpresa ahí le pega al negocio. **Por eso el criterio va escrito en el
  aviso**, no sólo en el código: si el cliente no puede leerlo, deja de ser predecible y el
  motivo por el que se eligió se pierde.
- **Origen**: punto 3 del contraste PDR ↔ proveedor · §28 · `M-ENT-02`.

### DEC-SUB-009 — La baja a fin de período cancela YA y sostiene el servicio de nuestro lado

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §24 pide que la baja se haga efectiva al final del período ya pagado,
  manteniendo el servicio hasta entonces. El proveedor **no lo ofrece** para una suscripción viva,
  así que hay que emularlo — y la forma obvia de emularlo es la peligrosa.
- **Contexto medido**:
  - `CN-1` **`PARTIALLY_SUPPORTED`**: la baja programada existe, pero **sólo se puede fijar al
    CREAR** la suscripción. El mismo campo sobre una autorizada devuelve `200` y **no aparece en
    la relectura**. Justo el caso que importa —una baja se pide *después* de contratar— es el que
    no entra.
  - `GT-1` **`VERIFIED`** (producción): cancelar **frena el cobro**. El sujeto cancelado tenía su
    cobro agendado para el mismo instante que los otros y no cobró.
  - `PA-5`: cancelar es **irreversible**.
  - `EX-3`: cancelar dispara el correo del proveedor que insinúa mora.
- **Contexto externo** (contraste, no fundamento): los proveedores maduros lo resuelven adentro
  —Stripe tiene un `cancel_at_period_end` nativo, y reactivar es ponerlo en falso—. Y el **fallo
  parcial de ese agendamiento está documentado como vulnerabilidad real de implementación**: el
  trabajo programado falla a medias, el procesador no se entera de nada y al vencimiento
  **renueva y sigue cobrando**.
- **Alternativas**: (A) un trabajo programado que cancele el día del vencimiento, dejando la
  suscripción viva en el proveedor hasta entonces; (B) **cancelar en el proveedor de inmediato y
  sostener el servicio de nuestro lado** hasta el fin del período pagado.
- **Decisión**: **(B)**.
- **Motivo, y es uno solo: la dirección en la que falla cada una.** Las dos tienen procesos que se
  pueden caer; lo que se elige es qué pasa cuando se caen.
  - Con **(A)** el fallo **cobra plata que no corresponde**, y repararlo exige un reembolso — con
    la comisión perdida, sobre la API que el proveedor anuncia en discontinuación (`R-MP-01`) y
    con el rechazo de `RF-8` que todavía no sabemos explicar.
  - Con **(B)** el fallo **regala unos días de servicio**, y se corrige sin mover un peso.
  - Segundo argumento: con (A) la suscripción **sigue viva en el proveedor** entre el pedido y el
    vencimiento, así que cualquier otra operación de esa ventana se cruza con una baja pendiente
    que el proveedor no conoce. Con (B) el estado es simple: cancelada allá, con una fecha de fin
    de servicio en nuestra base.
- **Implicaciones**:
  1. **El costo de esta decisión es el arrepentimiento, y es más frecuente que un proceso caído.**
     Como cancelar es irreversible, volver atrás exige **recrear**. No es código nuevo —es el
     mismo camino de `DEC-SUB-006`— pero es fricción, sobre alguien que acaba de decidir quedarse.
  2. **El correo del proveedor le llega el día que pide la baja, no el día que termina.** Va a
     leer *«tu suscripción fue cancelada»* con días de servicio por delante. **Nuestro aviso tiene
     que salir antes y decir la fecha real hasta la que tiene acceso**, o va a creer que perdió lo
     que pagó.
  3. **La fecha de fin de servicio pasa a ser un dato nuestro**, no del proveedor. El
     `next_payment_date` de una suscripción cancelada **no sirve**: sigue mostrando una fecha
     futura que ya no significa nada.
  4. El proceso que corta el servicio al vencimiento **tiene que ser idempotente**: si corre dos
     veces, la segunda no hace nada.
- **Origen**: punto 4 del contraste PDR ↔ proveedor · §24.

### DEC-MP-002 — El aumento rige ya para los nuevos, y alcanza a los existentes tras 60 días de aviso

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Complementa** `DEC-MP-001`, que decidió el **mecanismo** (mutar el monto). Esta decide la
  **política**: cuándo se avisa, con cuánta antelación, y cómo alcanza a quien ya está.
- **Problema**: el §29 exige avisar, mostrar el precio anterior y el nuevo, la fecha efectiva y
  permitir cancelar — y cierra con *«investigar normativa actual antes de implementar»*.
  `DEC-MP-001` cerró la pregunta técnica y dejó ésta abierta.
- **Contexto medido**:
  - `PC-1`/`PC-3` **`VERIFIED`**: el monto de una suscripción viva se muta **sin pedirle un
    consentimiento nuevo** al cliente.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite ningún webhook**. Nuestro sistema sólo se
    entera releyendo.
  - `EX-3` **`VERIFIED`**: **el proveedor le escribe al cliente por su cuenta** —*«El vendedor
    Hospeda cambió el monto»*— y lo hace **en el acto**.
  - `DW-1`/`DW-2` **`VERIFIED`**: el proveedor cobra siempre el **monto vigente al momento del
    cobro**, así que mutar hoy alcanza a la próxima renovación sea cuando sea.
- **Decisión**, en tres partes:
  1. **Cambiar el precio del plan rige de inmediato para los que se suscriban desde ese momento.**
  2. **A los que ya estaban se les aplica también, pero recién después de una ventana de aviso de
     al menos 60 DÍAS**, con **tres contactos**: al anunciar, a 30 días y a 7 días. Cada uno lleva
     el precio actual, el nuevo, **la fecha en que le toca a ese cliente** y que si no acepta
     puede cancelar.

     **La ventana se cuenta desde el PRIMER AVISO, no desde el cambio del catálogo.** Lo que la
     regla protege es el tiempo de reacción del cliente: si el precio cambia un lunes y se avisa
     el jueves, el cliente tuvo tres días menos.

     **Cómo cae la fecha efectiva, por ciclo:**
     - **Mensual** — 60 días desde el primer aviso, **aunque en el medio haya cobros**. El aumento
       se aplica en el **primer cobro estrictamente posterior** a cumplirse los 60 días. En la
       práctica: **dos cobros al precio viejo y el tercero al nuevo**.
     - **Anual** — el aviso sale **60 días antes de su renovación**, y el aumento se aplica en esa
       renovación. **Si al decidirse el aumento le faltan menos de 60 días para renovar, no se
       llega a avisar y su aumento se posterga a la renovación SIGUIENTE** — hasta catorce meses
       después. Es el costo de la regla, y es deliberado.
     - **El empate lo gana el cliente**: un cobro que cae justo el día 60 va al precio viejo.
  3. **Llegada esa fecha, el monto se muta automáticamente.** No hace falta que el cliente acepte
     nada; sí puede cancelar antes.
- **Motivo**:
  - **El owner quiere que el aumento alcance a todos**, no sólo a los nuevos. Una versión anterior
    de esta decisión fijaba migración explícita por cliente —es decir, que si nadie la ejecutaba
    los viejos conservaban el precio para siempre— y **eso no era lo que se quería**. Corregido el
    mismo día, antes de implementar nada.
  - **La ventana larga es lo que hace real el derecho a cancelar del §29.** Con 30 días y ciclo
    mensual el cliente tiene un solo ciclo para reaccionar; con dos meses tiene dos o tres. La
    antelación no es cortesía: es la condición para que «cancelá si no aceptás» signifique algo.
  - **Tres contactos y no uno** porque un único mail se pierde, y el costo de que se pierda lo
    paga el cliente con un cobro que no esperaba.
  - **Nuestro aviso sale antes de mutar, siempre.** Como el proveedor le escribe al cliente en el
    instante de mutar y a nosotros no nos avisa, si no hablamos primero el cliente se entera por
    un tercero. Con tres avisos previos, el correo del proveedor llega como **confirmación**.
- **Implicaciones**:
  1. **La fecha efectiva es por cliente, no global**, y sale de la regla por ciclo de arriba. Un
     anual que ya pagó hasta dentro de nueve meses no puede recibir un aviso que diga «desde el 1
     de diciembre»: el aumento lo alcanza en **su** renovación. El anuncio es global, **cada mail
     dice la fecha de ese cliente**, o el «cancelá antes» no le sirve para calcular nada.
  1b. **Un aumento tarda en rendir, y hay que preverlo.** En mensual, dos ciclos completos al
     precio viejo; en anual, hasta catorce meses. Quien decida un aumento tiene que saber cuándo
     empieza a cobrarse de verdad.
  2. **El precio vive en la suscripción, no sólo en el plan.** Durante la ventana conviven dos
     precios para el mismo plan, y lo que se cobra es el de la suscripción.
  3. **El proceso que aplica el aumento falla para el lado bueno**: si no corre, el cliente sigue
     pagando el precio viejo y nadie cobra de más. Pero **hay que registrar a quién se le
     aplicó**, para que un fallo parcial no deje media cartera migrada sin que se sepa cuál.
  4. **La mutación se verifica releyendo**, siempre: no hay webhook que confirme, y es el terreno
     donde el proveedor ya demostró aceptar sin aplicar.
  5. Quien cancela para no aceptar el aumento entra por `DEC-SUB-009`: se cancela en el proveedor
     de inmediato y conserva el servicio hasta el fin del período que pagó.
  6. **Falta resolver un cruce**: qué pasa si la fecha del aumento cae sobre una suscripción en
     mora o en grace. Queda como hueco, no se completa en silencio.
- **RIESGO LEGAL DECLARADO Y ACEPTADO POR EL OWNER.** La parte 3 se apoya en que **el silencio
  del cliente vale como aceptación** de una modificación del contrato. Es el modelo estándar de la
  industria, **pero no está verificado para Argentina** y es precisamente el terreno donde la
  normativa de consumo suele ser restrictiva. El owner decidió explícitamente **avanzar así y
  corregir si la consulta legal dice otra cosa** (2026-09-16).
  **Si resultara que el silencio no alcanza, esta decisión cambia de forma**: haría falta una
  aceptación activa, y quien no responda no podría ser aumentado. Eso no sería un ajuste de
  redacción sino otro diseño, así que **conviene resolverlo antes de implementar el punto 5**.
  Va a `M-LEGAL-03` junto con las otras dos pendientes —el plazo de notificación y el botón de
  baja—, y **las tres piden revisión profesional, no una búsqueda web**.
- **Origen**: punto 5 del contraste PDR ↔ proveedor · §29 · `M-LEGAL-03`.

### DEC-CONC-001 — El candado contra el doble cobro es nuestro, durable, y el duplicado se cancela solo pero se reembolsa con confirmación

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §51 y el §52 piden diseñar explícitamente para el doble clic, los reintentos,
  los webhooks duplicados, el desorden, los jobs duplicados y los fallos de red. La medición dejó
  ese pedido sin red de contención del lado del proveedor.
- **Contexto medido**:
  - `EX-17` **`NOT_SUPPORTED`**: la creación de una suscripción **no deduplica por ningún
    mecanismo**. Diez intentos, diez ids. Ni `external_reference` ni `X-Idempotency-Key` — el
    header **se acepta y no hace nada**. Re-verificado en producción.
  - `RF-4`/`RF-6` **`VERIFIED`**: en `/refunds` el mismo header es **obligatorio** y **se
    respeta**. **La idempotencia de este proveedor es POR ENDPOINT** y no se puede razonar de uno
    al otro. La documentación oficial lo confirma y advierte que no se le atribuyan a la API de
    suscripciones garantías que no tiene.
  - `RC-1` **`PARTIALLY_SUPPORTED`**: el buscador de suscripciones **ignora `external_reference`
    en silencio**; sí filtra por `payer_email` y `status`, y los compone.
  - `PA-3`: una creación **autorizada cobra** — al instante en sandbox, ~26 min en producción.
  - `RF-8`: hay un rechazo de reembolso que **no sabemos explicar** ($5 se rechaza y $14 entra
    sobre el mismo pago). `R-MP-01`: la API donde viven los reembolsos está anunciada en
    discontinuación.
  - `payer.id` **no identifica a una persona** — el mismo mail apareció con dos ids. El mail sí.
- **Decisión**, en tres partes:
  1. **El candado es nuestro, va ANTES de llamar al proveedor, y es DURABLE.** Nada en memoria del
     proceso: en un despliegue conviven dos contenedores sirviendo tráfico, y un registro en
     memoria deja de deduplicar justo cuando más falta hace.
  2. **La recuperación tras un timeout no pregunta por nuestra referencia, pregunta por el
     pagador.** Como el buscador ignora `external_reference`, la pregunta *«¿ya creé ésta?»* no
     tiene respuesta; la que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada
     que yo no tenga registrada?»**, por `payer_email` + `status`.
  3. **Ante un duplicado que ya cobró: se cancela automáticamente, y el reembolso lo confirma una
     persona.**
- **Motivo**:
  - El caso peligroso **no lo cubre un candado**: mandamos crear, el proveedor crea y cobra, y la
    respuesta se pierde. Desde nuestro lado sólo hay un timeout. Reintentar son dos cobros; no
    reintentar deja a alguien que pagó sin servicio. **Sólo lo resuelve preguntarle al proveedor**,
    y por eso la parte 2 es tan importante como la 1.
  - **Cancelar y reembolsar no son igual de riesgosos.** Cancelar detiene el daño futuro, no mueve
    plata, y lo peor que puede salir mal es cancelar algo que igual había que cancelar. El
    reembolso es **la operación que más veces nos sorprendió midiendo**, sobre una API en
    discontinuación. Automatizar lo primero y confirmar lo segundo separa lo reversible de lo que
    no lo es.
  - Con tres clientes, la confirmación humana llega en minutos; el costo de esperar es bajo y el
    de un reembolso automático mal disparado no.
- **Implicaciones**:
  1. **El daño no es simétrico, y el diseño tiene que reflejarlo.** Dos suscripciones sin
     autorizar son inofensivas; **una creación autorizada cobra**, así que ahí un reintento son
     dos cobros reales. El candado tiene que ser más estricto en el camino que autoriza.
  2. **La clave de idempotencia se genera y se persiste ANTES de la primera llamada**, no al
     reintentar. Si se genera en el reintento, no hay nada que comparar.
  3. **Hace falta un reconciliador que barra los estados intermedios**: creaciones que quedaron sin
     respuesta, y suscripciones del proveedor que no tienen contraparte nuestra.
  4. **El `external_reference` sirve para RECONOCER, no para ENCONTRAR.** Una vez que tenés la
     suscripción en la mano, la referencia te dice de quién es; pero no podés llegar a ella por la
     referencia. Y `EX-19` mide que se puede **reescribir** sobre una autorizada, así que es una
     vía de reparación de vínculos.
  5. **Los webhooks también se deduplican de nuestro lado**, y no alcanza con mirar el tipo: el
     proveedor emite **tres notificaciones por reembolso, en dos formatos distintos para el mismo
     hecho** (`RF-7`).
- **Origen**: punto 6 del contraste PDR ↔ proveedor · §51 · §52 · `M-CONC-01`.

### DEC-CONC-002 — La conciliación se apoya en NUESTRO inventario, detecta huérfanas por webhook, y sólo repara el vínculo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §23 pide un proceso periódico contra el proveedor que detecte webhooks
  faltantes, duplicados, pagos y suscripciones huérfanas, estados que no coinciden y preapprovals
  desconocidos. La forma canónica de hacerlo —dos extracciones paralelas, la nuestra y la del
  proveedor, enfrentadas en una capa de comparación— **no es aplicable acá**, porque una de las
  dos no se puede obtener.
- **Contexto medido**:
  - `RC-2` **`VERIFIED`**: leer una suscripción **por su id** es confiable.
  - `RC-1` **`PARTIALLY_SUPPORTED`**: **buscarlas no lo es**, y falla en tres direcciones sin
    avisar en ninguna — ignora `external_reference` y devuelve **todo**; con un `status` inválido
    devuelve **nada** (`200` con cero resultados, no un error); y con uno válido devuelve **un
    subconjunto plausible** (en producción, `cancelled` trajo **15 de 69**). El tercero es el peor:
    un barrido procesa parte de la cartera y **termina sin error**.
  - `RC-4` **`NOT_SUPPORTED`**: el buscador devuelve **menos campos** que el `GET`.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite webhook**. Una divergencia de monto no se
    anuncia por ningún canal: sólo aparece releyendo.
  - `EX-19` **`VERIFIED`** (producción): el `external_reference` **se puede reescribir** sobre una
    suscripción viva. Es la vía de reparación de un vínculo roto.
  - `EX-16`: `/authorized_payments` **llega tarde**, y eso ya casi produjo una conclusión falsa.
  - Documentación oficial: el buscador de pagos cubre **sólo los últimos doce meses**.
- **Decisión**, en cuatro partes:
  1. **El inventario a conciliar sale de NUESTRA base**, no de la del proveedor: se guarda el id de
     cada suscripción y se leen de a una. El buscador **no puede ser fuente de verdad de nada**.
  2. **Las huérfanas se detectan por WEBHOOK, no por barrido.** Toda suscripción que cobra emite
     uno; si llega uno de un preapproval que no conocemos, eso *es* la detección.
  3. **Barrido diario** de la cartera propia, para lo que el webhook no cubre — sobre todo los
     estados que divergen **en silencio**, como un cambio de monto que el proveedor aceptó y no
     aplicó.
  4. **Sólo se repara el vínculo automáticamente.** Re-vincular una huérfana reescribiendo su
     `external_reference` no cambia plata ni estado: sólo dice de quién es. Toda divergencia de
     **monto, estado o cobro** emite `RECONCILIATION_REQUIRED` y la mira una persona.
- **Motivo**:
  - La parte 1 **no es una elección**: está medida. Cualquier diseño que liste desde el proveedor
    va a procesar una fracción de la cartera y a terminar en verde.
  - La parte 2 resuelve el punto ciego que deja la 1: si sólo miramos los ids que ya tenemos, una
    suscripción que nunca registramos no aparecería jamás. **Y el detector ya existe y funciona
    hoy en producción**: el `SubscriptionNotResolvedError` que encontramos de paso es exactamente
    eso — el sistema detecta la huérfana bien, y lo que está mal es lo que hace después (responde
    `500` y la encola cinco veces). Lo que falta no es el detector, es el tratamiento.
  - La parte 4 aplica la misma frontera que `DEC-CONC-001`, y el owner la eligió por segunda vez:
    **la línea no es «automático contra manual», es «toca plata o no toca plata»**.
- **Implicaciones**:
  1. **Guardar el id de cada suscripción deja de ser una comodidad y pasa a ser la condición de
     que la conciliación exista.** Si se pierde un id, esa suscripción se vuelve invisible para el
     barrido — y sólo reaparece si cobra y emite webhook.
  2. **El `SubscriptionNotResolvedError` vivo en producción pasa de bug a caso de uso.** Cuando se
     arregle, no debe silenciarse: debe convertirse en el disparador de la re-vinculación.
  3. **La conciliación no puede apoyarse en `/authorized_payments` para concluir que algo no
     cobró**: llega tarde, y la ausencia de cobros tiene tres causas distintas — no cobró nunca,
     lag, o el id es de otra cuenta.
  4. **Más allá de doce meses, la única fuente somos nosotros.** El buscador de pagos no llega, así
     que el histórico tiene que ser nuestro o no existe.
  5. `RECONCILIATION_REQUIRED` ya notifica a `SUPER_ADMIN` por regla del PDR; esta decisión define
     **cuándo se emite**: en toda divergencia que toque plata o estado.
- **Origen**: punto 7 del contraste PDR ↔ proveedor · §23 · §22.1.

### DEC-MAIL-001 — Nuestro correo bloquea la acción sólo donde el del proveedor hace daño, y los correos falsos se anticipan

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §42 se escribió como si fuéramos los únicos que le hablan al cliente, y la
  medición mostró que no. Además, **cinco decisiones anteriores** (`DEC-SUB-006`, `007`, `008`,
  `009` y `DEC-MP-002`) se apoyan en que «nuestro aviso sale antes», y ninguna definía qué pasa si
  no sale.
- **Contexto medido** (`EX-3`, sobre la casilla real del owner: 43 correos del proveedor en un día):
  - El proveedor le escribe al cliente **por su cuenta** en el **alta**, el **cambio de monto**, la
    **pausa** y la **cancelación** — y **siempre primero**.
  - **Tres de esos correos afirman cosas que sus propios datos desmienten**: *«Pagaste la
    suscripción»* 18 s después de autorizar, cuando no se cobró nada —y en los sujetos pausados y
    cancelados ese cobro **no llegó nunca**—; *«Cobramos $15 para validar tu tarjeta»* cuando el
    cargo registrado es de **$0**; y el rechazo `2084` que dice que un pago no se puede reembolsar
    cuando sí se puede.
  - **`paused` y `cancelled` llegan idénticos**: *«por un pago no realizado o por opción del
    vendedor»*. Una cortesía y una mora son indistinguibles para el cliente.
  - Los cuatro lo mandan a **nuestra** puerta (*«contactá con el vendedor»*): **no hay
    autogestión**, todo cae en nuestro soporte.
  - `EX-19` **`VERIFIED`**: el **`reason` es el texto que ve el cliente** en asunto y encabezado,
    y **se puede reescribir**.
  - `EX-22`: si la suscripción se crea **con plan**, el `reason` propio se descarta y queda el del
    plan.
  - `EX-15`: mutar el monto **no nos avisa a nosotros**, pero **sí le avisa a él**.
- **Decisión**, en tres partes:
  1. **Nuestro correo bloquea la acción SÓLO donde el del proveedor hace daño**: antes de
     **cancelar**, sí; antes de mutar un monto, no. Si el correo no sale, la cancelación no se
     ejecuta y se reintenta.
  2. **Los correos falsos del proveedor se ANTICIPAN, no se desmienten.** Nuestro correo de alta
     avisa que va a llegar uno diciendo que ya pagó, y da la fecha del primer cobro real.
  3. **El `reason` es copy, no un identificador.** Nunca lleva un id interno ni un slug.
- **Motivo**:
  - Bloquear **siempre** acopla el cobro al proveedor de mail: una caída de algo accesorio frenaría
    algo crítico. No bloquear **nunca** deja el peor resultado posible —que el cliente reciba
    **sólo** el correo ambiguo o falso— y además **ocurre sin que nadie lo note**.
  - **Bloquear donde importa resulta gratis** por cómo quedaron las decisiones anteriores: en el
    cambio de ciclo y el upgrade, la cancelación de la vieja ocurre **cuando llega el webhook de
    que la nueva quedó autorizada**, que es un momento que controlamos. La secuencia natural es
    webhook → correo → cancelar, y si el correo falla **no se cancela y se reintenta**. El estado
    intermedio no es destructivo: las dos suscripciones conviven (`EX-6`) y la nueva no cobra
    porque tiene fecha futura. **Bloquear ahí no frena nada ni arriesga nada.**
  - Desmentir al proveedor es una pelea que se pierde: su correo llega primero y con su marca.
    **Anticiparlo convierte la contradicción en algo previsto.**
- **Implicaciones**:
  1. **Regla para soporte, que sale directo de la medición: ante un reclamo, mirar el PAGO, nunca
     el correo.** Ninguna decisión de atención puede apoyarse en la copy del proveedor.
  2. **Nuestra comunicación tiene que desambiguar lo que el proveedor dejó ambiguo**: si pausamos
     por cortesía, decirlo; si es por mora, decirlo. El cliente recibe el mismo texto del
     proveedor en los dos casos.
  3. **No hay autogestión del lado del proveedor**: toda baja, cambio o duda cae en nuestro
     soporte. Dimensionarlo así, no como excepción.
  4. **El `reason` se controla por suscripción sólo porque no usamos los planes del proveedor**
     (`DEC-MP-002`). Si alguna vez se usaran, el texto lo fijaría el plan y sería **un texto por
     combinación** de vertical, tier y ciclo.
  5. El aviso del punto 3 —el excedente al bajar de plan— **lleva escrito el criterio** con que se
     despublicaría automáticamente, o el criterio deja de ser predecible.
- **Origen**: punto 8 del contraste PDR ↔ proveedor · §42 · §43 · `M-MAIL-04`.

### DEC-RF-001 — La revocación reembolsa y cancela en un solo acto; el botón de arrepentimiento queda fuera de alcance hasta la consulta legal

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §54 y `M-LEGAL-01` dan por supuesto poder reembolsar, pero no dicen **cuándo se
  reembolsa, qué pasa con la suscripción, ni qué hace el sistema cuando el proveedor rechaza sin
  motivo entendible**.
- **Contexto medido** (todo en **producción**, con los cuatro pagos del propio owner):
  - `RF-1`/`RF-2` **`VERIFIED`**: reembolso **total y parcial**, en los dos tipos de cobro. Los
    parciales **se acumulan** hasta completar el total y validan contra el **saldo**, no contra el
    monto original. **No hay monto mínimo** — ARS 5 entró sobre pagos de 5.000 y 7.500.
  - `RF-6` **`VERIFIED`**: **es idempotente**. Misma clave → `200` con cuerpo vacío y ningún
    reembolso nuevo. **Devuelve `200`, no `201`** —un cliente que sólo acepte `201` trata una
    reentrega correcta como fallo— y **no devuelve el reembolso original** en el cuerpo.
  - `RF-4` **`VERIFIED`**: `X-Idempotency-Key` es **obligatoria**, y falla **antes** de cualquier
    validación de negocio.
  - `RF-5`: `cause[0].code` distingue el motivo (`2063` estado del pago, `2017` monto). **El
    `message` no alcanza.**
  - `RF-8`: **hay un rechazo sin explicar.** Sobre el mismo pago, $5 se rechaza con `2084` y $14
    entra. Cuatro hipótesis murieron. Lo único probado es negativo y alcanza: **no es una
    propiedad del pago**, aunque el mensaje diga exactamente eso.
  - **Reembolsar el cobro de una suscripción viva NO la da de baja** (sonda 32).
  - `R-MP-01`: la API donde viven los reembolsos está anunciada en **discontinuación**, y su guía
    de migración **excluye explícitamente a las suscripciones**.
- **Contexto normativo** (búsqueda propia con fuente oficial, **no es una opinión legal**):
  la **Resolución 424/2020** sobre la Ley 24.240 art. 34 fija **10 días corridos** para revocar,
  un **botón de arrepentimiento** visible en el primer acceso de la página de inicio, **sin exigir
  registro ni trámite**, y **24 horas** para informar el código de identificación.
- **Decisión**, en cuatro partes:
  1. **La revocación es UNA sola operación: reembolso total + cancelación.** No dos cosas que
     alguien tenga que acordarse de hacer juntas. Un reembolso por otra causa —un duplicado, un
     error nuestro— **no cancela nada**.
  2. **El pedido se registra y se responde al instante; el reembolso se ejecuta con confirmación
     humana.** El acceso al servicio se corta enseguida si el cliente lo pide; la plata sale
     dentro de la ventana. Concilia el plazo de 24 h con la regla que ya rige en `DEC-CONC-001` y
     `DEC-CONC-002`: **lo que toca plata lo mira una persona**.
  3. **Ante el `2084`, el sistema NUNCA concluye que el pago no se puede reembolsar.** Reintenta
     con otro monto o cae al reembolso total. Está medido que ese mensaje miente.
  4. **El botón de arrepentimiento queda FUERA DE ALCANCE por ahora**, por decisión explícita del
     owner (2026-09-16), hasta que lo consulte con un abogado.
- **Motivo de la parte 1**: está medido que reembolsar **no** da de baja. Si alguien se arrepiente
  y sólo le devolvemos la plata, **le vuelven a cobrar el mes siguiente** — el peor final posible
  para un cliente que ya se estaba yendo.
- **RIESGO DECLARADO Y ACEPTADO (parte 4).** No implementar el botón **no es una funcionalidad
  faltante: si la norma aplica, es un incumplimiento.** El owner decidió no construirlo sobre una
  búsqueda web y consultarlo profesionalmente primero, lo cual es razonable — pero el riesgo corre
  mientras tanto. **Las preguntas ya están formuladas** para esa consulta:
  1. ¿Una suscripción mensual recurrente queda alcanzada igual que una compra única?
  2. **¿Cada renovación abre una ventana nueva de 10 días, o corre una sola vez desde el alta?**
     Esto cambia el diseño, no sólo la redacción.
  3. ¿El botón es exigible para nuestro rubro y tamaño?
  4. Las otras tres de `M-LEGAL-03`: plazo de notificación de aumentos, botón de baja, y **si el
     silencio del cliente vale como aceptación** de un aumento.
- **Implicaciones**:
  1. **El histórico de reembolsos es nuestro o no existe**: el buscador de pagos del proveedor
     cubre **sólo doce meses**.
  2. **Un reembolso emite TRES notificaciones, en DOS formatos distintos para el mismo hecho**
     (`RF-7`). Deduplicar por tipo no alcanza.
  3. **`RF-3` sigue `UNKNOWN`**: no sabemos qué pasa con un pago de más de 180 días, porque
     todavía no existe uno.
  4. El riesgo de plataforma de `R-MP-01` **cae entero sobre este punto**: es la única capacidad
     del diseño que vive en una API anunciada como discontinuada, sin camino de migración
     publicado para suscripciones.
- **Origen**: punto 9 del contraste PDR ↔ proveedor · §54 · `M-LEGAL-01`.

### DEC-SUB-010 — La pausa es la del proveedor, empieza ya, dura meses enteros, y el que vuelve antes paga el ciclo siguiente completo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §26.4 pide que el usuario **no pierda período ya pagado por estar pausado**. El
  proveedor no lo hace solo, y —esto es lo nuevo— **tampoco nos deja arreglarlo**.
- **Contexto medido** (sandbox 2026-09-16, con producción coincidiendo en el tercer punto):
  - `PS-4` **`NOT_SUPPORTED`**: **no existe la auto-reanudación**. El sujeto estuvo `paused` 24,5 h
    y siguió `paused`, con `last_modified` sin tocar. **MP no tiene `pauseUntil`**: el reloj que
    termina una pausa es NUESTRO, sí o sí.
  - `PS-5` **`VERIFIED`**: reanudar cambia **sólo el `status`**. `next_payment_date` queda clavado
    donde estaba; no se adelanta, no se corre, no dispara cobro de recuperación ni deja deuda.
  - `PS-6` **`NOT_SUPPORTED`**: el ciclo que vence **estando pausada** avanza la fecha +1 ciclo
    **sin cobrar**. El período pagado que no se usó se pierde, y no hay nada para recuperarlo. Ya
    se había visto en producción (`PS-2`).
  - `EX-34` **`NOT_SUPPORTED`**: **la fecha de cobro de una suscripción viva es inmutable.** Cuatro
    formas de pedirlo, cuatro `200`, cero cambios, `last_modified` congelado en las cuatro — con el
    control que lo separa de "esta suscripción está rara": el **monto** sí muta en el mismo
    instante. Es lo que cierra la puerta: `start_date` a futuro sólo funciona **al crear**
    (`EX-7`).
  - `EX-11` **`VERIFIED`**: estando pausada **no se puede modificar nada** (`400` explícito), pero
    **sí cancelar**.
- **Alternativas**: (A) diferir la pausa al fin del ciclo, para que el cliente use todo lo que
  pagó; (B) pausar ya y devolverle los días perdidos como **servicio nuestro**, con un crédito en
  nuestra base desfasado a propósito del calendario del proveedor; (C) **pausar ya, en múltiplos
  de un ciclo entero, sin compensación de ninguna clase**.
- **Decisión**: **(C)**. La pausa empieza **en el momento en que el cliente la pide**, se elige en
  **cantidad de meses**, y los días no usados del ciclo en curso **se pierden**. El cliente puede
  **volver cuando quiera** (§26.2 se cumple entero), y al volver **se le cobra normal en el ciclo
  siguiente**: el `next_payment_date` que el proveedor ya tiene corrido. No se prorratea, no se
  recalcula, no se acredita nada.
- **Motivo: la aritmética se compensa sola, así que no hace falta mecanismo.** Lo que el cliente
  pierde del ciclo pagado y lo que gana del ciclo de vuelta **son el mismo número de días** cuando
  la pausa dura ciclos enteros, porque vuelve **el mismo día del mes** en que pausó. Pausa el 5/ene
  por dos meses: pierde 25 días de enero, vuelve el 5/mar, y el proveedor recién cobra el 1/abr —
  27 días sin pagar. Neto ≈ 0.
  - Contra **(A)**: resuelve con un mecanismo lo que (C) resuelve con una restricción, y le niega
    al cliente parar cuando quiere parar. Además su cron **tiene que ganarle al cobro del
    proveedor**, cuyo instante exacto no es predecible —en producción el cobro llegó ~26 min tarde
    (`PA-3`), y el reloj de sandbox seguía sin cobrar 31 min después de su fecha—, así que exigía
    un margen de 24 h que ya le costaba un día al cliente.
  - Contra **(B)**: obliga a mantener a propósito una fecha nuestra distinta de la del proveedor,
    que es exactamente la clase de desfasaje que alguien viene a "arreglar" después.
  - **El caso que (C) tenía que resolver, y resuelve**: la pausa que empieza y termina **dentro del
    mismo ciclo** era indefendible —pagó el 1, pausó el 5, volvió el 25: recibió 11 días de los 30
    que pagó y el 1/feb le cobran el mes completo igual, o sea **pausar le salió estrictamente peor
    que no pausar**—. Con el mínimo de un mes, esa pausa no existe.
- **Implicaciones**:
  1. **El early resume no perjudica nunca al cliente, porque el cobro es POR ADELANTADO.** Lo que
     se cobra el 1/mar es marzo entero, que va a usar: volver antes de tiempo no le hace pagar
     servicio que no recibe, sólo le da los días que van de la reanudación al próximo cobro
     **gratis**. Lo único que pierde es lo que ya estaba decidido: los días del ciclo en curso en
     que estuvo pausado. **Al reanudar se le muestra UNA cosa: qué día se le va a cobrar.** No se
     le habla de días perdidos ni se le explica la compensación — no hay nada que compensar desde
     su lado, y contarlo sólo inventa un problema. Decisión explícita del owner.
  2. **El reloj de fin de pausa es nuestro** (`PS-4`), y reanudar es un `PUT {status:"authorized"}`
     que no cobra nada (`PS-5`). El mismo scheduler sirve para el auto-resume y para el early
     resume.
  3. **Todo cambio pedido durante la pausa se aplica DESPUÉS de reanudar**: estando pausada el
     proveedor rechaza cualquier modificación (`EX-11`), incluso un cambio de precio. Un aumento
     que caiga sobre un pausado (`DEC-MP-002`) no se puede aplicar hasta que vuelva.
  4. Los límites del §26.3 **se reexpresan en meses**: 120 días son 4 pausas-mes y 240 son 8.
  5. Los meses no miden lo mismo: pausar un 31/ene y volver un 28/feb deja 3 días de ruido en la
     compensación. Se acepta.
- **Condicionada a una medición en curso**: que la fecha corra **+1 ciclo por vencimiento
  indefinidamente** está medido **una sola vez**, con ciclo diario y **un** vencimiento. Toda la
  aritmética de arriba lo necesita en el vencimiento 2 y 3 — si el proveedor dejara de correrla, o
  la recalculara al reanudar, el cliente vuelve el 5/mar y le cobran enseguida. El sujeto
  `pausa-real` quedó **pausado el 2026-09-16 12:16 `-03` con `next` en el 17** para responderlo
  leyéndolo el 17, 18 y 19. **Si esa lectura desmiente el corrimiento, esta decisión se reabre.**
- **Origen**: punto 10 del contraste PDR ↔ proveedor · §26.2 · §26.4 · `BD-MP-01`.

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | **40** |
| De metodología | 3 |
| Funcionales | 37 |
| | Recontadas el 2026-09-16 leyendo los encabezados, no a mano: la tabla venía arrastrando **un error de uno** desde antes de esta sesión. La plantilla del formato (`### DEC-<AREA>-<NNN>`) no es una decisión y no se cuenta |
| `SUPERSEDED` | **2** — `DEC-SUB-001` por `DEC-SUB-005`, y `DEC-SUB-005` por `DEC-SUB-006` |
| **Preguntas del owner abiertas** | **0 de 25** |
| Bloqueantes de FASE 2 que decide el owner | **8 de 8 cerradas** |
| Bloqueantes de FASE 2 que decide el experimento | **1 abierta** — `BD-MP-02` (cortesía). `BD-MP-01` (pausa) la cerró `DEC-SUB-010` con el reloj leído; `BD-MP-03` la cerró `DEC-MP-001`; `BD-MP-04` tiene sus filas medidas pero **le sobrevivió una elección de diseño** |
| Decisiones condicionadas a FASE 1C | **1** — `DEC-SUB-010`, a la segunda lectura del reloj (¿la fecha corre +1 ciclo por vencimiento **indefinidamente**, o sólo la primera vez?) |
| | `DEC-SUB-006` y `DEC-SUB-007` **se destrabaron el 2026-09-16**: `EX-33` quedó `VERIFIED` en **producción con tarjeta real**, medido tres veces sobre el mismo pagador. El checkout respeta la fecha de primer cobro futura, así que el cliente que cambia de ciclo no paga dos veces. ⚠️ Pero la medición trajo `EX-38` de arriba: el proveedor **convierte esa fecha en un free trial** y se lo anuncia al cliente como «Tu prueba gratis comenzó». El mecanismo funciona; **lo que hay que resolver es qué le decimos nosotros a alguien a quien el proveedor acaba de anunciarle una prueba gratis sobre días que ya pagó** |
| Apartamientos declarados del PDR | 3 — `DEC-ENT-001` (§10.3), `DEC-GRANT-002` (§34), y el `SUSPENDED` doble de `M-ARCH-01` |
