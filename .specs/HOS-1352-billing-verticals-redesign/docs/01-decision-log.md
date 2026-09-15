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

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | **28** |
| De metodología | 3 |
| Funcionales | 25 |
| `SUPERSEDED` | 0 |
| **Preguntas del owner abiertas** | **0 de 25** |
| Bloqueantes de FASE 2 que decide el owner | **8 de 8 cerradas** |
| Bloqueantes de FASE 2 que decide el experimento | **4 abiertas** — esperan FASE 1C |
| Decisiones condicionadas a FASE 1C | 1 — `DEC-SUB-001`, depende de `EX-7`/`EX-8` |
| Apartamientos declarados del PDR | 3 — `DEC-ENT-001` (§10.3), `DEC-GRANT-002` (§34), y el `SUSPENDED` doble de `M-ARCH-01` |
