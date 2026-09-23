---
title: Decision Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-21
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

### DEC-METH-004 — La FASE 9 tiene cuatro salidas, y «resuelto» exige verificar la regla contra todo su dominio

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: son dos, y se descubrieron juntos al cerrar la FASE 8 con **141 hallazgos, 48 de
  ellos `CRITICA`**.
  1. **El §65 manda actualizar cuatro documentos** —decision log, spec, handoff y worklog— y el
     programa ya no vive sólo ahí. El 2026-09-18 el desarme publicó **25 issues de Linear** (el
     paraguas, las dos épicas, las nueve unidades de verticales y las trece de billing) y **unos
     27 artifacts**, todos escritos contra un modelo que estos hallazgos acaban de mover. Nadie
     era dueño de propagarles el cambio (`F-8C2-011`).
  2. **El programa no declara qué significa «resuelto»** para un hallazgo de FASE 8
     (`F-8C2-016`). Sin eso la fase no tiene criterio de cierre — y ahora tampoco de propagación,
     porque no se sabe qué dispara una actualización hacia lo publicado.
- **Alternativas para «resuelto»**: (1) el capítulo dice qué pasa en todos los casos del hallazgo
  —el criterio que el programa ya usa para los huecos—; (2) lo anterior **y** el camino del
  hallazgo, reejecutado sobre el texto corregido, ya no llega; (3) el (2) para los hallazgos
  sueltos, y para cada racimo **además** verificar la regla corregida contra **todo el dominio que
  cuantifica**.
- **Decisión**: **(3)**, y la FASE 9 cierra **cuatro** salidas, no una.
- **Las cuatro salidas**:
  1. **el diseño** — resolver los seis racimos en los capítulos de las dos épicas y del núcleo;
  2. **el registro** — decision log, handoff, worklog, más las seis correcciones de registro de la
     §7 de [`14-fase-8-adversarial/00-hallazgos.md`](./14-fase-8-adversarial/00-hallazgos.md);
  3. **las sub-specs** — `spec.md` y `descomposicion.md` de `HOS-1353` y `HOS-1354`;
  4. **lo publicado** — los 25 issues de Linear y los artifacts.
- **El orden no es libre: 3 y 4 van al final**, con el diseño ya firme. Propagar mientras la fase
  todavía resuelve racimos significa propagar dos veces sobre 52 objetos, y varios racimos cruzan
  las dos épicas — `R2` toca unidades de las dos, `R1` toca cuatro unidades de billing y sus
  fichas. No hay forma de propagar bien antes de saber cómo quedó cada racimo.
- **Motivo de elegir (3) y no (1) ni (2)**: **(1) es el criterio que produjo la causa raíz.** La
  FASE 8 encontró que las cuatro convergencias son contradicciones **entre dos capítulos, nunca
  dentro de uno**, y que el método cierra huecos *por capítulo* — lo que comprueba que un capítulo
  cubre sus casos, nunca que una regla cubra los suyos, porque los suyos viven en otros capítulos.
  Cerrar con (1) deja viva exactamente la máquina que produjo los 141. **(2) arregla el caso que
  el agente encontró y no el resto del dominio de la regla.** (3) cuesta **seis** verificaciones
  de dominio, no 141, porque se aplica al racimo y no al hallazgo.
- **Implicaciones**:
  1. **Cada racimo tiene que declarar cuál es su dominio**, por escrito. Hoy no está en ningún
     lado, y sin eso el criterio (3) no es ejecutable.
  2. **Un hallazgo no se cierra marcándolo**: se cierra reejecutando su camino sobre el texto
     nuevo. El camino está escrito en cada uno de los 141, que es lo que lo vuelve verificable.
  3. **Esto es un apartamiento declarado del §65**, no una corrección del PDR. El PDR no se edita
     (regla 1): la ampliación vive acá.
  4. Las seis correcciones de registro **siguen sin aplicar** hasta que la FASE 9 las tome. Están
     inventariadas y verificadas, no ejecutadas.
- **Origen**: conversación con el owner del 2026-09-19 al cerrar la FASE 8 — *«la fase 9 debería
  también actualizar las issues y las sub spec y los artifacts»*—, más `F-8C2-011` y `F-8C2-016`.

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

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED EN PARTE por `DEC-MIG-003`** (2026-09-19) ·
  **Decide**: owner
- **⚠️ Qué sobrevive y qué no**: sobrevive **cero código de migración**, que era su núcleo, y
  sobrevive entera la medición que la apoya. **Lo que se cae es el destino**: ya no se transcribe
  ninguna fila al sistema nuevo. `DEC-MIG-003` lo decidió el 2026-09-19 con un dato que no existía
  acá —de quién son las ocho filas—, y las *«cinco relaciones»* de este título pasaron a ser ocho
  por las altas que `DEC-MIG-002` dejó entrar.
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

### DEC-GRANT-003 — La cortesía temporal se implementa PAUSANDO la suscripción en el proveedor, y el servicio lo sostenemos nosotros

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §34.2 pide **mantener el servicio sin cobrar** durante N días o meses, y es el
  único punto del PDR que ordena investigar antes de elegir: *«NO asumir implementación contra MP.
  Debe investigarse.»* El proveedor no tiene nada parecido a «no le cobres a este durante N ciclos».
- **Contexto medido**:
  - `PC-2` **`VERIFIED`**: el piso es **ARS 15**. Cobrar cero devuelve `400`. **«Gratis» no existe
    bajando el monto**, y no es teórico: `CT-1` lo confirmó el 2026-09-16 sobre una suscripción que
    ya había cobrado — `cortesia-piso` cobró 2000 en su primer ciclo, se lo bajó al piso, y en la
    renovación **cobró ARS 15**.
  - `EX-35` **`NOT_SUPPORTED`** (2026-09-16): **no se le puede poner un `free_trial` a una
    suscripción viva**. Dos formas, dos `200`, `free_trial` siguió `null`, `last_modified`
    congelado. Con control: el monto sobre el mismo objeto entró y movió `last_modified`.
  - `EX-34` **`NOT_SUPPORTED`** (2026-09-16): **tampoco se le puede correr la fecha de cobro.**
    Cuatro formas, cuatro `200`, nada escrito.
  - `PS-2` **`VERIFIED`** en **producción**: **pausada NO cobra.**
  - `PS-5` **`VERIFIED`** (2026-09-16): reanudar es un `PUT {status:"authorized"}` que cambia sólo
    el estado — no dispara cobro de recuperación ni deja deuda.
  - `EX-11` **`VERIFIED`**: estando pausada **no se puede modificar nada** (`400` explícito), pero
    **sí cancelar**.
  - `CT-3` **`VERIFIED`**: todo cambio de monto le dispara al pagador un correo del proveedor que
    dice **«El vendedor Hospeda cambió el monto»**, y `EX-15` midió que esa mutación **no emite
    webhook**: le avisa al cliente y no a nosotros.
  - `PA-5` + `EX-3`: cancelar es **irreversible**, y su correo **insinúa mora**.
- **Contexto externo** (contraste, no fundamento): los proveedores maduros lo tienen resuelto
  adentro. Stripe expone `pause_collection` con tres comportamientos (`void`, `keep_as_draft`,
  `mark_uncollectible`) y su documentación dice explícitamente que se usa **«para ofrecer
  temporalmente tu servicio gratis»**. Mercado Pago ofrece **tres operaciones y ninguna más**:
  pausar, cancelar, modificar monto. No existe saltear un cobro ni cobrar cero.
- **Alternativas**: (A) **pausar en el proveedor durante la cortesía y sostener el servicio de
  nuestro lado**; (B) cancelar y que el beneficiario se re-suscriba al terminar; (C) bajar el monto
  al piso durante la cortesía.
- **Decisión**: **(A)**.
- **Motivo, por los dos criterios del owner.**
  - **Toca plata o no toca plata**: (A) es la única que **no mueve un peso en ninguna dirección**.
    (C) le **cobra ARS 15 por ciclo a alguien a quien le dijimos que no pagaba**. (B) no cobra, pero
    pone una barrera de checkout al final de un regalo.
  - **Hacia dónde falla cada una**: (A) falla **regalando más días de los debidos**, y se corrige
    reanudando. (B) falla **perdiendo al cliente** —cancelar es irreversible y al final hay que
    reconquistarlo en el checkout, justo a quien quisimos premiar—. (C) falla **cobrándole** al
    beneficiario.
  - Y (A) **no cuesta código nuevo**: el reloj que pausa y reanuda hay que construirlo igual por
    `DEC-SUB-010`. La cortesía es otro motivo para el mismo mecanismo, no un mecanismo más.
- **Implicaciones**:
  1. **Durante la cortesía la suscripción queda congelada en el proveedor** (`EX-11`): no se le
     puede aplicar un upgrade, ni un cambio de precio de `DEC-MP-002`, ni un cambio de tarjeta. Lo
     que se pida en ese período **se encola y se aplica al reanudar**, o se reanuda primero y se
     rehace la cortesía. No hay una tercera opción: el proveedor devuelve `400`.
  2. **En el proveedor una cortesía se ve IDÉNTICA a una pausa pedida por el cliente.** La
     distinción existe sólo en nuestra base, y el reloj que reanuda **tiene que saber por qué está
     pausada**: si lee sólo el estado de MP, reanuda la cortesía de alguien que había pedido pausa,
     o al revés.
  3. **La precedencia** entre una cortesía vigente y una pausa pedida por el cliente —y entre una
     cortesía y otra— quedó como residuo, y **la cerró `DEC-GRANT-004`** el mismo día.
  4. **El §34.1 no toca al proveedor**: durante el trial, la cortesía extiende el trial, que es
     nuestro. Son dos implementaciones según el estado del beneficiario.
  5. **La cortesía PERMANENTE sigue cancelando** (§35.3 y `DEC-GRANT-001`), y la asimetría es
     deliberada: cancelar es irreversible, así que sirve para lo que no termina y no para lo que sí.
  6. Lo que `PS-6` mide —que el ciclo vencido en pausa se pierde— **acá no aplica**: durante la
     cortesía el servicio lo damos igual, que es el punto.
- **Pendiente de medir, y no bloquea**: **si el proveedor le manda algún correo al cliente cuando
  pausamos su suscripción.** Si le llega un «tu suscripción fue pausada» en medio de un regalo, hay
  que anticiparlo (`DEC-MAIL-001`: los correos del proveedor se anticipan, no se desmienten).
- **Origen**: punto 11 del contraste PDR ↔ proveedor · §34.2 · `BD-MP-02`.

### DEC-GRANT-004 — Cortesía y pausa se resuelven con validaciones nuestras: pausar cancela la cortesía avisando, y sobre una pausa no se otorga

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: residuo que dejó abierto `DEC-GRANT-003`. La cortesía y la pausa del cliente
  **usan el mismo mecanismo** —pausar en el proveedor—, así que se pisan. Hay tres cruces:
  un cliente en cortesía que pide pausar, un cliente pausado que recibe una cortesía, y una
  cortesía que cae sobre otra.
- **Contexto medido**: `DEC-GRANT-003` + `EX-11`. En el proveedor **una cortesía se ve idéntica a
  una pausa pedida por el cliente**: es el mismo `status: "paused"`, y `EX-11` midió que estando
  pausada no se puede modificar nada. **No hay ningún campo del proveedor que distinga una de la
  otra**, así que preguntarle a él por qué está pausada no es una opción — la intención es nuestra
  o no existe.
- **Decisión**: los tres cruces se resuelven **de nuestro lado, con validaciones, prohibiciones y
  avisos**, sin pedirle nada al proveedor.
  1. **En cortesía, pide pausar** → **se le permite**, avisándole explícitamente que **pierde la
     cortesía que le quedaba**, y elige. Si acepta, el grant se cancela y queda una pausa normal.
  2. **En pausa, el super admin intenta otorgar cortesía** → **se bloquea**, avisando que la
     suscripción está pausada.
  3. **Cortesía sobre cortesía** → **se SUMAN los días, no se reemplazan**, y el aviso dice la
     **fecha de fin nueva**, no «un mes más».
- **Motivo**:
  - **(1) es la opción menos compleja, y esa es la razón.** La alternativa evaluada —prohibir
    pausar durante la cortesía y ofrecer una **pausa programada** para cuando termine— protege
    mejor al cliente, pero **introduce un mecanismo que `DEC-SUB-010` ya había descartado**: ahí se
    decidió que la pausa empieza cuando el cliente la pide, sin diferir nada. Traerla de vuelta por
    la puerta de atrás, para un caso de borde, no se paga.
    - Queda **declarado el costo**: durante la cortesía el cliente **no está pagando**, así que
      pausar no le ahorra un peso — sólo le quita servicio. Es la misma operación sin sentido
      económico que `DEC-SUB-010` eliminó para la pausa intra-ciclo. **Por eso el aviso importa
      más que la validación**: es lo único que lo protege de tomar una decisión que sólo lo
      perjudica.
  - **(2)**: regalarle meses a alguien que no está pagando **no le regala nada** — la cortesía se
    consumiría contra un período sin cobro. Bloquear y avisar deja el error del lado visible.
  - **(3) se suman** porque reemplazar es **destructivo y silencioso**: un super admin que otorga un
    mes a alguien que tenía seis se los saca sin que nada en la operación lo insinúe. Sumar es
    además lo que menos sorprende —«le doy un mes» es un mes más— y encaja con el §35.4, que ya
    pide auditoría **por grant**: cada uno sobrevive entero en el registro y la fecha de fin es la
    consecuencia, no un dato que haya que reconstruir.
- **Implicaciones**:
  1. **El estado «pausada» de nuestra base necesita un motivo**, no sólo un booleano: pausa del
     cliente, cortesía, o —cuando lo midamos— el destino al que el proveedor manda una suscripción
     al agotar los reintentos. El reloj que reanuda lee ese motivo, nunca el estado del proveedor.
  2. **El aviso del caso (1) es parte de la decisión, no un adorno.** Sin él, el cliente pausa y
     descubre después que perdió el regalo.
  3. **Programar una cortesía para cuando el cliente reanude** se evaluó y **queda fuera** por la
     misma razón de simplicidad. Si más adelante aparece la necesidad, es un agregado, no un
     rediseño.
- **Origen**: residuo de `DEC-GRANT-003` · §34.2 · §35.4 · §26.

### DEC-ADDON-002 — Cada addon recurrente es un preapproval aparte, no una línea del monto del plan

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §38 define dos tipos de addon, *«one-time; **recurrent**»*, y `EX-5` midió que
  **una autorización del proveedor cubre un solo monto**. Quedaban dos mecanismos posibles, y
  **los dos funcionan** — por eso `BD-MP-04` estaba mal clasificada como «la decide el
  experimento»: la medición cerró la pregunta técnica y dejó viva una elección de diseño.
- **Contexto medido**:
  - `EX-5` **`NOT_SUPPORTED`**: `auto_recurring` como array da `400`, y el campo `items` devuelve
    `201` y **se descarta en silencio**. Un addon **no puede ser una línea aparte dentro de la
    suscripción del plan**.
  - `EX-6` **`VERIFIED`**: **dos suscripciones autorizadas del mismo pagador conviven** sin
    conflicto. Verificado con seis a la vez, en producción.
  - `PC-1` / `PC-3` **`VERIFIED`**: el monto de una autorizada se muta sin re-consentimiento.
  - **`EX-36`** (2026-09-16): el medio de pago se cambia **por preapproval**, y ese cambio **cobra
    una validación de ARS 0 que puede fallar**.
  - **`EX-37`** (2026-09-16): el `init_point` que entrega la API **viene roto**.
  - **`EX-34`** (2026-09-16): la fecha de una suscripción viva **es inmutable**.
- **Contexto externo** (contraste, no fundamento): existe un PR previo en el repo —
  [#3236, «provision MercadoPago preapproval plans for recurring add-ons»](https://github.com/qazuor/hospeda/pull/3236),
  detrás de un flag—. **No se leyó y no se usa como fundamento** (§4, `DEC-METH-001`); se anota
  para FASE 5, que es donde se contrasta contra lo existente.
- **Alternativas**: (1) **subir el monto de la suscripción del plan** por cada addon contratado;
  (2) **un preapproval aparte por cada addon recurrente**.
- **Decisión**: **(2)**.
- **Motivo, por los dos criterios del owner.**
  - **Toca plata o no toca plata**: **(1) toca plata cada vez que alguien contrata o da de baja un
    addon**, porque cada alta y cada baja es una mutación del monto del plan — **el punto exacto
    donde este proveedor ya demostró nueve veces que acepta sin aplicar**. Ahí el fallo silencioso
    **cobra de menos o de más y nadie se entera**, porque `EX-15` midió que mutar el monto **no
    emite webhook**. **(2) no toca plata nunca**: contratar es crear, dar de baja es cancelar.
  - **Hacia dónde falla**: (2) falla hacia **un addon que no se cobra** — visible y recuperable.
    (1) falla hacia **cobrar mal el plan entero**.
  - Y hay un argumento estructural que no depende de los fallos: con (1) **un addon con ciclo
    propio no existe** —queda obligado al del plan, así que un addon mensual sobre un plan anual
    es imposible— y el §40 define scopes (`LISTING`, `VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`)
    que el §41 exige **poder cancelar por separado**. Con (1) el importe cobrado tampoco dice qué
    lo compone: hay que derivarlo del estado local.
- **Implicaciones**:
  1. **Contratar un addon pasa por el checkout.** El costo que el análisis previo había anotado
     —«le pide el código de seguridad al cliente»— **ya no aplica**: `DEC-SUB-006` movió la
     re-autorización al checkout, así que no se tokeniza del lado del servidor. Es más visible
     para el cliente, pero no manejamos datos de tarjeta.
  2. **Y por lo tanto `EX-37` alcanza a cada addon**: cada contratación necesita un `init_point`,
     que **viene roto**. Es un call site más para el guard que sanea el link — no uno nuevo, pero
     sí más superficie.
  3. **Un cambio de tarjeta son N actualizaciones, no una** (`EX-36`), cada una con su validación
     de ARS 0 que **puede fallar por separado**. Si falla en algunas y en otras no, el cliente
     queda con **parte de sus addons cobrando y parte no**: es un estado parcial que hay que
     reconciliar, y es un caso real porque a la gente se le vence la tarjeta. Lo que lo hace
     manejable es que **cada preapproval se lee solo**, así que el estado parcial es detectable.
  4. **El ciclo del addon se alinea al del plan sólo AL CREARLO** (`EX-34`). Después no se corrige.
  5. **El resumen de la tarjeta muestra un cargo por el plan y otro por cada addon.** Es lo que
     hace que cada cobro se explique solo en la conciliación, y a la vez lo que el cliente ve.
  6. **Cancelar el plan NO cancela los addons**: esa orquestación es nuestra, y es exactamente lo
     que el §41 pide poder hacer al revés (cancelar un addon huérfano sin tocar lo demás).
- **Origen**: `BD-MP-04` · §38 · §40 · §41. **Era el último bloqueante de FASE 2.**

### DEC-ARCH-003 — Los dos `SUSPENDED` del PDR se separan: el del trial se llama `TRIAL_EXPIRED`

- **Fecha**: 2026-09-17 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR usa la palabra `SUSPENDED` para dos situaciones que no se comportan igual.
  El §10.6 la usa para el trial que venció sin que la persona se suscribiera
  (`TRIAL_ACTIVE -> SUSPENDED`), y el §20/§21 para el pago que falló y agotó su grace
  (`GRACE_PERIOD -> SUSPENDED`). El §63 pide modelar explícitamente los estados y las
  transiciones de ocho máquinas, y dos situaciones distintas bajo un mismo nombre no se pueden
  modelar: cualquier transición que se escriba sobre `SUSPENDED` es ambigua.
- **Las tres diferencias, que es lo que impide compartir nombre**:

  | | trial vencido | impago tras el grace |
  |---|---|---|
  | ¿hubo dinero de por medio? | no, nunca pagó | sí, y quedó un cobro sin entrar |
  | campaña de recuperación del §10.7 (+1, +5, +15, +30, +60) | **sí** — el §10.7 la define para este caso | **no** — el §10.7 habla de *«Recovery post-trial»* |
  | qué le falta para volver | suscribirse por primera vez | regularizar un pago |

- **Alternativas**: (1) separarlos en dos estados con nombres distintos; (2) un solo
  `SUSPENDED` con un campo `motivo`; (3) dejarlo como está y que cada consumidor deduzca cuál
  es por el contexto.
- **Decisión**: **(1)**. El del §10.6 se llama **`TRIAL_EXPIRED`** y el del §20/§21 conserva
  **`SUSPENDED`**.
- **Motivo**: es la única que hace que las transiciones del §63 sean escribibles sin ambigüedad.
  La (2) mueve el problema a un campo que hay que acordarse de mirar —y `DEC-GRANT-004` ya
  obligó a un motivo para `PAUSED`, donde sí hace falta porque el proveedor no distingue; acá
  la distinción es nuestra desde el origen y no hay razón para diferirla a un campo—. La (3) es
  el estado de cosas que el §1 nombra entre las causas de este programa.
- **Implicaciones**:
  1. **Apartamiento declarado del §10.6**, que escribe `SUSPENDED`. El PDR no se edita (§3.1):
     queda registrado acá. Es el **tercero** del programa, y ya estaba anticipado como tal en el
     resumen de este log antes de tener ID propio.
  2. **Las consecuencias del §21 valen para los dos por igual** —sin listado público, sin
     edición, sin creación, sin entitlements comerciales, datos conservados, Mi Cuenta en sólo
     lectura, billing accesible, recuperación posible—. Lo que cambia es la comunicación, no el
     acceso.
  3. **El reloj de retención del §25 arranca igual en los dos**: el §25 dice *«desde que queda
     efectivamente inactiva»* y las dos situaciones lo son. Rige `DEC-DATA-001` sin cambios.
  4. La campaña del §10.7 se dispara **sólo** desde `TRIAL_EXPIRED`. Qué pasa si la campaña ya
     se disparó y después el trial se extiende sigue abierto (`E-TRIAL-03`, capítulo 11).
- **Origen**: `M-ARCH-01` · §10.6 · §20 · §21 · §63. Cerrado por el capítulo 01 de la Master
  Spec; el nombre lo aprobó el owner el 2026-09-17.

### DEC-OBS-001 — `RECONCILIATION_REQUIRED` avisa por un listado accionable y un correo AGREGADO, no uno por evento

- **Fecha**: 2026-09-17 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el §22.1 ordena, **siempre** que el sistema llegue a ese estado, cinco cosas — y
  la tercera es *«enviar email a `SUPER_ADMIN`»*, sin condición ni agrupamiento. Un incidente de
  webhooks genera cientos de eventos idénticos: con un correo por evento, **el canal deja de
  leerse justo cuando importa**. El requisito real lo enuncia el propio §22.1 al cerrar: *«El
  objetivo es que SUPER_ADMIN esté al tanto y pueda intervenir»*.
- **Alternativas**: (1) listado accionable en Admin como canal primario más un correo **agregado**
  con ventana de frecuencia; (2) un correo por evento, tal como lo escribe el §22.1; (3) sólo el
  listado, sin correo.
- **Decisión**: **(1)**.
  - **Canal primario**: el listado accionable en Admin — que el §22.1 **ya contempla** en su
    cuarto punto.
  - **El correo es agregado**: un resumen cada N minutos con el conteo por tipo y los sujetos
    afectados. `N` es configuración (§9).
  - **Excepción**: un evento **único y grave** —un doble cobro real detectado, un reembolso que
    falló sobre una revocación— manda **su propio correo**, sin esperar la ventana.
  - **La agrupación es por tipo + sujeto**, así que cientos de eventos de un mismo incidente
    colapsan en una línea con su conteo.
  - **Lo que NUNCA se agrupa es el registro**: el evento crítico se escribe uno por uno, siempre.
    Lo que se agrupa es el aviso.
- **Motivo**: cumple el objetivo que el §22.1 enuncia sin el modo de falla que su letra produce.
  La (2) es la que apaga el canal. La (3) incumple el §22.1 sin compensarlo con nada: si nadie
  mira el Admin ese día, nadie se entera.
- **Implicaciones**:
  1. **Apartamiento declarado del §22.1**, que dice *«enviar email a `SUPER_ADMIN`»* sin
     condición. El PDR no se edita (§3.1): queda registrado acá. Es el **cuarto** apartamiento del
     programa.
  2. **Los otros cuatro puntos del §22.1 se cumplen literalmente**: evento crítico registrado,
     información suficiente para investigar, alerta en Admin, y cero decisiones destructivas
     automáticas.
  3. **La ventana de agregación es un riesgo declarado**: entre que ocurre el primer evento y sale
     el resumen pasan hasta `N` minutos. Para el caso que no puede esperar está la excepción, y
     **qué eventos entran en esa excepción es una lista cerrada** que el capítulo 08 declara.
  4. Se cruza con la jerarquía de supresión del capítulo 07: este correo es **transaccional no
     suprimible**, y un rebote duro sobre él se escala como no entregable.
- **Origen**: `R-OBS-01`, `S-OBS-01` · §22.1 · §50. Cerrado por el capítulo 08 de la Master Spec.

---

### DEC-ARCH-004 — El billing se implementa de nuestro lado, en un package propio de Hospeda, con la pasarela detrás de un adaptador

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: tres días de medición contra Mercado Pago dejaron dos cosas a la vista. La
  primera, que **de las ocho capacidades del capítulo 06 ya traíamos cinco de nuestro lado** —el
  reloj de la pausa, el candado contra el doble cobro, el inventario a conciliar, la
  compensación de días y la baja a fin de período—, no por desconfianza sino porque el proveedor
  no las tiene o las tiene de una forma que no sirve. La segunda, que el reparto actual entre
  `qzpay` y Hospeda **no tiene una frontera**: son **seis repartos distintos sobre las mismas 27
  tablas y ninguno coincide** (`F-1B-132`), con el DDL escrito por Hospeda y los modelos Drizzle
  definidos por `qzpay`. Encima, la evaluación de reemplazo abierta el 2026-09-17 puso sobre la
  mesa una pregunta que el diseño actual no sabe contestar: **qué cuesta cambiar de pasarela**.
- **Las cifras que sostienen la decisión**, todas medidas:

  | | |
  |---|---|
  | capacidades que ya resolvíamos nosotros | **5 de 8** |
  | decisiones acopladas a una fila medida del proveedor | **20 de 46** (43 %) |
  | capítulos de la Master Spec que citan una medición | **13 de 21**, y **41 de las citas viven en el capítulo 06** |
  | tamaño de `qzpay` | **~62.500 líneas** en 9 paquetes |
  | cuánto de su motor usa Hospeda | **6 de 261 símbolos**; 12 de 16 servicios en cero; 4 namespaces en cero |
  | otros consumidores de `qzpay` | **ninguno** — sólo worktrees de Hospeda |
  | dirección de la dependencia | **19 FK** hospeda→qzpay, **0** al revés |
  | crons que ya se saltean la abstracción | **7 de 17**, con el motivo escrito en el código |

- **Alternativas**: (1) seguir con `qzpay` como paquete externo y mejorar su frontera;
  (2) traer el billing adentro de Hospeda, en un package propio, con la pasarela detrás de un
  adaptador; (3) acoplarse a la pasarela elegida y aceptar que cambiarla sea una reescritura.
- **Decisión**: **(2)**, con cinco definiciones del owner y dos condiciones que las hacen
  exigibles:
  1. **Se implementa de nuestro lado todo lo que se pueda**, para depender de la pasarela lo
     mínimo posible. Al proveedor se le pide cobrar, reembolsar, leer y avisar — el ciclo de
     vida es nuestro.
  2. **`qzpay` se absorbe.** Deja de ser un paquete externo.
  3. **Un package del monorepo concentra el dominio de billing**, y **ninguna otra parte de
     Hospeda habla con la pasarela directamente**.
  4. **Ese package expone una API definida por lo que Hospeda necesita**, no por lo que una
     pasarela ofrece — que es lo que el capítulo 06 ya hizo con las ocho capacidades.
  5. **Adentro es un adaptador intercambiable**: cambiar de pasarela cambia el adaptador, no la
     API ni el código que la consume.
  6. **Condición A — un guard estático** que prohíba importar el SDK de la pasarela fuera del
     adaptador. Es lo único que convierte «no lo hagas» en «no se puede».
  7. **Condición B — un adaptador falso, en memoria, desde el día uno**, que implemente la misma
     interfaz. Sirve para testear sin red y, sobre todo, **es lo que prueba que la abstracción no
     miente**: si no se puede escribir sin filtrar conceptos de Mercado Pago, la interfaz está
     mal definida.
- **Motivo**: un paquete externo se justifica por reuso, y **no hay reuso**: `qzpay` existe sólo
  para Hospeda, que además usa el 2 % de su motor. Estamos pagando el precio de una frontera sin
  cobrar ningún beneficio, y la frontera está rota de una forma medida y no accidental. La (1)
  conserva ese precio. La (3) es la que nos trajo hasta acá: es la razón por la que tres días de
  medición sobre un proveedor pusieron en duda meses de diseño.
- **Lo que esta decisión NO afirma**: que las pasarelas sean intercambiables. **No lo son.** El
  modelo de datos difiere de verdad —en Mobbex una suscripción es una plantilla con muchos
  suscriptores; en Mercado Pago un `preapproval` **es** un cliente—, y lo que el proveedor le
  escribe al cliente por su cuenta (`EX-3`), sus tiempos de acreditación y sus comisiones no se
  abstraen. Por eso la API **no expone el mínimo común denominador**: para cada capacidad, el
  diseño declara qué pasa cuando el proveedor no la tiene —se emula de nuestro lado, se degrada,
  o se bloquea la función del producto—. Un adaptador que finge paridad es peor que ninguno,
  porque el código de arriba le cree.
- **El riesgo, declarado**: esta decisión **traslada el riesgo hacia nosotros**. Hoy, si un cobro
  sale mal, es problema del proveedor. Con el ciclo de vida de nuestro lado, **un doble cobro es
  nuestro bug y es plata de un cliente real** — y está medido que ni Mercado Pago (`EX-17`) ni
  Mobbex ofrecen idempotencia en la creación, así que el candado es nuestro y va **antes** de
  llamar al proveedor (`DEC-CONC-001`). Se acepta el trade por dos razones: un bug nuestro se
  arregla y uno del proveedor no, y **nadie puede testear lo que no controla** — hoy el e2e de
  billing corre contra un stub de Mercado Pago que, por construcción, no puede detectar
  divergencias con el proveedor real.
- **Implicaciones**:
  1. **El package no es un wrapper de pasarela: es el dominio de billing entero.** Adentro viven
     el reloj de la pausa, el dunning, los reintentos, las cortesías y el candado contra el doble
     cobro. La pasarela queda como un detalle al fondo.
  2. **La FASE 5 cambia de contenido.** `qzpay` deja de ser material a clasificar en
     `KEEP`/`ADAPT`/`REWRITE` y pasa a absorberse. El gate de `DEC-METH-003` sigue rigiendo para
     el resto del código de billing de Hospeda.
  3. **Las 20 decisiones acopladas se revisan, no se reescriben.** En cada una la política
     sobrevive y lo que se revisa es la forma. Varias mejoran si el proveedor nuevo puede lo que
     Mercado Pago no: si se puede mutar el ciclo de una suscripción viva, `DEC-SUB-006` deja de
     necesitar el cancelar-y-recrear.
  4. **El capítulo 13 (Pagos), el único que falta, se escribe con esta decisión puesta.** Era la
     razón por la que se había diferido.
  5. **Lo que se absorbe es mucho menos que 62.500 líneas**: el 2 % del motor que se usa, más los
     modelos de las 27 tablas cuyo DDL ya es de Hospeda. Lo que se descarta es lo que nunca se
     usó.
  6. **Los 7 crons que hoy construyen su propio adaptador se reescriben** — ya estaban condenados
     por decisión previa del owner, así que no es costo que agregue esta decisión.
- **Origen**: conversación con el owner del 2026-09-18, a partir del §57 del PDR (abstracción de
  proveedor), del capítulo 06 de la Master Spec (las ocho capacidades por dominio) y de la
  evaluación de proveedor abierta el 2026-09-17
  ([`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md)). **Es la primera decisión
  de arquitectura del programa que no sale de una medición sino de un criterio del owner**; las
  mediciones que la sostienen están citadas arriba, pero la elección es suya.

---

### DEC-ARCH-005 — El programa se parte en dos épicas autónomas: Verticales y Billing

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el programa entero quedó detenido por **una sola cosa**: no está decidida la
  pasarela. Mercado Pago niega el cobro a demanda con un `403` comercial y el candidato que sí lo
  documenta tiene el alta en revisión manual de KYC. **Ese bloqueo alcanza al dinero y no alcanza
  a las capacidades**: qué puede hacer una cuenta, qué publica cada vertical, cómo se agregan los
  limits y quién está autorizado a qué no necesitan saber con qué se cobra. Se estaba esperando
  por una razón que no aplicaba a la mitad del programa.
- **Las cifras que sostienen la decisión**:

  | | |
  |---|---|
  | capítulos escritos que **no citan ninguna medición** del proveedor | **8 de 21**, contados con `rg` el 2026-09-18 — y son casi exactamente la épica que arranca |
  | capítulos que son billing **sin una sola fisura** | **5** — `05`, `06`, `09`, `12`, `14` |
  | capítulos que son verticales enteros | **3** — `11`, `17`, `18` |
  | entidades del catálogo comercial **sin un solo campo de dinero** | **5 de 6** (cap. 02 §2.1) |
  | lugares distintos donde verticales necesita un hecho de billing | **4**, y los cuatro son **el mismo hecho** |
  | filas a migrar en Gastronomía, Experiencia y Partner | **cero**, y **cero pagos históricos** (cap. 21) |

- **Alternativas**: (1) esperar a que se decida la pasarela con el programa entero detenido;
  (2) partir en dos épicas autónomas; (3) arrancar la implementación completa en una sola épica
  con billing simulado adentro.
- **Decisión**: **(2)**, y con una precisión del owner que es la que le da forma: **las dos
  épicas son AUTÓNOMAS**. Cada una se lee y se desarrolla **sin que la otra esté terminada de
  definir**. No son dos vistas de un mismo documento: son dos specs que se sostienen solas.
  - **`HOS-1353` · Verticales** — capacidades, entitlements, limits y autorización. Arranca ya.
  - **`HOS-1354` · Billing** — cobro, suscripción y proveedor detrás de un adaptador. Espera.
  - **`HOS-1352`** queda como **paraguas** y deja de implementarse.
- **Por dónde pasa el corte**: **es el criterio del owner —*«toca plata o no toca plata»*—**, y no
  hubo que inventarlo: el capítulo 15 ya lo había escrito al cerrar, separando su materia de la
  del 14 con las palabras exactas — *«acá se agregan **capacidades**, allá se compone **dinero**»*.
- **Y pasa POR DENTRO del catálogo de planes, no por afuera.** Es el punto donde el reparto se
  equivoca si se hace por nombre: «plan» suena a billing y no lo es. De las seis entidades del
  catálogo comercial, **cinco no tienen un solo campo de dinero** — `vertical`, `plan`,
  `plan_version` (que guarda `rank`, vendible, días de grace, días de trial, permite pausa,
  hereda Turista VIP), `plan_version_entitlement` y `plan_version_limit`. **El precio vive en una
  sola tabla hoja, `billing_option`**, y el propio capítulo 02 lo dice: *«El precio cuelga de la
  versión, no del plan»*. **Eso es lo que vuelve independiente al trial**: deriva su plan del
  vendible de `rank` más alto y del más bajo, y las dos columnas están en `plan_version`, así que
  se resuelve entero sin que exista un precio en la base.
- **Motivo**: un bloqueo se respeta donde aplica, no donde alcanza por contagio. La (1) paga el
  costo de un bloqueo que sólo rige para la mitad del trabajo, y esa mitad no tiene siquiera deuda
  de datos que la justifique. La (3) mete el simulacro adentro de una épica sola, que es donde un
  simulacro se vuelve permanente sin que nadie lo note.
- **Lo que esta decisión NO afirma**: que las dos mitades no se toquen. Se tocan en **un** lugar,
  y ese lugar es compartido por definición — lo fija `DEC-ARCH-006`. **Autónomo no quiere decir
  incomunicado**: quiere decir que ninguna espera a la otra para avanzar.
- **El riesgo, declarado**: **dos specs autónomas duplican contenido y pueden divergir.** Es el
  modo de falla que este programa ya tiene medido —seis repartos sobre las mismas 27 tablas y
  ninguno coincide (`F-1B-132`)— y se acota de dos formas: la frontera tiene **una sola fuente**
  (`DEC-ARCH-006`) que ninguna de las dos puede mutar sola, y lo transversal —glosario, el
  criterio Eje 1 / Eje 2, outbox, auditoría— queda en un núcleo común que las dos citan sin
  copiar.
- **Implicaciones**:
  1. **Los interiores se escriben autónomos; la frontera no.** Cada spec absorbe el diseño de sus
     capítulos; el contrato de la frontera se cita, nunca se copia.
  2. **Queda pendiente qué pasa con la Master Spec.** El documento de partición escrito el
     2026-09-18 dice *«los capítulos no se reescriben ni se mueven»*, y eso era correcto cuando
     las specs sólo declaraban alcance. Con specs autónomas hay dos fuentes para lo mismo si los
     capítulos se quedan donde están **y** las specs los absorben. **Sin decidir, y es del owner.**
  3. **El reparto capítulo por capítulo** vive en
     [`11-particion-del-programa.md`](./11-particion-del-programa.md) §4.
- **Origen**: conversación con el owner del 2026-09-18, a partir del bloqueo de la evaluación de
  proveedor ([`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md)) y de
  `DEC-ARCH-004`. La autonomía de las dos épicas es una segunda precisión suya, del mismo día.

---

### DEC-ARCH-006 — La frontera entre las dos épicas es un contrato único con dos implementaciones desde el día uno

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ARCH-005` parte el programa, y eso sólo sirve si la épica de verticales
  **puede correr sin que exista la de billing**. El punto de contacto no es teórico: el paso 5 de
  la resolución de autorización (cap. 17 §1.2) pregunta *«¿tiene trial, suscripción, cortesía o
  grant que lo cubra?»*, y tres de esas cuatro fuentes son de billing.
- **Lo medido que lo hace posible**: verticales necesita de billing **un solo hecho**, que aparece
  en cuatro lugares y es siempre el mismo — el paso 5 de la autorización, la transición `PB2` de
  publicación (cap. 03 §9), la pérdida de beneficios de turista al suspender (cap. 15 §6) y el
  disparador del recálculo del conjunto efectivo (cap. 02 §3.2 · cap. 15 §4.2). **Nada más cruza
  la frontera**: ni montos, ni estados de pago, ni ids del proveedor, ni fechas de cobro.
- **Y el contrato no depende de la pregunta que billing tiene abierta.** Esté el reloj de cobro de
  nuestro lado o del proveedor —lo que decidirá el capítulo 13—, en los dos mundos hay un título
  con un estado y una fecha hasta la cual cubre. **Se puede definir hoy sin prejuzgar el 13.**
- **Decisión**: **un contrato único, con dos implementaciones desde el día uno.**
  1. **El contrato es de la frontera, no de una épica.** Vive en el programa, las dos specs lo
     citan, y **ninguna de las dos puede mutarlo sola**. Una copia que billing pudiera tocar sin
     que verticales se entere es `F-1B-132` otra vez.
  2. **Lo que verticales declara es lo que necesita, no el package ajeno.** Verticales no depende
     de un `@repo/billing`: depende de un contrato que billing satisface. Es el punto 4 de
     `DEC-ARCH-004` —*«expone una API definida por lo que Hospeda necesita»*— aplicado un nivel
     más arriba.
  3. **La implementación de arranque NO devuelve datos fijos: resuelve el trial de verdad**, y
     niega las otras tres fuentes. Es la precisión que cambia el valor del ejercicio, y el motivo
     está abajo.
  4. **Tres defensas, y ninguna es opcional**: el default de una fuente no implementada es
     **negar**; **un solo juego de casos corre contra las dos implementaciones**; y un guard
     impide que la implementación de arranque llegue a producción.
- **Motivo**: es la **condición B de `DEC-ARCH-004`** aplicada a esta frontera en vez de a la de
  la pasarela — *«es lo que prueba que la abstracción no miente: si no se puede escribir sin
  filtrar conceptos de Mercado Pago, la interfaz está mal definida»*. El contrato no es un
  andamio: es el instrumento que verifica que el corte de `DEC-ARCH-005` es real.
- **Por qué el trial y no un dato fijo**: un simulacro que contesta **siempre que sí** es un
  fail-open, y deja sin ejercer **la mitad interesante** —perder la cobertura: `PB2`, el
  reconciliador de excedentes, el aviso de qué se hizo—. Uno que contesta siempre que no deja todo
  apagado. Las dos versiones desarrollan verticales contra un mundo que no existe. **El trial evita
  las dos porque es un título vivo de verdad**, con una máquina de estados que vive del lado de
  verticales (cap. 03 §2) y que vence: los dos caminos se ejercen completos sin una sola línea de
  mentira. Lo único que se siembra es un plan con sus entitlements para que el trial tenga de dónde
  derivar, y eso es un dato, no una rama en el código.
- **El riesgo, declarado**: **que la implementación de arranque sobreviva a producción.** El
  proyecto ya tiene el caso: un fallback comentado como seguro que era el permisivo. Por eso las
  tres defensas del punto 4 son parte de la decisión y no una recomendación — y por eso el default
  es negar: **un olvido apaga funciones en vez de regalarlas.**
- **Implicaciones**:
  1. **El swap de implementación deja de ser un día de sorpresas** y pasa a ser un evento
     verificable: para entonces el juego de casos ya corrió meses contra la otra.
  2. **El contrato se escribe antes que las dos specs autónomas**, porque las dos lo citan.
  3. **No agrega sobrearquitectura** (§57): es un contrato con dos implementaciones, que es el
     mínimo con el que la condición B se puede cumplir.
- **Origen**: propuesta del owner del 2026-09-18 —*«definir una interface para el package billing,
  que la épica de verticales genere como stub… y luego la sub épica de billing real, convierta ese
  package stub en código real»*—, con tres precisiones aceptadas en la misma conversación: que lo
  declarado sea el contrato y no el package ajeno, que la implementación de arranque resuelva el
  trial en vez de devolver datos fijos, y las tres defensas del punto 4.

---

### DEC-ARCH-007 — Las dos épicas se desarrollan en paralelo y se liberan juntas; ninguna llega a producción sola

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ARCH-005` partió el programa en dos épicas autónomas, y «autónomas» se puede
  leer de dos formas muy distintas. Una es *«cada una se desarrolla sin esperar a la otra»*; la
  otra es *«cada una puede salir a producción por su cuenta»*. **La decisión era la primera y no la
  segunda**, y no estaba escrito en ningún lado — al punto de que una sesión propuso construir un
  adaptador sobre el billing actual para que verticales pudiera llegar sola, que es trabajo real
  sobre código condenado, apoyado en una premisa que el owner nunca pidió.
- **Alternativas**: (1) cada épica llega a producción cuando está lista; (2) se desarrollan en
  paralelo y se liberan juntas; (3) se libera primero billing y después verticales.
- **Decisión**: **(2)**. La separación existe **para poder trabajar**, no para poder desplegar.
  **Las dos llegan a producción juntas y terminadas.**
- **Y el flujo de ramas lo hace cumplir, en vez de confiar en que alguien se acuerde**:
  1. **Existe una rama de integración del paraguas** — `epic/HOS-1352-verticales-billing` — que
     **nace cuando exista el primer código**, no antes. Los documentos siguen yendo por su rama de
     spec, que sí va a `staging` normalmente: son documentación y no despliegan nada.
  2. **Las sub-épicas cortan de esa rama y mergean a esa rama.** Nunca a `staging` directamente.
  3. **`staging` se mergea HACIA la rama del paraguas, periódicamente y como obligación.** Nunca al
     revés hasta el final. Es lo único que evita que meses de divergencia terminen en un merge
     imposible, y este repo tiene mucho movimiento.
  4. **La revisión ocurre en los PRs de sub-épica → paraguas.** El PR final a `staging` va a ser
     enorme y nadie lo puede revisar de verdad: tiene que ser el merge de algo ya revisado pieza
     por pieza, no el momento de mirar.
  5. **Es una excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo, que exige que
     toda rama salga de `staging` y vuelva a `staging`. Declarada acá para que el próximo agente
     que entre no la «corrija».
- **Motivo**: es la misma forma de la **condición A de `DEC-ARCH-004`** — convertir *«no lo hagas»*
  en *«no se puede»*. Con la rama de integración, liberar una épica sola deja de ser una decisión
  que alguien puede tomar mal: **la unidad que llega a `staging` es el paraguas**.
- **Lo que esta decisión NO cambia**: la autonomía de desarrollo. Las dos épicas siguen sin
  esperarse: verticales se construye y se prueba entera con la implementación de arranque del
  contrato (`DEC-ARCH-006`), y billing avanza en todo lo que no dependa de la pasarela.
- **Lo que sí cancela**: **el contrato se queda con DOS implementaciones.** La tercera que se había
  propuesto —un adaptador que leyera el billing actual, para que verticales pudiera ir a producción
  sin la otra épica— **deja de tener objeto**. Era código sobre el sistema viejo, escrito para
  tirarlo, y sólo se justificaba bajo la lectura equivocada de `DEC-ARCH-005`.
- **El riesgo, declarado, y es otro que el que parecía**: no es la coexistencia en producción —no
  la hay— sino **la espera**. Si una épica termina meses antes que la otra, su código espera, y una
  rama que vive meses acumula conflictos con todo lo que entre a `staging` mientras tanto. Lo
  acotan el punto 3 de arriba y la integración continua hacia la rama del paraguas; **cómo se
  integra sin activar** es materia de la FASE 7 de cada épica y no se resuelve acá.
- **Implicaciones**:
  1. **«Terminada» para una épica no significa «en producción»**: significa **lista y verificada
     contra el contrato**, esperando a la otra.
  2. **Las fases 8 y 9 se parten pero no del todo**: cada épica hace la suya, y **hace falta una
     revisión final sobre el conjunto** antes del despliegue.
  3. **La FASE 10 se desarrolla en paralelo y despliega una sola vez.**
  4. Las fases **5, 6 y 7** sí se parten limpio: cada épica hace su gap analysis, su decisión de
     rewrite/reuse y su estrategia.
  5. **La FASE 1C no se parte**: es billing entera, y se va con `HOS-1354`.
- **Origen**: conversación con el owner del 2026-09-18, aclarando el alcance de `DEC-ARCH-005`
  —*«van a llegar sí o sí juntas y terminadas ambas a producción»*— y proponiendo él mismo la rama
  de integración del paraguas.

---

### DEC-MIG-002 — Las altas nuevas siguen tomándose en el sistema actual durante el rediseño

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el capítulo 21 §3.3 dejó abierto qué pasa con quien se suscriba **mientras dura el
  rediseño**. Es una decisión comercial, no técnica: congelar altas tiene costo de negocio —tres
  verticales todavía no vendieron nada— y no congelarlas agranda la cohorte que después hay que
  transcribir a mano, que es precisamente lo que hoy hace barata a la coordinación manual de
  `DEC-MIG-001`.
- **Las cifras que la sostienen**, medidas el 2026-09-15 y re-verificadas el 2026-09-17 sin un solo
  cambio ([`07-facts-inventory.md`](./07-facts-inventory.md)):

  | | |
  |---|---|
  | pagos registrados en toda la historia del sistema | **0** |
  | suscripciones vivas | **8**, todas mensuales |
  | con compromiso de cobro vivo | **3** |
  | gastronomías · experiencias · partners | **0 · 0 · 0** |

- **Alternativas**: (1) **seguir tomando altas** en el sistema actual; (2) **congelar altas nuevas**
  hasta FASE 10; (3) **coexistencia de dos motores**.
- **Decisión**: **(1)**. Se siguen tomando altas en el sistema actual, y **se transcriben a mano
  cuando el rediseño esté listo**, con el mismo procedimiento del §2.3 que `DEC-MIG-001` fijó para
  las cinco relaciones vivas.
- **Motivo**: el owner declara que **van a ser muy pocas**. Con ese volumen la opción (1) no cuesta
  nada comercialmente, y el trabajo extra que genera es el mismo que ya está aceptado para las cinco
  existentes. La (2) cobra un costo de negocio cierto —cerrar la venta de tres verticales que recién
  arrancan— para ahorrar un trabajo manual que hoy es chico. La (3) es la más cara de construir y
  **contamina la arquitectura nueva**, que es exactamente lo que el §56 pide no hacer.
- **Lo que esta decisión NO afirma**: que la transcripción manual escale. Es barata **porque son
  pocas**, y esa premisa es la que hay que vigilar, no la decisión.
- **El riesgo, declarado**: **la cohorte a transcribir crece mientras dure el rediseño.** Hoy son 5;
  cada alta nueva suma una. **Si el ritmo de altas se acelera hay que volver a mirar esto** — no
  porque la decisión haya sido mala, sino porque habría cambiado la condición que la hacía barata.
  Queda anotado en [`04-open-decisions.md`](./04-open-decisions.md) § *«Para revisar más adelante»*.
- **Implicaciones**:
  1. **El capítulo 21 §3.3 queda cerrado.** Era la única decisión que ese capítulo abría en vez de
     cerrar, y la que remitía a `04-open-decisions.md` sin estar registrada ahí.
  2. **No agrega trabajo de código.** La transcripción usa el procedimiento que `DEC-MIG-001` ya
     definió; lo único que cambia es cuántas filas pasan por él.
  3. **El 2026-09-26 sigue siendo su propia cosa.** El primer cobro de la historia del sistema
     ocurre **bajo el sistema actual** (cap. 21 §3.2 b) y no es materia de esta decisión: es una
     operación que necesita a alguien mirándola el día que pase.
- **Origen**: conversación con el owner del 2026-09-19 —*«van a ser muy pocas, lo manejamos
  manualmente cuando el rediseño esté listo»*—, a partir de la auditoría que encontró que el
  capítulo 21 declaraba esta decisión como registrada y **no lo estaba**.

---

### DEC-CI-001 — `epic/**` es un tipo de rama del proyecto, y no todos los workflows corren ahí

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ARCH-007` manda que las sub-épicas corten de `epic/HOS-1352-verticales-billing`
  y mergeen **a esa rama**, y que la revisión ocurra en esos PRs. Medido el 2026-09-19 sobre el
  worktree: de los **15** workflows del repo, **ninguno nombra `epic` ni un patrón `**`**, y
  `ci.yml` corre en `pull_request` sólo hacia `main` y `staging`. Un PR de sub-épica al paraguas
  entraría **sin lint, sin typecheck, sin tests y sin los guards**, y **el único camino con CI
  completa es el que la decisión prohíbe** (`F-8C2-003`). La regla estaba escrita cuatro veces en
  las specs y **cero veces en el repo**.
- **Alternativas**: (1) una excepción temporal mientras dure el programa; (2) un patrón acotado a
  `epic/HOS-1352-*`; (3) **`epic/**` como tipo de rama de primera clase del proyecto**, con reparto
  explícito de qué workflow corre ahí y qué no.
- **Decisión**: **(3)**.
- **Motivo de descartar (1) y (2)**: una excepción temporal en diez archivos que nadie va a
  recordar retirar **es deuda garantizada**; y un patrón atado a esta épica obliga a volver a tocar
  los mismos archivos en la próxima, que es **la misma forma del defecto que la FASE 8 encontró**
  —una regla escrita para el caso que la motivó.
- **El criterio del reparto**: el riesgo no es que corran ramas `epic/` ajenas —que una épica
  futura reciba lint y tests es deseable— sino que corra **lo caro** y, sobre todo, **lo que tiene
  efectos afuera del repo**.
- **El reparto, workflow por workflow**: corren en `epic/**` **`ci.yml`, `validate-pr-title.yml`,
  `validate-docs.yml` y `codeql.yml`**; `docs.yml` ya corre porque no filtra por rama. **No
  corren**: `e2e-pr.yml` (caro por PR — va por `workflow_dispatch` y **obligatorio antes del PR
  final a `staging`**), `lighthouse.yml` y `a11y-sweep.yml` (miden páginas desplegadas y el
  paraguas no despliega), `whats-new-gate.yml` (es de `main` por diseño) y **`smoke-gate-sync.yml`**.
- **`smoke-gate-sync.yml` es el punto de riesgo y por eso queda afuera con nombre propio**: mueve
  issues de Linear al mergear. Corriendo en los PRs de sub-épica —que llevan `[HOS-NNNN]` en el
  título porque `validate-pr-title` lo exige— **cerraría las 22 unidades del programa como hechas
  sin nada desplegado**. Es el footgun que el `CLAUDE.md` documenta con **dos incidentes reales**
  (PR #1982 → `HOS-36`, PR #1983 → `HOS-54`, ambos revertidos a mano).
- **El barrido profundo también** (agregado el 2026-09-19, `D-29`): `codeql-staging.yml` pina
  `ref: staging`, así que una rama de paraguas acumularía **meses de código nuevo sin barrido
  profundo**, cubierta sólo por semgrep **por diff** — que mira el cambio y no el conjunto, y por lo
  tanto **no ve lo que emerge de la combinación** de cambios que individualmente pasaron. Vale para
  **toda** rama de integración de épica, no sólo la primera.
- **Las dos mitades de `ci.yml` hacen falta**: `pull_request` cubre `F-8C2-003`; **`push` cubre
  `F-8C2-004`**, porque el merge periódico de `staging` hacia el paraguas **no es un PR** y ningún
  disparador de `pull_request` lo alcanza.
- **Implicaciones**:
  1. **No está aplicado.** Son archivos del repo y el §65 reserva el código productivo para la
     FASE 10; la aplicación la decide el owner. El detalle por archivo está en
     [`15-fase-9/01-R6-resuelto.md`](./15-fase-9/01-R6-resuelto.md) §7.3.
  2. **La ventana está abierta**: `git ls-remote --heads origin 'epic/*'` devuelve **cero** al
     2026-09-19. Mientras el paraguas no exista, aplicarlo no obliga a migrar nada.
  3. **Aplicar esto hace que `G8` falle en el primer PR del programa** en vez de no correr nunca.
     Es lo deseable, y es lo que vuelve **no independientes** esta decisión y la de abrir el gate
     de `DEC-METH-003`.
  4. La regla vive en el `CLAUDE.md` del repo, junto a las de `main` y `staging`, **no sólo acá**.
- **Origen**: conversación con el owner del 2026-09-19 —*«tampoco quiero que más adelante corran
  ramas epic que no tienen nada que ver, o lo hacemos temporal o lo definimos bien como regla del
  proyecto»*—, sobre el recorrido de R6.

---

### DEC-CI-002 — `develop` no se toca: es una condición adelantada, no un filtro muerto

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: midiendo R6 se encontró que `validate-docs.yml` filtra por `[main, develop]` y que
  **`develop` no existe en el remoto** (`git ls-remote --heads origin develop` → cero, 2026-09-19).
  Se propuso limpiarlo como filtro muerto.
- **Decisión**: **no se toca**, y **la razón vuelve falso el diagnóstico**: no es descuido, es una
  condición **adelantada** a una rama que el owner sí quiere tener. Le hizo falta hace semanas,
  para trabajo que todavía no debía llegar a `staging`.
- **Por qué no ahora y no acá**: crearla de verdad obliga a tocar **workflows, reglas de rama e
  instrucciones de los agentes** — es trabajo propio, no un renglón. Lo toma otra persona, en otro
  momento.
- **Implicación**: queda **anotado como pendiente de diseño**, no como limpieza. Quien agregue
  `epic/**` a `validate-docs.yml` (`C-7`) **no debe aprovechar para sacar `develop`**.
- **Origen**: conversación con el owner del 2026-09-19.

---

### DEC-METH-005 — Los guards nuevos salen de lo que la épica pide, y corren desde el día 1

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el repo tiene **45 guards** —scripts que fallan el build a propósito cuando
  encuentran algo prohibido— y son la defensa real contra el modo de falla que este programa viene
  a corregir. El caso que lo prueba es `HOS-1079`: **once sitios en `apps/api` decidían una
  vertical con un ternario binario** (`x === 'gastronomy' ? A : B`) y respondían mal para
  `accommodation` y `partner`; **ninguno se detectó en runtime**, los cazó un guard estático. Pero
  el rediseño **borra el sujeto de varios de esos guards**, así que la defensa que más hace falta
  está programada para morir en medio de la épica (`F-8C2-008`).
- **Alternativas**: (1) exigir que los `G1`…`G13` del diseño nuevo **cubran lo que cubren los
  guards condenados**, con mapeo uno a uno; (2) **los viejos quedan como están y se eliminan a
  medida que se pueda; los nuevos salen de lo que la épica pide, más lo que valga la pena rescatar
  de los viejos, y corren desde el día 1 de implementación**.
- **Decisión**: **(2)**.
- **Motivo de descartar (1)**, y son dos, el segundo medido: **ata el diseño nuevo al vocabulario
  viejo** —obliga a preguntar cómo se expresa `product_domain` en el modelo nuevo cuando esa
  pregunta puede no tener sentido—, que es exactamente lo que el **§0 del PDR prohíbe**. Y el
  inventario de [`15-fase-9/04-inventario-de-guards.md`](./15-fase-9/04-inventario-de-guards.md)
  mostró que **ni siquiera es cierto que mueran todos**: de los 45, **7 `MUERE`, 6 `REVISAR`, 32
  `SOBREVIVE`**, y de los diez que vigilan la separación por vertical **mueren cinco**. Un mapeo
  uno a uno habría obligado a traducir cosas que no desaparecen.
- **Por qué «desde el día 1» es la parte que importa**: la función de estos guards **no es
  documentar el diseño, es impedir que una implementación se salga de él**. Un guard que llega
  después certifica lo que ya se hizo; no protege. Es la misma forma que `DEC-ARCH-004` ya le dio a
  sus dos condiciones —el guard contra importar el SDK fuera del adaptador, y el adaptador falso
  «desde el día uno»—, generalizada a todo el programa.
- **Cómo se vuelve verificable** (el agregado aprobado en la misma conversación): **cada unidad de
  trabajo declara qué guard entrega, y ese guard es parte de su definición de terminado.** No son
  una unidad aparte al final. Así «desde el día 1» se comprueba solo: si la unidad está terminada,
  su guard existe y corre.
- **Tres datos medidos que hoy lo impiden, y hay que resolver antes**:
  1. **Los `G1`…`G13` tienen CERO implementados.**
  2. **`G12` y `G13` no están en ningún capítulo `20`**: nacieron sueltos en las descomposiciones.
  3. **Estar en `pnpm check:guards` NO hace que un guard corra en CI** — necesita su **paso propio**
     en el job `guards`. Sin esto se escriben trece guards que no se ejecutan y nadie se entera.
- **Qué pasa con los viejos**: **no se tocan ahora.** Se eliminan a medida que su sujeto
  desaparezca, y eso lo deciden las FASES 5 y 6, no esta decisión.
- **Y el inventario cambia de uso**: deja de ser una lista de borrado y pasa a ser dos cosas — el
  aviso de **qué se va a poner rojo y por qué no es un bug**, y una **cantera de ideas** para los
  guards nuevos.
- **Implicación sobre el alcance**: enumerar los guards que cada unidad entrega es **editar las dos
  `descomposicion.md`**, o sea la **salida 3 de `DEC-METH-004`**, que va al final de la FASE 9.
  Queda anotado ahí, no se ejecuta acá.
- **Origen**: conversación con el owner del 2026-09-19 —*«esos que queden como están, y los vamos
  eliminando a medida que podamos, y que desde el inicio tengamos los guards nuevos … corran desde
  el día 1 de implementación de esta épica. eso nos protege que ningún agente le erre en
  implementación y haga algo por fuera de lo que estamos buscando»*.

---

### DEC-GRANT-005 — Un grant permanente se ancla al PLAN, lee su versión vigente, y lleva trinquete

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: un grant permanente cruza la frontera, la persona queda «cubierta», y cuando el
  paso 6 pregunta **qué capacidades le da, no hay respuesta**. El contrato transportaba un solo
  campo de contenido (`versiónDePlan`) y un grant **no apuntaba a ningún plan**: *Free Forever* era
  un nombre comercial **sin contenido definido**. Lo encontraron **tres agentes de las dos épicas
  por separado**, que es lo que lo volvió la causa de su racimo.
- **Alternativas**: (1) anclar a una **versión fija**; (2) **anclar al plan y leer su versión
  vigente**; (3) que el grant **declare su propio juego de claves**.
- **Decisión**: **(2)**, con dos precisiones que la completan: se lee la vigente **sea vendible o
  no**, y con un **trinquete** — *un grant nunca otorga menos de lo que otorgaba el día que se
  concedió.*
- **Por qué no la (1)**: era la recomendación original y el owner la mejoró. Anclado a una versión
  fija, el beneficiario **no recibe ninguna mejora del plan**, para siempre. Y el modo híbrido no
  inventa nada: `V/02` §2.1 ya tiene **los dos modos escritos** —*«la pricing lee la versión
  vigente y sólo si es vendible; una suscripción lee su versión anclada, vigente o no, vendible o
  no»*—, así que seguir la vigente no agrega un tercer modo.
- **Por qué «vendible o no» y no como la pricing**: porque **retirar un plan se hace publicando una
  versión no vendible** (`D13`, cap. 10 §3.2). Leyendo *«sólo si es vendible»*, el día que se
  retira el plan Premium **todos los `Free Forever` anclados a él se quedan sin nada**.
- **Por qué el trinquete**: seguir la vigente expone al beneficiario a que el plan **empeore** —una
  versión que reparte distinto le saca algo a quien tiene un «para siempre», **sin que nadie lo
  haya decidido para esa persona**—. El instrumento no es nuevo: es el piso de `V/15` §2.5.
- **Por qué no la (3)**: sería **una segunda forma de declarar entitlements**, que `V/02` §1.2
  prohíbe, y obligaría a mantener dos catálogos en sincronía para siempre. Es el defecto que este
  programa entero viene a corregir.
- **La objeción que había que contestar, y se contesta con reglas que ya existen**: que un grant
  apunte a una versión de plan choca con `NUCLEO/01` §1.5 —*«se modela como entidad independiente,
  no como un plan»*—. **Anclar no es ser**: una suscripción ancla una versión y no es un plan. Y el
  retiro ya estaba resuelto por `D13`.
- **Implicaciones**: `permanent_grant` gana **`plan_id`** (no anulable) y el **piso del trinquete**,
  guardado como **referencia a la versión**, nunca como copia de valores. `UNIQUE(plan_id) WHERE
  vigente` es lo que garantiza que *«la vigente»* sea unívoca y siempre exista.
- **Beneficio operativo**: regalar algo pasa a ser **elegir un plan concreto**, y queda auditado.
- **Riesgo declarado**: que alguien lea el anclaje como *«el grant es un plan»*.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-05`, sobre el racimo `R2`.

---

### DEC-CONC-003 — `RECONCILIATION_REQUIRED` deja de ser un estado y pasa a ser una MARCA

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el estado quedaba **fuera de los «vivos»** del candado del §11, y esa exclusión
  estaba escrita **con su razón**, en `B/02` §2.2: *«si una suscripción necesita intervención
  humana, la persona tiene que poder contratar de nuevo sin esperar a que alguien resuelva un
  caso»*. **La intención era buena; lo que produjo, no.** Al no verlo el candado se abrieron **dos
  críticos a la vez**: el preapproval sigue vivo y habilita una segunda suscripción —**dos
  cobros**, y está medido que el proveedor no frena la segunda— y **un estado del que no se sale**,
  sin destino legal una vez que el cliente recontrató.
- **La causa de fondo**: escribir `RECONCILIATION_REQUIRED` **en la columna de estado borra el
  estado real**. Eso obliga a `S15` a **adivinar a dónde volver** y **convierte una alerta en una
  decisión destructiva automática** —convertir una `ACTIVE` en `RECONCILIATION_REQUIRED` lo es,
  textualmente—, que es lo que el §22.1 prohíbe.
- **Alternativas**: (1) **marca booleana** sobre la fila, que conserva su estado; (2) dejarlo como
  estado y **meterlo** en los vivos.
- **Decisión**: **(1)**.
- **Por qué la marca cumple mejor la intención original que la exclusión que la escribió**: la
  razón era *«que la persona no espere a que alguien resuelva un caso»*. Con la marca **no espera
  nada: su suscripción sigue en su estado real y funcionando**. La marca es para el operador, no
  para el cliente. La (2) cierra el doble cobro pero **le cobra al cliente la espera**, que es
  exactamente lo que la razón quería evitar.
- **Implicaciones**: `S14` deja de ser una transición —pone la marca y emite el §22.1— y `S15`
  también —la levanta, y si además corresponde un cambio de estado se ejecuta **la transición de la
  tabla que lo permita**—. Una fila marcada **ocupa** el candado en vez de liberarlo, que es la
  única dirección en que esto **endurece** la restricción. Y una fila marcada **no puede declarar
  una sucesión**, salvo desde `CANCEL_SCHEDULED` (ver `DEC-SUB-011`).
- **⚠️ Revisa una razón registrada del owner**, y por eso lleva `DEC-` propia en vez de aplicarse
  como corrección: la frase de `B/02` §2.2 era deliberada.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-11` y `D-12`, sobre el racimo `R1`.

---

### DEC-SUB-011 — El invariante 8 del §64 cuenta COMPROMISOS, no FILAS

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **⚠️ Apartamiento declarado del PDR** (§11 y §64.8).
- **Problema**: el §11 dice *«máximo una suscripción principal por `user + vertical`»* y el candado
  lo hacía cumplir con **una sola clave** sobre un conjunto de estados. Pero esa clave estaba
  haciendo cumplir **dos invariantes distintos a la vez** —*«un compromiso comercial por
  vertical»* y *«una autorización de cobro por vertical»*—, con el conjunto de estados como proxy
  de los dos. Por eso fallaba **en las dos direcciones**: lo que incluía de más bloqueaba un
  compromiso que todavía no existe, y lo que excluía de más liberaba una autorización que sigue
  viva. Y `DEC-SUB-006` implicación 1 **exige** la convivencia: *«la suscripción vieja se cancela al
  recibir el webhook de autorizada, NUNCA antes»*.
- **Decisión**, y la redacción es la decisión:
  > **El invariante 8 del §64 cuenta COMPROMISOS, no FILAS.**
- **Por qué esa formulación y no *«ahora puede haber dos suscripciones»***: porque **conserva la
  política del PDR intacta** y explica por qué dos filas no la violan. Con la sucesión, el máximo
  de filas vivas pasa a dos durante la ventana del cambio de plan, pero **sigue habiendo un solo
  compromiso de pago**. Lo que deja de ser literal es el enunciado **sobre las filas**.
- **Implicaciones**: `subscription` gana **`sucede_a`** y el `UNIQUE` se parte en **dos índices
  parciales** sobre las mismas columnas y el mismo conjunto de estados, uno para el origen y otro
  para la sucesora. **Dos, exactamente**: un origen y su única sucesora. Al indexar el segundo sobre
  `(user_id, vertical)` —y no sobre `sucede_a`— **una sucesora no puede ser sucedida** sin ninguna
  regla extra. Nuevo invariante `D15` en `NUCLEO/04` §3, y dos guards, `G-R1-A` y `G-R1-B`.
- **Por qué hay que declararlo** en vez de simplemente aplicarlo: el PDR **no se edita** (regla 1),
  y el riesgo de no declararlo es concreto — **alguien lee el §64, ve *«máximo una»* y «arregla» el
  candado de vuelta**, deshaciendo todo esto sin saber que lo está haciendo, y con toda la razón
  desde su punto de vista. Hay cuatro precedentes exactos: `DEC-ARCH-003`, `DEC-OBS-001`,
  `DEC-METH-004` y `DEC-METH-005`.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-13`, sobre el racimo `R1`.

---

### DEC-MIG-003 — No se migra: las ocho filas se cancelan y quien tenga algo vivo se suscribe de nuevo

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **⚠️ Supersede en parte a `DEC-MIG-001`**, que definía qué hacer con la cartera existente.
- **Problema**: se estaba diseñando la migración de la cartera actual —orden forzado, punto de no
  retorno por fila, y la aceptación de que el rollback no existe pasado cierto paso—, y **nadie
  sabía de quién eran las ocho filas**.
- **El dato que lo decide lo aportó el owner y no estaba en ningún documento**: **las 2 `comp` son
  suyas** —sin ningún cliente real detrás— y **las 3 `trialing` son clientes, pero amigos a los que
  puede llamar para que se resuscriban**. Las otras 3 son `abandoned`: **no tienen nada vivo**.
- **Decisión**: **se arranca de cero. El sistema nuevo no hereda una sola fila.** Las dos cortesías
  se escriben como `permanent_grant` —exactamente como el *Free Forever* del diseño nuevo, sin nada
  especial— y **se pueden regenerar**.
- **Qué se pierde, medido**: **nada de plata** —no hay **un solo pago histórico**, ningún
  comprobante, ninguna serie que reconstruir— y el *«trial ya consumido»* de **seis personas
  conocidas**, de las cuales tres ya habían abandonado el checkout igual.
- **El argumento, y no es de pereza**: se estaba construyendo una migración para **ocho filas sin un
  solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla y
  garantizar su rollback es **desproporcionado frente a un mensaje**. Y el beneficio extra es real:
  el sistema nuevo arranca **sin una sola fila heredada** — sin transcripciones, sin estados viejos,
  sin dudas sobre si algo quedó mal migrado. Es el escenario más limpio posible, y **sólo está
  disponible ahora**, mientras son ocho.
- **Qué deja sin objeto**: cuatro de los cinco problemas críticos de la migración **no se resuelven,
  se eliminan** —dejaba afuera las relaciones con trial, transcribía el trial dejando los
  compromisos sin vínculo, tenía un punto de no retorno sin lado elegido, y describía dos
  operaciones distintas en dos lugares—, más el hecho de que **nadie la ejecutaba**. La unidad de
  trabajo que iba a escribirla **no se crea**.
- **Lo único que sobrevive**: el **rollback del PROGRAMA**, que es otra cosa y vive en la FASE 7 del
  paraguas (ver `16-fase-7-del-paraguas.md`).
- **⚠️ Precisado el 2026-09-20, tras la FASE 8-bis.** La frase *«el sistema nuevo no hereda una sola
  fila»* quedó **literalmente falsa en un punto**, y conviene la precisión exacta:
  > **Ninguna fila VIVA del sistema viejo pasa al nuevo.** La única que se escribe es una lápida:
  > el compromiso cancelado, en `CANCELLED` y con su vínculo al proveedor (`B/21` §2.5).
  **Sin ella, un cobro viejo que llega después del corte entra como un preapproval desconocido**, y
  el único camino automático para un desconocido es re-vincularlo — con la suscripción nueva de esa
  misma persona como candidato más plausible. **Pagaba dos veces y el sistema registraba una.** La
  regla estaba escrita desde `R5` y **se la llevó puesta esta misma decisión**, aunque no migra
  nada: sólo conserva el rastro de lo que se cancela.
- **Y cómo amanece la población existente, que esta decisión no había contestado.** Sin filas, todo
  el mundo queda en `PRE_TRIAL`; como un reloj que no arrancó no da cobertura, **las fichas
  publicadas de Alojamiento se despublican la mañana del corte**. **Se acepta**: se avisa antes, se
  los llama, contratan, y la ficha vuelve sola. **No se les siembra nada** — hay que llamarlos
  igual, así que una siembra no ahorra ninguna conversación y sí agrega filas.
- **El orden del corte queda declarado** en `16-fase-7-del-paraguas.md` §4: cancelar en el
  proveedor, **verificar releyendo por id**, desplegar, y recién entonces escribir las lápidas. El
  segundo paso es el gate: si alguno no se pudo cancelar, el corte no avanza.
- **⚠️ Condición de caducidad**: `DEC-MIG-002` decidió **seguir tomando altas durante el rediseño**,
  así que la cartera crece. Con ocho filas *«no migrar»* son tres llamadas; **el umbral medido está
  en unas veinte**, y arriba de eso deja de ser viable. El aviso que el owner ya se comprometió a
  dar —*«si veo que empiezan a entrar registros nuevos, te aviso»*— **ahora tiene una consecuencia
  concreta: hay que volver a discutir esta decisión.**
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-24`, `D-25` y `D-26`, sobre el racimo `R5`.

---

### DEC-METH-006 — La FASE 8 vuelve a correr sobre lo que la FASE 9 produjo, hasta que no aparezca ningún CRÍTICO nuevo

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **⚠️ Apartamiento declarado del método**, que el PDR §65 define como **fases en secuencia**.
- **Problema**: `DEC-METH-004` definió cuándo un **hallazgo** está resuelto, no cuándo la **fase**
  termina, y no preveía que la propia FASE 9 pudiera introducir defectos nuevos.
- **Decisión**, y son dos cosas:
  1. **Cuándo termina la FASE 9**: cuando las cuatro salidas de `DEC-METH-004` están cerradas y
     ningún `CRITICA` queda abierto **sin causa declarada**.
  2. **El ciclo**: *«una vez que 9 decimos ok, listo, volvemos a ejecutar la 8, para asegurarnos que
     con los cambios de la 9 no aparece ningún problema nuevo, y si aparece, otra vez la 9»*, y
     **se repite hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo.**
- **Por qué *«sin causa declarada»* es lo que hace usable la definición de salida**: permite
  terminar con cosas abiertas —el capítulo 13 no se va a escribir antes— **siempre que cada una diga
  por qué y de qué depende**. La alternativa *«ningún `CRITICA` abierto, punto»* **nunca se cumple**:
  ata el fin de la fase a algo que la fase no controla.
- **Por qué *«ningún `CRITICA` nuevo»* y no *«ningún hallazgo»***: siempre va a aparecer algo menor,
  y atarlo a cero es la misma trampa. Los `ALTA` y `MEDIA` de la última pasada **se registran y se
  va a FASE 10 con ellos declarados**.
- **La evidencia está en la propia tanda que lo motivó**: la FASE 9 **ya demostró que puede
  introducir defectos nuevos**. `D-01` existe porque el arreglo de `R2` abría un fail-open que el
  diseño original no tenía, y `D-20` porque la resolución de `R3` le daba un segundo significado a
  un campo del contrato. **Los dos se cazaron de casualidad**, mientras se resolvía otra cosa.
- **Dónde cae la 8-bis dentro del ciclo**, precisado el mismo día: las salidas 3 y 4 son
  **PROPAGACIÓN** —52 objetos entre issues, fichas y descomposiciones—, así que la 8-bis corre
  **antes** de ellas. Si corriera después y trajera críticos, la 9-bis los resolvería **y habría que
  propagar todo de nuevo**. El orden queda: (1) aplicar decisiones · (2) las `DEC-`, log, handoff y
  worklog · (3) **8-bis entera** · (4) ¿críticos? → 9-bis → volver a (1) · (5) ¿sin críticos? →
  salidas 3 y 4, **una sola vez** · (6) FASE 10.
- **Cómo corre la 8-bis: ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que
  **las contradicciones viven ENTRE capítulos**, así que atacar sólo los textos corregidos la
  volvería ciega a justamente lo que el ciclo busca. Lo que la abarata no es recortar el alcance
  sino que **arranca con los 327 casos ya enumerados**: recorre dominios en vez de descubrirlos.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-30`, sobre el racimo `R6`.

---

### DEC-METH-007 — El gate de FASE 5 se abre, con un criterio de dos filtros en orden

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-METH-003` dejó la clasificación del código legacy —`KEEP` o `REWRITE`— detrás
  de un gate cuya única condición era **tener el inventario de FASE 1B terminado**, y esa condición
  **está cumplida desde el 2026-09-17**. Sin abrirlo, **`V1` —la única unidad sin dependencias— no
  puede terminar**, porque lleva `G8` (falla si queda `commerce` en fuentes activas) y hacerlo pasar
  **es ejecutar el §55 sobre el código real**, o sea FASE 5. Las otras 21 unidades esperan detrás.
- **Decisión**: se abre, con **dos filtros en este orden**, propuestos por el owner.
- **Filtro 1 — POR SUJETO**: sobrevive el código **cuyo sujeto sobrevive**. No se juzga la calidad:
  se pregunta si **la cosa que ese código maneja existe en el modelo nuevo**. Si el diseño elimina
  `product_domain`, todo lo que opera sobre `product_domain` se va, **sea bueno o malo**.
- **Por qué primero**: elimina la mayor parte **sin auditar nada**. `DEC-ARCH-004` ya condenó todo
  lo que cuelga de qzpay, y el modelo nuevo es **otro modelo**. Juzgar la calidad de ese código
  sería gastar tiempo en una pregunta que no decide nada. Y **esquiva la trampa que `DEC-METH-003`
  anticipó**: no condena al Eje 2 por definición, porque pregunta si *esa capacidad de esa vertical*
  existe en el modelo nuevo, y muchas existen. Precedente en la misma sesión: el inventario de
  guards aplicó exactamente esta forma sobre 45 scripts y dio **7 `MUERE` / 6 `REVISAR` / 32
  `SOBREVIVE`**, con evidencia por fila y sin discusiones.
- **Filtro 2 — POR CONFIANZA DEMOSTRABLE**, sobre lo que sobrevivió al 1: las cinco condiciones del
  PDR para `KEEP`. **El orden es lo que lo vuelve viable**: el filtro 2 es caro y aplicándolo después
  del 1 **se paga sólo sobre una fracción**. Cierra además el agujero que el filtro 1 solo tenía —
  por sujeto, **un código malo cuyo tema sobrevive pasaría a `KEEP` sin que nadie lo mire**.
- **El umbral, en palabras del owner**:
  > **No hace falta probar que algo está mal. Basta con no poder probar que está bien.**
  >
  > *«Prefiero pagar un costo alto, pero que las cosas queden realmente bien. Venimos de 3 o 4
  > refactors grandes de esto en los últimos 2 meses y nunca nos termina de quedar bien, así que el
  > mantener tiene que ser extremadamente seguro; si no, prefiero reescritura.»*
- **Es más fuerte que el §2 del PDR** —*«la carga de prueba debe estar del lado de conservar»*— **y
  abarata el trabajo en vez de encarecerlo**: no exige investigar cada pieza a fondo, exige **poder
  afirmarlo con evidencia a mano**. Si no se puede demostrar rápido, va a `REWRITE` y se sigue. **Lo
  caro sería el criterio blando**, que obliga a discutir cada caso.
- **Una precisión sobre «bien testeado», que es la condición que más miente**: de las cinco del PDR
  es la más fácil de falsear. Esta misma sesión encontró guards en verde que no vigilan nada. **Si
  el filtro 2 pregunta «¿tiene tests?», conserva código respaldado por tests vacíos** y el trabajo
  del filtro 1 se desperdicia. **Se demuestra, no se declara**: hay que ver que el test **detecta el
  fallo** — romper la cosa y verlo ponerse rojo. Es caro, y **sólo es viable gracias al orden**.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-31`, sobre el racimo `R6`.

---

### DEC-ARCH-008 — La dirección de un cambio de plan la decide VERTICALES, y billing recibe un veredicto

- **Fecha**: 2026-09-20 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: la única regla que decide **cuándo se cobra** un cambio de plan —si el monto se muta
  hoy o al fin del ciclo— está escrita como *«la dirección se deriva del delta entre las dos
  versiones, **no del `rank`**; si algo baja, es bajada; **cualquier baja manda**»* (`B/10` §3.5).
  Comparar eso es **leer las dos tablas de capacidades**, que son de verticales. O sea: la regla que
  decide **qué se le cobra a alguien y qué día** exigía que billing leyera exactamente lo que el
  contrato prohíbe cruzar, **dos veces y por escrito**. Y la dirección inversa, declarada en la
  FASE 9, **no incluía ese consumidor** — así que el contrato afirmaba haber enumerado un
  acoplamiento que no enumeró.
- **Alternativas**: (1) **la comparación la hace verticales y billing recibe un veredicto**; (2)
  derivar la dirección del **`rank`**; (3) **billing lee las dos tablas**, con la excepción
  declarada.
- **Decisión**: **(1)**. La dirección inversa del contrato gana una tercera pregunta —
  `direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA` — y **billing nunca ve valores**.
- **Por qué no debilita la regla de la dirección inversa**, que es la objeción obvia: esa regla dice
  que la inversa transporta *«política y estado de catálogo, nunca capacidades»*, y **un veredicto no
  es una capacidad**. `SUBE`/`BAJA` es una propiedad de **la relación entre dos versiones**, no un
  valor de ninguna: la misma clase de dato que `permitePausa`.
- **Motivo de descartar (2)**: es la más barata y **el diseño ya la había rechazado por escrito**.
  Un plan más caro puede **bajar un límite** al rediseñarse, y con el `rank` mandando **al cliente
  se le recorta algo en silencio mientras se le cobra como mejora**. Y un plan retirado **no tiene
  `rank` comparable**, que es justamente el único caso donde la regla hace falta.
- **Motivo de descartar (3)**: es **el acoplamiento exacto que partir el programa en dos épicas
  venía a impedir**, sería la primera excepción declarada al corte, y **la regla de vigilancia que
  el propio contrato monta se dispara con ella**.
- **Origen**: `F-8bA3-005`, y la conversación con el owner del 2026-09-20.

---

### DEC-METH-008 — «Resuelto» incluye el dominio que el ARREGLO crea, y el ciclo corta con causa declarada

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-004`** (la definición de «resuelto») y **enmienda `DEC-METH-006`** (la
  condición de corte del ciclo 8 ↔ 9).
- **Problema, y está medido**: la primera vuelta del ciclo —la FASE 8-bis— produjo **112 hallazgos
  y 28 críticos**, y de los 25 críticos de las pasadas A y B, **25 los atribuyen sus propios
  informes a un cambio de la FASE 9**. **Ninguno es un defecto preexistente** que la primera pasada
  hubiera dejado pasar. Con la condición de corte tal como estaba —*«hasta que una pasada no
  produzca ningún `CRITICA` nuevo»*— el ciclo **no termina**: mide un **stock** de defectos cuando
  el generador es **el acto de arreglar**. El conteo baja (48 → 28) porque baja el tamaño de la
  tanda de arreglos, no porque baje la deuda.
- **La causa, precisa**: `DEC-METH-004` define «resuelto» como *«el camino del hallazgo,
  reejecutado, ya no llega — y para un racimo, la regla corregida se verifica contra todo el
  dominio que cuantifica»*. **Ese dominio es el del PROBLEMA, nunca el del ARREGLO.** Caso testigo,
  medido: al partir el `UNIQUE` del §11 por `sucede_a`, el dominio pasó de **90 a 180 pares** y la
  resolución de `R1` verificó **los 90 de antes**. La mitad nueva contenía el doble cobro que el
  arreglo venía a cerrar (`F-8bB1-001`).
- **Decisión, y son cuatro partes:**
  1. **Un arreglo se verifica contra el dominio que el arreglo CREA**, enumerado con la misma regla
     que el del problema: lista finita, con fuente por elemento. Si el arreglo agrega un eje a una
     clave, a un estado o a una clasificación, **el dominio se multiplica y se re-enumera**.
  2. **Y contra las premisas de los demás racimos.** La pregunta es explícita y se contesta por
     escrito: **«¿qué premisa de OTRO racimo estoy volviendo falsa?»**. Tiene su caso testigo: `R2`
     construyó el título `BASE` sobre *«`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna
     fuente `TÍTULO`»* y `R3` la volvió falsa para dos de los tres, **sin que ninguno lo notara**.
  3. **La condición de corte del ciclo pasa a ser la misma que la de salida de la FASE 9**: se
     repite hasta que **ningún `CRITICA` quede abierto sin causa declarada**, en vez de hasta que
     una pasada no produzca ninguno. Es el criterio que `DEC-METH-006` ya eligió para la fase,
     aplicado al ciclo.
  4. **Quién decide, caso por caso: el owner.** Para cada `CRITICA`, la elección entre **arreglarlo**
     y **declararlo con su causa** la toma el owner, y **el agente no elige por su cuenta**. Se le
     presenta qué se rompe, de dónde salió y una recomendación; la decisión es suya.
- **Por qué las cuatro juntas y no algunas**: la 1 y la 2 **atacan al generador** y solas no acotan
  el número de vueltas; la 3 **pone la cota** y sola no mejora nada —sólo deja de esperar—, y entre
  los 28 críticos de esta pasada hay dobles cobros literales. La 4 es la condición que el owner puso
  al aprobar las otras tres, y no es cosmética: **cuál de los dos caminos toma un crítico es una
  decisión de producto y de riesgo**, no una de método.
- **Lo que NO se decidió**: bajar la vara de `CRITICA`. Se revisaron los 28 buscando severidad
  inflada y no se encontró ninguno.
- **Resultado de su primera aplicación**, el mismo día: las **23** decisiones se tomaron familia por
  familia — **22 `ARREGLAR`**, **1 `APLICAR`** (no era un defecto de diseño sino una regla ya escrita
  y no pegada) y ninguna declarada con causa.
- **Origen**: la FASE 8-bis, `17-fase-8-bis/00-hallazgos.md` §2, y la conversación con el owner del
  2026-09-19 —*«vamos con la 3, pero con la condición de que no tomes vos la decisión de si se
  arregla o se escribe la causa y se patea: cada caso de esos me lo decís y me das a elegir»*.

---

### DEC-METH-009 — Un arreglo no está aplicado hasta que se buscó el término que redefine en los capítulos que el commit NO toca

- **Fecha**: 2026-09-20 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-008`**: le agrega una **tercera obligación**. No la reemplaza ni la corrige
  —la obligación 1 funcionó—, y no toca la condición de corte.
- **Problema, y está medido**: la segunda vuelta del ciclo —la FASE 8-bis-2— dio **120 hallazgos**
  y **17 defectos críticos distintos**, y **17 de 17** los atribuyen sus informes a un arreglo de
  la 9-bis. La proporción **no bajó** respecto de la primera vuelta (25 de 25). Lo que sí cambió es
  el **modo**, y `18-fase-8-bis-2/C1-la-costura.md` §2.3 lo cuenta:

  | generador | críticos |
  |---|---|
  | el arreglo se escribió **en un solo lado de una frontera de dos** | 6 |
  | el arreglo **volvió falsa la premisa de otro arreglo** | 6 |
  | el arreglo **declaró su dominio recorrido y lo recorrió a medias** | 3 |
  | el arreglo **abrió una pregunta y contestó una mitad** | 2 |
  | el arreglo **se apoyó en una medición que caduca sola** | 1 |

- **La causa, precisa**: la obligación 1 de `DEC-METH-008` —recorrer el dominio que el arreglo
  crea— **se ejecutó**, y los tres arreglos que traen su dominio escrito (la tabla de 6 × 4, los
  nueve estados, los dos valores de `sucede_a`) dejaron su propio dominio en orden. La obligación 2
  —*«¿qué premisa de OTRO arreglo estoy volviendo falsa?»*— **no se ejecutó en ninguno**. Pero el
  generador más grande, los 6 de la primera fila, **no lo detecta ninguna de las dos**: no es un
  dominio mal recorrido ni una premisa ajena rota, es **un arreglo escrito en un lugar y no en el
  otro lugar donde la misma regla se ejecuta**. Caso testigo: el gate que descarta las fuentes
  `COMPLEMENTO` se escribió en `12-contrato-de-cobertura.md` §2.4 y `V/15` siguió diciendo *«suma
  todas las fuentes vivas»* (`F-8cA1-007` y `F-8cA3-004` son el mismo defecto visto por dos agentes
  ciegos).
- **Decisión**: un arreglo **no se declara aplicado** hasta que se cumple este paso, que es
  mecánico y no depende de que el que arregla se acuerde de hacerse una pregunta:
  1. **Nombrar el término que el arreglo redefine** — el campo, el estado, la clase, la regla o la
     frase cuyo significado cambia. Se escribe, no se piensa.
  2. **Buscarlo con `rg` sobre los capítulos que el commit NO toca**, las dos épicas y el núcleo.
  3. **Cada aparición se resuelve**: o se corrige, o se declara por escrito por qué esa aparición
     sigue siendo correcta con el significado nuevo.
- **Por qué esta y no más recorrido interno**: está contado. *«Ninguno de los 17 se habría evitado
  con más recorrido interno; **doce de los 17** se detectan con una búsqueda de texto por el término
  que el arreglo redefine, sobre los capítulos que el commit no toca»* —
  `18-fase-8-bis-2/C1-la-costura.md` §2.3, con los términos enumerados: `sucede_a`, «sucesora»,
  «viva», «barrido», «cubierto», `plan_id`, `version_id`, «pago tardío» y «los tres».
- **Lo que NO cubre**, y se declara para que no se lea como que sí: el quinto modo —**un arreglo
  apoyado en una premisa propia y verdadera que envejece sola** (`F-8cC2-002`)—. Ninguna búsqueda
  de texto lo encuentra, porque el texto es correcto el día que se escribe. La regla que lo cubre
  **ya existe** y es `S-METH-01`; lo que falta es instrumentarla en los checklists irreversibles.
  Queda abierto.
- **Origen**: la FASE 8-bis-2, `18-fase-8-bis-2/C1-la-costura.md` §2.3, la mecánica que `B1`
  propone al cerrar su informe, y la conversación con el owner del 2026-09-20.

---

### DEC-MIG-004 — La población de producción se resuelve por teléfono, no por diseño: es del owner y está cerrada

- **Fecha**: 2026-09-20 · **Estado**: ACCEPTED · **Decide**: owner
- **Complementa `DEC-MIG-003`** («no se migra»): le da el **mecanismo humano** que la hace
  ejecutable, y que hasta hoy vivía sólo en la conversación.
- **Decisión del owner, en sus términos**: la población de producción —usuarios, fichas y pagos—
  **son pocos y son conocidos suyos**. Les habla, les explica qué pasa y **les pide que se
  resuscriban cuando el sistema nuevo esté andando**. No se construye ningún mecanismo de diseño
  para ellos: ni transcripción, ni coexistencia, ni asiento retroactivo, ni crédito automático.
- **Por qué se registra, y no es burocracia**: está medido que **no estaba registrada**, y por eso
  **cada pasada adversarial la vuelve a descubrir como hallazgo**. En la FASE 8-bis-2, **cinco de
  los diecisiete críticos distintos** son la misma preocupación vista desde cinco capítulos. Sin
  esta entrada, la 8-bis-3 los produce de nuevo, y la de después también: el trabajo no se ahorra
  arreglándolos, se ahorra **declarando la decisión que los responde**.
- **Qué retira, nominalmente** (numeración de `18-fase-8-bis-2/C1-la-costura.md` §2.1). Los cinco
  quedan **declarados con causa**, que es lo que `DEC-METH-006` permite, y **no** se arreglan:

  | # | defecto | por qué lo responde esta decisión |
  |---|---|---|
  | **1** | `PB2` no dispara la mañana del corte y la cartera queda publicada sin cobertura | la cartera es la población conocida; se la llama y se resuscribe |
  | **7** | la entidad `listing` no tiene camino declarado al modelo nuevo | no lo necesita: no se transcribe ninguna |
  | **15** | la lápida no existe entre el paso 3 y el paso 4 del corte | el cobro en vuelo es de uno de los tres conocidos |
  | **16** | el paso 1 cancela «los tres» y el conjunto crece con las altas nuevas | mismo remedio, y **⚠️ es el único cuyo sujeto NO es la población medida el 2026-09-15** — ver abajo |
  | **17** | el corte no tiene paso para un período ya pagado, y *«cero pagos»* caduca el 2026-09-26 | si alguien pagó un período, se le resuelve hablando |

- **La salvedad del #16, declarada para que no se lea cubierta de más**: su sujeto son las altas que
  entren **durante** el rediseño, que por construcción **no son las ocho medidas** y pueden no ser
  conocidas del owner. El remedio es el mismo —se las llama— pero la premisa *«son conocidos míos»*
  es de otra población. Si la cohorte nueva crece, quien decide si sigue siendo manejable es el
  owner, y el umbral ya está medido: **unas 20** (`B/21` §2.4, hoy 8).
- **Lo que NO cubre**: los **doce críticos restantes**, que son defectos del sistema nuevo y le
  pasan a gente que todavía no existe. Ésos se arreglan.
- **El dato operativo con fecha, que sobrevive a la decisión**: el **2026-09-26** cae el primer
  cobro de la historia del sistema, bajo el sistema **actual**. No es una pregunta de diseño y no
  vuelve a este log: está en [`04-open-decisions.md`](./04-open-decisions.md) con su 📅.
- **Origen**: decisión sostenida del owner, reafirmada el 2026-09-20 —*«son pocos, son conocidos
  míos a los cuales les puedo hablar, explicarles lo que pasa y pedirles que se resuscriban cuando
  el sistema nuevo esté andando»*—.

---

### DEC-RF-002 — El reembolso del pago pendiente lo confirma una persona: no hay operaciones automáticas sobre dinero

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Alcance**: la primera de las cuatro ramas con que puede terminar una sucesión en curso
  (`B/12` §5.3) — la sucesora autoriza, `S17` mata a la predecesora, y el pago que había quedado
  pendiente por `S19` **se devuelve**. La decisión es **quién lo ejecuta**, no si corresponde.
- **El caso, para que se entienda sin reconstruirlo**: a alguien le rebota la cuota y entra en
  `GRACE_PERIOD`. Cambia de plan para salir del problema, lo que abre una sucesión con una ventana
  de 72 h. Mientras tanto el proveedor **sigue reintentando la cuota vieja por su cuenta** —
  perdonar la deuda no apaga su reciclado— y el cobro entra. En ese instante **todavía no se sabe**
  si la persona va a terminar el checkout, y las dos ramas piden lo contrario: si lo termina el
  pago no le compró nada y se devuelve; si lo abandona, ese pago es **lo único que la salva**. Por
  eso el pago queda pendiente (`S19`) y su destino lo decide **el cierre de la sucesión**.
- **Decisión**: el reembolso **lo confirma una persona**. Al cerrar la sucesión el sistema **pone
  la marca** y el caso entra al canal de conciliación; **no ejecuta el reembolso solo**.
- **Por qué, y son tres reglas ya escritas, no una preferencia**:
  1. `NUCLEO/08` §3 lista *«reembolsar»* entre las acciones que **mueven dinero**, con permiso
     propio y confirmación explícita.
  2. `B/09` §2.4 fija el criterio del owner: *«la línea es "toca plata o no toca plata"»* — y es la
     **cuarta** vez que se aplica.
  3. `S14`: **cero decisiones destructivas automáticas**.
  Automatizarlo habría sido **la primera operación automática sobre dinero de todo el diseño**, en
  un dominio que está vacío a propósito.
- **Y un motivo técnico que empuja igual**: `B/02` §2.3 **no guarda el id del refund**, que `RF-6`
  mide necesario para que un reintento no devuelva dos veces. La rama automática exigía además esa
  columna; la manual no.
- **El costo, aceptado con los ojos abiertos**: la persona **espera a que alguien mire**, y este es
  un camino **normal**, no excepcional, así que va a pasar seguido sobre el camino de recuperación
  que `DEC-SUB-003` diseñó para que no fuera un muro. Se acota **avisándolo en el mismo correo** que
  `B/12` §5.3 ya obliga a reescribir para que nombre las dos ramas (`NUCLEO/07` §6 y `B/19` §4
  fila 15).
- **Lo que NO decide**: las otras tres ramas, que ya estaban resueltas y no devuelven plata —vencer
  la ventana **reactiva**, la sucesión trabada ya tiene un humano mirándola, y el grant *Free
  Forever* no devuelve por `DEC-GRANT-001`.
- **Origen**: la FASE 9-bis-2, familia del pago tardío; el hallazgo `F-8cB3-011`, que midió que el
  reembolso automático contradecía al resto del diseño; y la elección del owner del 2026-09-21
  entre las dos opciones que se le presentaron.

---

### DEC-GRANT-006 — La cortesía es POR SUSCRIPCIÓN: se retira su `scope`, y el §34 del PDR queda desviado a propósito

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el `⚠️` que `B/02` §2.4 había dejado declarado abierto en la FASE 9-bis-2.
- **Decisión**: **`courtesy_grant.scope` se retira de la tabla.** Una cortesía cubre **la
  suscripción que pausa**, y nada más. Para dar cortesía en dos verticales se otorgan **dos
  cortesías**, una por suscripción.
- **Qué NO se pierde, y conviene decirlo porque suena a recorte**: la capacidad de tener a alguien
  con cortesía en varias verticales a la vez **sigue existiendo**. Lo único que se pierde es el
  **gesto único** en el panel. Nadie queda sin poder hacer nada que antes pudiera.
- **El nudo, medido, que es por lo que la columna no hacía nada**: una suscripción es de **una**
  vertical (`B/02` §2.2) y la cortesía transporta la **versión anclada de la suscripción que
  pausa** (`DEC-GRANT-003`), así que emite **una** fuente, en esa vertical
  (`12-contrato…` §2.7, fila `cortesía`). Un `scope` de dos verticales era **una columna que se
  puede escribir y no hace nada** — el mismo modo de falla que `B/16` §2.4 nombra para rechazarlo.
- **Por qué acá se elige lo CONTRARIO que en el grant, que es la pregunta que va a volver**: el
  mismo día, `permanent_grant` se resolvió como **un instrumento con N anclas** y se rechazó «N
  grants» explícitamente. La razón de aquello fue que **revocar es la acción administrativa más
  grave del sistema** (`NUCLEO/08` §3) y con N instrumentos pasa a ser N actos, de los que se puede
  olvidar uno y dejar capacidades regaladas para siempre. **Ese argumento no existe en la
  cortesía: una cortesía se vence sola a los N días.** No hay revocación que se pueda escapar. La
  asimetría no es una inconsistencia — es la misma regla aplicada a dos instrumentos con distinta
  forma de terminar.
- **Desviación declarada del PDR §34**, que pide *«scope configurable, de forma equivalente al
  sistema de Free Forever»* y enumera una vertical / varias / todas las actuales / todas las
  actuales y futuras. **Se desvía a propósito, y la razón es que los dos instrumentos no son
  equivalentes**: el Free Forever **ancla un plan por vertical y no necesita que exista nada
  previo**; la cortesía **pausa algo que ya existe**. Pedirle el mismo scope es pedirle a un
  mecanismo que haga de otro. El §34 describe el resultado deseado por analogía con un instrumento
  cuya mecánica no comparte.
- **Y el hueco concreto que la analogía deja sin respuesta**, que es la prueba de lo anterior: con
  scope plural, **qué hace la cortesía en una vertical donde el beneficiario NO tiene
  suscripción**. El PDR trae media respuesta y en dos mecanismos distintos —**§34.1** *«durante
  trial: extiende el trial»*, **§34.2** *«durante subscription: mantiene servicio sin cobrar»*— y
  **ninguna** para el tercer caso, el de quien no tiene nada en esa vertical, ni siquiera un trial.
  Un instrumento con tres comportamientos según lo que encuentre no es un scope: son tres
  instrumentos con un nombre.
- **Lo que queda fijado y no se revisa**: nadie puede emitir la cortesía en una segunda vertical
  transportando la versión anclada de la suscripción de la primera. Sería el defecto del grant
  (`F-8cA1-002` / `F-8cA3-005`) con otro `tipo`.
- **Si alguna vez se quiere el gesto único**, el camino es **de superficie, no de modelo**: una
  acción del panel que otorgue N cortesías en una transacción, mostrando las N. No vuelve una
  columna al modelo de datos.
- **Origen**: la FASE 9-bis-2, familia del contrato, que lo dejó declarado abierto en `B/02` §2.4
  en vez de resolverlo en silencio; y la elección del owner del 2026-09-21 entre las tres opciones
  que se le presentaron.

---

### DEC-TRIAL-008 — Quien tiene una suscripción que NO cubre recibe su trial: la frontera no transporta un segundo hecho

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** lo que la FASE 9-bis-2 dejó declarado abierto en `V/03` §2 y en `12-contrato…` §4.
- **Decisión**: se deja como está. **`T1` y `T6` se deciden únicamente por `cubierto`**, y quien
  tiene una suscripción en un estado que **no emite fuente** recibe su trial. **El contrato NO gana
  un segundo hecho.**
- **El caso, para no reconstruirlo**: de los diez estados de la suscripción, los que no emiten
  fuente (`12-contrato…` §2.6) dan `cubierto` falso y disparan `T1`, que arranca el trial. Para
  cuatro —`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` y no tener fila— es trivialmente correcto.
  De los otros tres, **dos son correctos sin matices**: `PENDING_AUTHORIZATION` (el contrato ya
  declara que esa fila *«no vale nada»* porque el checkout se puede abandonar) y `PAUSED` por
  `CUSTOMER_REQUEST` (*«el servicio está detenido»*, `B/16` §2.2). **El tercero es la concesión**:
  alguien `SUSPENDED` por impago que **nunca publicó en esa vertical** recibe los días de trial
  que habría recibido igual si no hubiera contratado nunca.
- **Por qué la concesión es aceptable, y está acotada por el propio diseño**: es **su único trial
  de por vida**, no uno extra; si regulariza, `T2` lo convierte; si no regulariza, `T3` lo vence,
  `PB2` lo despublica y **no le queda nada**.
- **Por qué se rechaza la alternativa**, que era darle a verticales un bit tipo *«hay un vínculo de
  suscripción no terminal»*:
  1. **Es la frontera creciendo.** `DEC-ARCH-006` fija que el contrato es uno solo, y el §4.2 del
     contrato tiene una regla de vigilancia precisamente para esto. Un bit que diga *«este tiene
     algo no terminal»* **es un estado de cobranza con otro nombre**, y el día que exista alguien
     escribe la segunda regla de producto encima. Es una puerta, no una excepción.
  2. **Empeora dos casos para arreglar uno.** La alternativa alcanza a los tres, incluidos los dos
     que hoy están bien resueltos.
  3. **Y comercialmente va al revés de la intuición.** Quien está `SUSPENDED` **ya no está
     pagando**: darle un trial en una vertical nueva no cuesta ingreso —no hay ingreso que
     perder— y es la única vía por la que esa persona podría volver. Bloquearla protege un ingreso
     inexistente y cierra la puerta de vuelta.
- **Lo que esto NO autoriza**: distinguir sólo a `SUSPENDED` sería la peor versión de la
  alternativa, porque es literalmente una señal de deuda cruzando a verticales. Queda rechazada con
  el resto.
- **Origen**: la FASE 9-bis-2, familia del trial, que lo dejó declarado abierto en vez de
  resolverlo en silencio; los hallazgos `F-8cA3-001` (rama 1) y `F-8cA1-012`; y la elección del
  owner del 2026-09-21 entre las dos opciones que se le presentaron.

---

### DEC-METH-010 — El grep no falla al buscar sino al resolver: la resolución se escribe POR APARICIÓN, y el alcance es todo el corpus

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Enmienda `DEC-METH-009`**, que no cortó el generador. No la deroga: **su caso de diseño
  funciona y está fechado** — el mensaje de `f5731fd65` registra que la regla encontró que `B/12`
  seguía con la condición histórica de `S16` que `B/03` ya había reemplazado, y esa contradicción
  **no llegó** a la pasada siguiente.
- **Problema, medido en la FASE 8-bis-3**: **85 hallazgos, 18 IDs `CRITICA`, 14 defectos críticos
  distintos**, y **13 de los 14** los introdujo la tanda de arreglos anterior. La serie completa:

  | | 8-bis | 8-bis-2 | 8-bis-3 |
  |---|---|---|---|
  | críticos distintos | — | 17 | **14** |
  | atribuidos a la tanda anterior | 25/25 (A y B) | 17/17 | **13 de 14** |

- **El diagnóstico, y es distinto del que motivó `DEC-METH-009`**: **el paso que falla es el 3, la
  resolución, no el 2, la búsqueda.** El grep alcanzaba **5 de los 14**, y **al menos 2 de esos 5
  pasaron con la regla declarada corrida y con cifras**. Medido en `19-fase-8-bis-3/C1-la-costura.md`
  §4.3: `1ca12d709` declaró haber grepeado el `scope` del grant y dejó viva `NUCLEO/01` §5
  (*«con su scope de verticales»*) en un archivo que no tocó; `3692d5deb` declaró *«23 de sucesora
  y predecesora declaradas correctas»* y dejó viva `B/14` §2.2 (*«la sucesora lo hereda»*), que es
  un `CRITICA` — con **14 apariciones fuera del commit** contra 23 declaradas. **Una resolución en
  bloque no es falsable; una por aparición sí.**
- **Decisión, y son tres enmiendas más una condicional. Van juntas y el orden importa:**
  1. **El alcance es TODO EL CORPUS, y la unidad es el PÁRRAFO, no el archivo.** Donde
     `DEC-METH-009` dice *«los capítulos que el commit NO toca»*, va *«todo el corpus —las dos
     épicas, el núcleo, el contrato, el corte, la partición, los `spec.md`, las `descomposicion.md`
     y este log—, **incluidos los archivos que el commit toca**, porque un archivo abierto no es un
     párrafo leído»*.
  2. **La obligación 3 se cumple por escrito y POR APARICIÓN.** Para cada aparición **que no se
     corrige**, se deja el archivo, el § y **por qué sigue siendo correcta**. **Versión acotada, que
     es la que se adopta**: se escriben las que no se corrigen **y están en un párrafo que el commit
     no tocó** — que es donde vive el riesgo. En `3692d5deb` habrían sido pocas, y una de ellas la
     de `B/14`.
  3. **Se grepea también el término VIEJO, el que se retira**, no sólo el nuevo. El consumidor que
     no se actualizó **no aparece buscando el nombre nuevo**, y ése es justamente el conjunto donde
     viven los defectos que el arreglo vino a corregir.
  4. **Condicional, y sólo con la 2 encima**: cada término que el núcleo define lleva **su lista de
     consumidores**, y un arreglo que crea un consumidor nuevo **agrega la fila antes de declararse
     aplicado**. Se adopta **junto con la 2 y no antes**, por la razón del punto siguiente.
- **Por qué la 1 sin la 2 EMPEORA el problema, y por eso no se adopta suelta**: `49eb99f34` reportó
  110 apariciones con el alcance chico. Con el corpus entero el número crece, y **un arreglo que
  tenga que resolver 300 apariciones va a declarar correctas las 290 que no miró** — que es
  exactamente el modo que produjo el crítico. Ampliar el alcance sin cambiar cómo se resuelve
  multiplica el agregado no falsable.
- **Por qué la 4 es condicional y no incondicional**: mantener listas en el núcleo es **la misma
  clase de conteo que esta pasada encontró roto cinco veces** (`F-8dA2-009`, `F-8dA2-010`,
  `F-8dA3-009`, `F-8dB2-012`, `F-8dC1-005`), y **el precedente es malo**: la única lista que existe
  —`NUCLEO/01` §2.4, los predicados que usan *«fila viva»*— **quedó corta en el mismo commit que
  creó su sexto miembro**. Una lista que se olvida es peor que no tenerla, porque afirma
  completitud. Con la 2 encima se actualiza en el mismo acto en que se escribe la resolución.
- **Lo que las cuatro juntas NO cierran, declarado en voz alta**: **«el capítulo que nunca nombró
  el término»**. `V/11` es el dueño del §10.2 (*«el trial no vuelve»*) y **no contiene `T6` ni una
  vez**; ninguna búsqueda por término, viejo o nuevo, en ningún alcance, lo devuelve. Lo único que
  lo encuentra es recorrer el dominio **por el eje del tiempo** —*«¿qué pasa el día que la
  configuración cambie?»*—, que es la obligación 1 de `DEC-METH-008` con un eje más. **No es una
  regla de búsqueda y no se finge que estas cuatro lo cubren.**
- **Y un dato que la regla necesita y el programa no publica**: **qué archivos toca cada commit**.
  Dos de los siete informes de la 8-bis-3 contestaron mal *«¿lo habría encontrado el grep?»* porque
  midieron contra el conjunto equivocado. Hasta que se publique, la respuesta se verifica con
  `git show --name-only`.
- **Origen**: la FASE 8-bis-3, `19-fase-8-bis-3/C1-la-costura.md` §4.5, y la elección del owner del
  2026-09-21 entre las tres opciones que se le presentaron — eligió **correr la tanda completa con
  la regla corregida y volver a medir**, por encima de la pasada acotada que se le recomendó.

---

### DEC-TRIAL-009 — Revocar un grant NO devuelve el trial: se declara en la confirmación y no se repara

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el defecto crítico #1 de la FASE 8-bis-3 (`F-8dA1-001`), que la 9-bis-3 dejó sin
  arreglar a propósito por ser una decisión de producto.
- **El caso**: recibir un *Free Forever* **consume el trial** de esa vertical —`T2` si estaba
  corriendo, `T6` si todavía no—, porque las dos transiciones se disparan ante cualquier fuente
  viva de clase `TÍTULO` y un `GRANT` lo es. **Revocar el grant no lo devuelve**: no hay
  transición de vuelta y el §10.2 no admite excepciones. El beneficiario queda **sin grant, sin
  suscripción y sin trial**, así que si quiere seguir paga desde el primer día — y el acto que lo
  dejó así **lo firmamos nosotros**.
- **Decisión**: **no se repara. Se declara.** La confirmación de revocar dice, además de que corta
  el servicio, que **el trial ya está consumido y no vuelve** (`NUCLEO/08` §3.1).
- **Las dos alternativas, y por qué se descartan:**
  - **Que el grant no queme el trial** (`T2`/`T6` excluyen las fuentes `GRANT`): reabre por otra
    puerta el defecto que la 9-bis-2 acababa de cerrar — conviven dos fuentes `TÍTULO` y el trial
    deriva del plan vendible de `rank` más alto, que puede otorgar **más** que el plan anclado. Y
    en `T2` el reloj sigue corriendo igual, así que el trial se pierde solo salvo que además se
    pause, cosa que el §26 prohíbe.
  - **Reparar con una cortesía** por los días no usados sobre la primera suscripción que tome: es
    lo que el agente recomendó, aplicando el patrón del `V/11` §2.3. El owner eligió no hacerlo.
- **La razón por la que esto NO contradice al `V/11` §2.3, y va escrita porque es el caso que más
  se le parece.** Ahí el diseño repara *«porque el daño lo hicimos nosotros»*, y acá también lo
  hicimos nosotros. La diferencia son **dos cosas que hay que leer juntas**:

  | | la moderación equivocada (§2.3) | la revocación de un grant |
  |---|---|---|
  | qué fue el acto | **un error** | **una decisión legítima y deliberada**: se termina una concesión que nunca se debió |
  | qué recibió la persona | **nada** | **la cobertura completa del plan anclado**, todo lo que duró el grant — estrictamente más de lo que un trial da |

  **El trial no se perdió: se gastó, y se gastó recibiendo algo mejor.** Es la lectura literal de
  por qué `T6` existe —quien está cubierto no necesita una prueba— y acá la persona **estuvo
  cubierta de verdad**. Reparar sería devolverle una prueba a alguien que ya tuvo el producto
  entero.
- **Lo que esto NO autoriza**: leerlo al revés sobre la moderación equivocada. Ahí la persona **no
  recibió nada** y el acto **fue un error**, así que la reparación del §2.3 —extensión por `T4` si
  el trial vive, cortesía si venció— **sigue intacta**.
- **El costo aceptado, dicho en voz alta**: la confirmación le avisa **al que revoca**, no al que
  pierde. Quien recibe la revocación se entera cuando intenta seguir usando la plataforma.
- **Origen**: la FASE 8-bis-3, hallazgo `F-8dA1-001`; la familia del trial y el grant de la
  9-bis-3, que lo declaró abierto en vez de elegir; y la elección del owner del 2026-09-21 entre
  las tres opciones que se le presentaron — eligió la 3 por encima de la 2, que era la recomendada.

---

### DEC-DATA-002 — La pausa no borra la ficha: `ARCHIVED` tiene vuelta, el reloj se reinicia, y la garantía es un invariante y no una desigualdad suelta

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** `F-8cC1-001`, `CRITICA` abierto desde la FASE 8-bis-2. **Extiende `DEC-DATA-001`**,
  que queda con dos precisiones: sus *«dos avisos»* ahora son **tres**, y su promesa de que el
  cliente *«puede reactivarla»* **por fin tiene las dos filas que la ejecutan**.
- **El defecto**: un cliente pausa —hasta **4 pausas-mes**, función del catálogo—, su ficha se
  baja, al **día 90** `PB4` la archiva, **`ARCHIVED` no tenía ninguna transición que lo tuviera en
  `desde`**, y al **día 180** el hard delete le borraba el contenido. A alguien que **no canceló
  nada y usó algo que le vendimos**. Dos agravantes medidos: *«inactividad»* aparecía **una sola
  vez en todo el corpus**, sin definición; y dos documentos prometían en una nota que se *«puede
  reactivar»*, promesa que ninguna tabla ejecutaba y sobre la que `V/02` §4.2 apoyaba su defensa
  del borrado.
- **El criterio del owner, textual**: *«si el cliente pausó, el reloj de inactividad no corre; la
  pausa fue deliberada, así que no le podemos borrar la ficha por algo que le dijimos que podía
  hacer»*.
- **Decisión, y son cuatro piezas:**
  1. **`PB7`** (`ARCHIVED` → `PUBLISHED`, al volver `cubierto` y haber cupo) y **`PB8`**
     (`ARCHIVED` → `DRAFT`, el dueño la reactiva). Son **dos** porque a `ARCHIVED` se entra por dos
     puertas y una vuelta automática ciega publicaría el borrador de `PB5`. El origen sale del
     evento de dominio, **sin columna nueva**.
  2. **«Inactividad» queda definida**, con **cuatro hechos de reinicio** y lista cerrada: un acto
     del dueño, **`cubierto` pasando a verdadero**, volver a `PUBLISHED`, y el fin de servicio de
     una vertical discontinuada. Lo que se retira no es una palabra: es **que el reloj fuera
     monótono**.
  3. **El reinicio cuelga del HECHO, no de la transición**: si el cliente vuelve con un plan más
     chico y el cupo no alcanza, el reloj se reinicia igual. Atarlo a `PB7` dejaba el borrado vivo
     justo para el que vuelve peor.
  4. **Tercer aviso, «al archivar»**, en el catálogo de correos, más la superficie que dice al
     pausar qué le pasa a la ficha.
- **Cómo se satisface el criterio del owner SIN mover la frontera, que es lo que esta decisión
  tiene de no obvio.** Tomado al pie de la letra, *«el reloj no corre durante la pausa»* exige que
  verticales **vea** la pausa — y una `PAUSED` por `CUSTOMER_REQUEST` **no emite ninguna fuente**,
  así que sería el segundo hecho cruzando la frontera que **`DEC-TRIAL-008` rechazó dos días
  antes**. Se buscó la vía del `T7` (leer el registro de eventos de la propia vertical) y **no
  existe**: cuando arranca una pausa la única fuente que desaparece es `tipo: SUSCRIPCIÓN`,
  exactamente igual que en una baja o una suspensión, y el §3 del contrato empuja *«qué fuente
  cambió y en qué dirección»*, que no separa las tres.

  **Lo que se implementó es equivalente en el resultado, y conviene decir que no es idéntico: el
  reloj SÍ corre durante la pausa, y se reinicia al reanudar.** El daño residual es **cero**, y por
  una razón aritmética: el tope de una pausa son **4 pausas-mes ≈ 120 días** contra los **180** del
  hard delete, y cada reanudación reinicia — así que las pausas encadenadas tampoco acumulan. La
  ficha se archiva, sí, pero **vuelve sola por `PB7`** y **nunca se borra**.
- **`D16`, y es la pieza que evita que todo esto sea una premisa que envejece sola**: *«el tope de
  una pausa, en días, es menor que el día del hard delete»*, con guard `G-R5` que compara las dos
  cifras y falla si la primera alcanza a la segunda. **Las dos son configuración**, así que el
  invariante es **la relación** y nunca los números. Sin `D16`, todo el arreglo descansa en una
  desigualdad entre dos valores que nadie vuelve a mirar — que es exactamente el quinto modo de
  falla que `DEC-METH-010` declara **no cubierto** por ninguna búsqueda.
- **Lo que NO se hizo, y por qué**: enmendar `DEC-TRIAL-008`. La mitad (a) tomada literalmente
  cuesta la frontera y **no compra nada que la vuelta de `ARCHIVED` no dé**. `DEC-TRIAL-008` sale
  **reforzada**.
- **Tres descartes escritos**: definir inactividad sobre la actividad del dueño a secas (archivaría
  la ficha publicada de un cliente que paga y no la edita); usar `UNPUBLISHED_BY_BILLING` como
  causa (no distingue pausa de baja, y sacarlo del `desde` de `PB4` mata la retención para el que
  sí se fue); y que la pausa emita una fuente no-cubriente (es literalmente el bit de
  `DEC-TRIAL-008`, y además le rompe el trial).
- **Origen**: `F-8cC1-001` (FASE 8-bis-2, `C1-la-costura.md` §1), y la decisión del owner del
  2026-09-21 sobre sus dos mitades.

---

### DEC-ADDON-003 — El grant con `includesAddons` convierte a $0 el addon YA comprado, y al revocar se apaga sin reparación

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: el §35.2 dice que con `includesAddons: true` los addons compatibles *«pueden
  utilizarse a costo $0»*, y `B/16` §3.2 agrega *«habilita; no enciende»*. **Las dos frases están
  escritas sobre el addon que TODAVÍA NO EXISTE** — alguien con el grant que después quiere un
  destaque. **Nadie escribió qué pasa con el que la persona YA TENÍA COMPRADO** el día que le cae
  el grant. Con `S13` acotado a *«toda fila viva PRINCIPAL»* (commit `4e383480d`), **su suscripción
  de complemento seguía viva y seguía cobrando**: se le debitaba todos los meses un addon que el
  flag le había declarado gratis.
- **Decisión, y son dos mitades:**
  1. **Al otorgar el grant —y al anclarle una vertical, que es el otro disparador—, se convierte a
     $0**: se cancela la suscripción de complemento y la instancia pasa a colgar del ancla como su
     título.
  2. **Al revocar el grant NO pasa nada**, en el sentido de que **no se repara**: no se reanuda el
     débito viejo ni se emite compensación. El addon **se apaga con el resto**, y *«si lo quiere de
     nuevo, debe volver a suscribirse»*. Es deliberadamente la misma regla que `DEC-GRANT-001` y
     `DEC-TRIAL-009`: revocar corta el servicio y no repara.
- **El mecanismo es una transición propia, `S20`, y NO una ampliación de `S13`.** Ampliar el
  `desde` de `S13` reabriría la acotación *«principal»* que el commit `4e383480d` acababa de poner
  para cerrar el crítico #8, y `S20` además **evalúa una condición** (la compatibilidad), que es lo
  que el §41 exige. `B/03` §3.2.
- **Las cinco cosas de mecánica que la decisión no cubría, resueltas con su razón:**
  1. **Compatibilidad**: no se reinterpreta. Es lo que el §39 hace declarar al **producto**. `S20`
     alcanza al complemento cuyo producto declara compatible **la vertical que el acto ancla**.
     **El no compatible sigue cobrándose**, porque el grant es título **sólo donde ancló**.
  2. **El período ya pagado no se reembolsa** (`DEC-GRANT-001`), y un `UNA_VEZ` no tiene nada que
     convertir ni que devolver.
  3. **La fuente no cambia de forma**: sigue transportando `addon_instance.addon_version_id` y
     nunca `addon_product.version_id` — convertir a $0 **no es volver a comprar**. Lo que cambia de
     referente es el **título**, y como el §2.3 no admite una fuente sin referencia resoluble, la
     instancia registra **el ancla**, no *«el grant»*.
  4. **La instancia**: una `ACTIVE` no cambia de estado; una `PENDING_AUTHORIZATION` no se
     convierte —no hay nada comprado— pero su cobro se cancela igual. **La condición de huérfano
     no se toca: sigue con tres mitades.**
  5. **El detector**: la tabla de puertas a un terminal pasa de **siete a ocho** y la salvedad 4 de
     cuatro a cinco filas. Las comprobaciones de cero llamadas **siguen siendo cuatro**: se
     ampliaron dos, no se agregó ninguna.
- **Dos huecos preexistentes que este acto obligó a cerrar, y conviene saber que se cerraron acá**:
  `B/16` §3.3 (*«al revocar, el addon se corta»*) **no tenía transición para 3 de los 4 scopes** —en
  `LISTING`, `USER` y `GLOBAL` el objetivo nunca muere, así que la orfandad no llegaba nunca—, y lo
  cierra la tercera cláusula del evento de `A5`. Y **`F-8dA3-007` queda medio cerrado**: la columna
  del título que `B/16` §3.1 daba por existente **no existía**, y se escribió nombrando el hallazgo
  para que quien lo tome no agregue una segunda.
- **Lo que queda declarado abierto y NO se resolvió**: un addon de scope `USER`/`GLOBAL` compatible
  con **dos** verticales, en alguien cuyo grant ancla **una**, se convierte igual y queda gratis
  **también en la vertical que el grant no ancló**. Es la lectura literal del §35.2. Acotarlo
  —exigir que el grant ancle todas las verticales que el producto declara— es una decisión de
  producto y está declarada en `B/16` §3.4, sin tomar.
- **Origen**: la disyuntiva que la familia de `S13` de la 9-bis-3 declaró abierta en `B/03` §3.2 y
  `B/02` §2.6, y la elección del owner del 2026-09-21 entre las dos opciones que se le presentaron
  — eligió la 2, que era la recomendada, y contestó de entrada la pregunta que arrastraba.

---

### DEC-ADDON-004 — El complemento que se queda sin instancia muere en el acto: `CANCELLED`, sin período de gracia

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: un addon recurrente tiene **dos cosas separadas** — la **instancia** (la capacidad
  encendida) y la **suscripción de complemento** (el débito, con preapproval propio,
  `DEC-ADDON-002`). Cuando el addon queda huérfano, el diseño decía qué pasa con la instancia —`A5`
  la apaga— y **no decía en qué estado queda la suscripción**: ninguna transición la llevaba a un
  terminal por esa causa. Agravante medido: **el barrido la seleccionaba por el estado terminal de
  su INSTANCIA**, así que el proceso que la vigila la encontraba por un lado y ella misma no tenía
  estado declarado por el otro.
- **Decisión**: **`CANCELLED` en el acto**, junto con la instancia. **Sin período de gracia y sin
  sostener servicio.**
- **Por qué NO se aplica el patrón de `DEC-SUB-009`** (cancelar en el proveedor de inmediato y
  sostener el servicio hasta el fin del período pagado), que era la alternativa. Tres razones:
  1. **la capacidad ya la apagó `A5`**: no hay servicio que sostener, sólo la fila de un cobro;
  2. el contrato **ya descarta los `COMPLEMENTO` sin `TÍTULO` vivo** (`V/15` §2.6), así que
     sostenerlo no devolvería nada al pliegue;
  3. el costo sería un `CANCEL_SCHEDULED` **con reloj y fecha de fin de servicio sobre un estado
     vacío** — una fila que el barrido tiene que seguir mirando a cambio de nada.

  Dicho corto: **el addon complementa algo que ya no está.** Sostener días de un destaque sobre una
  ficha despublicada no le da nada a nadie.
- **El período pagado no se reembolsa automáticamente**, y va escrito, no implícito
  (`NUCLEO/08` §3, `B/09` §2.4, `S14`). Si corresponde devolver, va por **`DEC-RF-002`** — con su
  confirmación humana. La máquina no sostiene un estado vacío para compensar plata.
- **Es una fila propia, `S21`, y no un efecto de `A5`.** La escritura es sobre la columna de estado
  de una **suscripción**, y una de complemento usa **esa misma máquina**: un efecto de la tabla de
  addon que moviera esa columna es exactamente lo que la **regla 1 de `NUCLEO/03`** no admite.
  Precedente del mismo día: `S20` también lo dispara un acto de otra entidad y también es fila
  propia.
- **El evento se ata al estado de llegada de la instancia, no a un predicado**, y eso es lo que lo
  hace cubrir las dos puertas de la orfandad: las **tres cláusulas de `A5`** confluyen en la
  instancia llegando a `CANCELLED`. **Y alcanza también a `A6`** (la ficha borrada), porque
  excluirlo recreaba el mismo hueco por otra puerta y la razón del owner aplica idéntica.
- **La llamada al proveedor es UNA**: el preapproval de la instancia **es** el de la suscripción de
  complemento (`DEC-ADDON-002`). `S21` **no manda nada** al proveedor — escribe el estado local que
  faltaba. Ni duplicada ni omitida.
- **En el barrido**: las puertas a un terminal pasan de **ocho a nueve**, con `S21` **no exenta**
  (la dejó sin cobrar una llamada nuestra y no tiene rama de fallo). Entra por la **salvedad 1**,
  que ahora **puede nombrar su sujeto directamente** — y la selección por el estado de la instancia
  **no sobra**: es la única que ve la corrida que ejecutó `A5` y no llegó a `S21`.
- ~~**Una tensión previa que este arreglo NO resuelve y queda a la vista**: `12-contrato…` §2.8
  dice que *«desanclar no está declarado»* y `B/16` §4.3 enumera como cuarto momento de
  re-evaluación *«se revoca el grant, o **se retira el ancla de esa vertical**»*.~~ **RESUELTA el
  mismo día por `DEC-ADDON-006`**: el enunciado pasa a nombrar la revocación, que es un acto
  declarado. Se deja tachada y no borrada porque la nota es lo que motivó esa decisión.
- **Origen**: el hueco que la familia de `S13` de la 9-bis-3 dejó nombrado en `B/09` §3 y que la de
  `includesAddons` confirmó abierto, y la elección del owner del 2026-09-21 entre las dos opciones
  que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-SUB-012 — El que paga después de que lo dimos por perdido se reabre, y el tope no es un plazo: es la condición que ya existía

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: `DECLARED_UNPAID` es donde queda un pago manual cuando un admin *«confirma que no
  se pagó»* (§30), y **la máquina no tenía ninguna transición que lo sacara**. Un cliente que
  transfiere dos semanas después dejaba la plata en la cuenta **sin desenlace**. Es el camino
  normal del que se atrasa y después paga, no un caso raro de sucesión.
- **Decisión**: **se puede reabrir.** `MP4` (`DECLARED_UNPAID` → `REGISTERED`) reactiva la
  suscripción.
- **Por qué acá se reabre y en las otras dos decisiones de esta misma semana no.** En
  `DEC-TRIAL-009` (revocar un grant) y `DEC-ADDON-003` (su addon) **nosotros** terminábamos algo
  deliberadamente y **la persona no había puesto plata nueva**. Acá **la persona puso plata**, y
  hacerle repetir el trámite es fricción sobre alguien que está tratando de volver — lo contrario
  de lo que `DEC-SUB-003` eligió al hacer del camino de recuperación *«una salida del problema en
  vez de un muro»*.
- **El tope: se propuso el día 180 y NO cierra.** El orquestador propuso acotar la reapertura a
  *«mientras la ficha no se haya borrado»*, por ser un límite ya existente. Se verificó y falla por
  tres razones, las tres contra el texto:
  1. **es el reloj de la ficha y el sujeto es la suscripción** — una principal cubre **todas** las
     fichas de su vertical, así que un anfitrión tiene N relojes y ninguno es *«el suyo»*; y el
     pagador manual es justo el que menos lo tiene, porque el §17.2 lo admite en **Partner**, cuya
     presencia *«no es una ficha»*;
  2. **`DEC-DATA-002` acaba de volverlo no-monótono** — cuatro hechos de reinicio, el primero *«un
     acto del dueño sobre la ficha»*. Un tope que se reinicia solo no es un tope;
  3. **crea una segunda dependencia sobre una cifra que `G-R5` no vigila**, porque ese guard
     compara sólo tope-de-pausa contra hard-delete.
- **El tope que rige ya estaba escrito, y no es un plazo**: es la **condición 1 de `B/05` §3** —*la
  suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED`*—, la misma que `S7` ya exige. **Cierra
  con actos, no con el calendario**: cancelar la suscripción (una de las doce acciones
  administrativas) o `S13`. **Lo que NO acota, dicho en voz alta**: una `SUSPENDED` de pagador
  manual que nadie cancela **es reabrible indefinidamente**, porque sin preapproval el espejo del
  §10.1 nunca la alcanza.
- **Las cuatro cosas de mecánica, resueltas:**
  1. **Fila propia `MP4`**, no `MP1` ampliado: los efectos difieren de verdad (`S5` desde grace,
     `S7` desde suspendida). `G-R4` sigue contando **tres** pares.
  2. **Va a `ACTIVE` directo, y es seguro por construcción**: el pagador manual **no tiene débito
     en el proveedor**, así que `PA-5` no tiene sujeto; y si lo hubiera y estuviera cancelado, la
     fila ya no estaría en `SUSPENDED` —el barrido diario la lee y el espejo del §10.1 la habría
     llevado a `CANCELLED`—, donde la condición 1 la rechaza sola.
  3. **Lo adeudado**: `B/12` §5.3 (*«la deuda vieja no se persigue por separado»*) **no aplica**,
     porque su población no existe acá: allá el cliente **deja atrás** la cuota y acá **la paga**.
     No hay remanente ni recargo. Lo que sí se hereda entero es que **no reactiva durante una
     sucesión**: queda pendiente por `S19`.
  4. **El barrido no cambia**: sus nueve puertas y sus cuatro salvedades son sobre terminales **de
     una suscripción**, y `DECLARED_UNPAID` es del `manual_payment` — nunca estuvo ahí. Las doce
     acciones administrativas tampoco: `MP4` es *«registrar un pago manual»* desde otro origen.
- **Una decisión de producto que esto NO resuelve y queda declarada abierta**: **quién crea las
  cuotas de un pagador manual y cuándo** — qué pasa con los períodos que transcurren mientras la
  suscripción está `SUSPENDED`. Es **anterior** a `MP4` (`F-8B2-018`: la máquina tampoco declara
  hoy la entrada a `AWAITING`) y `MP4` **no la agrava**, porque no crea filas de `manual_payment`:
  sólo mueve la que `MP2`/`MP3` cerraron.
- **Origen**: el hueco que la familia del pago manual de la 9-bis-3 dejó declarado abierto en
  `B/03` §3.2, y la elección del owner del 2026-09-21 entre las tres opciones que se le presentaron
  — eligió la 1, que era la recomendada.

---

### DEC-ADDON-005 — La fuga del addon `USER`/`GLOBAL` SE DEJA, y está decidido: no es un pendiente

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso**: un addon de scope `USER` o `GLOBAL` compatible con **dos** verticales, en alguien
  cuyo grant ancla **una**, se convierte a $0 por `S20` —porque *es* un addon compatible— y **queda
  gratis también en la vertical que el grant no ancló**.
- **Decisión: se deja así.** `B/16` §3.4 pasa de *«es una decisión de producto y no se toma acá»* a
  una decisión cerrada, con su causa. **No queda como abierto de `DEC-METH-006`, porque no depende
  de nada**: está elegida.
- **Las tres razones:**
  1. **Es la lectura literal del §35.2.** *«Compatible»* es lo que el **producto** declara (§39);
     acotarlo pediría una **tercera noción** de compatibilidad que ningún § escribe.
  2. **La población pide cuatro condiciones simultáneas**: que el addon sea de scope `USER` o
     `GLOBAL`, que su producto declare dos o más verticales, que el beneficiario lo tenga
     comprado, y que su grant ancle sólo una de ellas.
  3. **Acotarla cuesta más que la fuga**: ataría el acto de otorgar al catálogo de addons del
     beneficiario y obligaría a `S20` a releer el producto — que es justo lo que *«convertir a $0
     no es volver a comprar»* prohíbe.
- **Y no es indefinida**: **se apaga con el grant**, por la tercera cláusula de `A5`
  (`DEC-ADDON-006`).
- **Origen**: declarada por la familia de `includesAddons` en `B/16` §3.4, y la elección del owner
  del 2026-09-21.

---

### DEC-ADDON-006 — La tercera cláusula de `A5` nombra la REVOCACIÓN, porque desanclar no existe

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El defecto**: el evento de `A5` decía *«se retira el ancla que era su título»*, y **retirar un
  ancla no existe en ningún catálogo**: `NUCLEO/08` §3 declara para el grant exactamente **tres**
  escrituras —otorgar, anclarle una vertical nueva, revocar— y la palabra *«desanclar»* **no
  aparece en todo el corpus**. Era una transición esperando un acto que nadie puede producir.
- **Decisión**: la cláusula **se conserva y cambia de enunciado** — pasa a decir **«se revoca el
  grant del que cuelga el ancla que era su título»**. Se descartó declarar el acto de desanclar,
  que era la otra opción y arrastra un acto administrativo nuevo con todo lo que eso implica.
- **Por qué la cláusula NO se borra, que es lo que parecía más simple y es lo peligroso**: es **lo
  único que apaga el addon cuando se revoca el grant, para 3 de los 4 scopes**. En `LISTING`,
  `USER` y `GLOBAL` el objetivo del addon **nunca muere** —la ficha sigue ahí, la cuenta sigue
  ahí—, así que la condición de huérfano **no se cumple jamás**. Sin ella, revocar dejaba al addon
  convertido **funcionando gratis para siempre** y sin suscripción, porque `S20` se la canceló al
  convertirlo.
- **Por qué el enunciado nuevo cubre lo mismo, verificado**: revocar es *«UNA revocación»* sobre
  *«UN instrumento con UN ANCLA POR CADA VERTICAL»* (`12-contrato…` §2.8), o sea **retira todas
  las anclas a la vez**. Y **no hay otro acto que retire un ancla**: otorgar crea y anclar
  **agrega**.
- **Una premisa que esto vuelve falsa, y se retiró**: `B/02` §2.4 justificaba apuntar la columna al
  ancla y no al grant con dos razones, y **la segunda** —*«retirar una vertical cortaría los addons
  de las otras»*— **describía el acto inexistente**. Se retira; la primera alcanza sola (saber **en
  qué vertical** el addon es gratis). **La columna sigue apuntando al ancla: el modelo no cambia.**
- **Origen**: la tensión que `DEC-ADDON-004` dejó nombrada, verificada contra el texto por el
  orquestador —que había propuesto mal la opción de borrar la cláusula—, y la elección del owner
  del 2026-09-21 entre las dos opciones corregidas.

---

### DEC-SUB-013 — La cuota del pagador manual la abre un reloj, y no se abre mientras está suspendido

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**, que es `F-8B2-018` y es anterior a esta semana: la máquina del pago manual tenía
  **cuatro salidas** —`MP1` a `MP4`— y **ninguna entrada**. **Nadie había declarado quién crea la
  fila `AWAITING` ni cuándo.**
- **Decisión, las dos mitades:**
  1. **La abre un reloj**, al inicio de cada período — el mismo instante en que el proveedor habría
     cobrado. **No la abre un admin a mano**: una cuota que nadie crea es **servicio gratis
     silencioso**, y no falla ruidosamente.
  2. **No se abre mientras la suscripción está `SUSPENDED`.** El que vuelve paga **el período que
     arranca**, no los que pasó suspendido.
- **Por qué la mitad (2), y no es una concesión suelta**: es lo que el diseño ya decidió dos veces
  — `B/12` §5.3 (*«la deuda vieja no se persigue por separado»*) y `DEC-SUB-012` (el que paga tarde
  paga **esa** cuota, no un remanente)— y es coherente con `DEC-SUB-003`: que volver sea *«una
  salida del problema en vez de un muro»*.
- **`MP5`**, la fila nueva: *(sin fila)* → `AWAITING`, evento *«un reloj abre el período»*. La
  máquina **sigue teniendo tres estados**, porque *(sin fila)* vive afuera de la columna, igual que
  en la de suscripción.
- **Corre SÓLO sobre `ACTIVE`**, y los otros cinco vivos tienen su razón escrita:
  `PENDING_AUTHORIZATION` porque el período lo arranca `S2`; `GRACE_PERIOD` ~~porque el período no
  avanza hasta que entra el pago y~~ porque **la cuota ya existe**; `CANCEL_SCHEDULED` porque ningún período
  nuevo empieza antes de `S12`; `SUSPENDED` por la decisión; y `PAUSED` por el punto siguiente.
  - ***Enmendado el 2026-09-21 por la FASE 9-bis-4 (crítico `F-8eB1-002`).*** La mitad tachada era
    falsa: **el período sí avanza**, y lo avanzan `MP1` y `MP4` al quedar registrada la cuota. La
    conclusión —que `MP5` no corra sobre `GRACE_PERIOD`— **no cambia**, y se sostiene entera con la
    mitad que quedó: ahí la cuota ya existe, y `MP5` es idempotente por esa misma condición.
- **La pausa no contradice a `B/06` §7** (*«un pago manual mensual no tiene nada que pausar»*), y
  por dos razones distintas: `CUSTOMER_REQUEST` tiene **población vacía** —`S8` exige
  `puedePausar()`, que da `false`—, y `COURTESY` sí existe, y ahí **no abrir cuota es lo que la
  cortesía significa**: sobre un pagador manual la mitad *«pausar en el proveedor»* de
  `DEC-GRANT-003` no tiene sujeto, así que lo único que queda es no pedirle la plata.
- **Al reabrir por `MP4`, el período se RE-ANCLA al instante de la reactivación.** ~~No es una
  elección: con el ancla vieja el reloj crearía de golpe todo el atraso que la mitad (2) mandó no
  crear.~~ Es específico de esa puerta y **no se escribe en `S7`**, porque el pagador con tarjeta no
  re-ancla (`EX-39`).
  - ***Enmendado el 2026-09-21 por la FASE 9-bis-4 (crítico `F-8eB1-001`), y las dos mitades
    tachadas eran falsas por separado.*** **Sí era una elección**: hoy es un **tope**, no un
    re-anclaje —la fecha salta al instante de la reactivación **sólo si cayó en el pasado**—,
    porque el re-anclaje incondicional le cobraba **dos veces** los días que le quedaban al que
    transfiere dentro del período que estaba pagando. Y el *«de golpe»* **es falso en el
    mecanismo**: `MP5` nombra **un** período por corrida, así que nunca crea todas las cuotas
    juntas; es verdadero sólo en el desenlace acumulado. Esa mitad falsa era la que le agrandaba el
    alcance al remedio hasta una población en la que su propio motivo no existe. **La mitad (2) de
    la decisión no cambia**: el que vuelve sigue pagando el período que arranca y no los que pasó
    suspendido.
- **Sin aviso nuevo**: el catálogo de `NUCLEO/07` §6 no gana fila. El aviso del §30 al admin no
  cambia de momento — lo que `MP5` le aporta es **el sujeto que no tenía**.
- **Y de paso cierra la otra mitad de `F-8B2-018`**: cómo entra el grace de un pagador manual. No
  hace falta fila nueva, lo carga `S4` con el evento leído **sobre la cuota** y no sobre el
  proveedor, que es lo que el §30 ya ordenaba y lo que `MP1`/`MP2` ya presuponían.
- **Modelo**: `manual_payment` gana **el período** —que el `UNIQUE` de `B/05` §C5 ya presuponía— y
  sus tres campos de registro pasan a anulables. **Sin estado nuevo y sin columna de monto**, que
  se resuelve de la versión anclada.
- **Origen**: `F-8B2-018`, declarado abierto por la familia del pago manual de la 9-bis-3 y
  reafirmado por `DEC-SUB-012`, y la elección del owner del 2026-09-21 entre las tres opciones que
  se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-METH-011 — La obligación alcanza a las DECISIONES, no sólo a los arreglos, y el rastro por aparición es un ARCHIVO

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-010`**, que **no la deroga**: la enmienda se midió y **funciona donde se
  ejecuta**. Lo que esta decisión corrige son las dos puertas por las que se dejó de ejecutar.
- **Problema, medido en la FASE 8-bis-4**: **83 hallazgos, 13 IDs `CRITICA`, 12 defectos críticos
  distintos**, y **12 de 12** los introdujo la tanda anterior. La serie completa:

  | | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 |
  |---|---|---|---|---|
  | críticos distintos | — | 17 | 14 | **12** |
  | atribuidos a la tanda anterior | 25/25 | 17/17 | 13/14 | **12 de 12** |

- **El diagnóstico, y es el primero de las cuatro vueltas que trae evidencia POSITIVA**:
  1. **Los dos únicos commits que ejecutaron la obligación 2 con cifras produjeron CERO de los
     doce críticos.** Uno de ellos, `1e3c3fc9e` —*«72 apariciones no corregidas quedaron
     justificadas una por una»*—, tocó **16 archivos**: exposición comparable a `621332e7c`, que
     tocó **18** y produjo **cinco**. **No es que la enmienda no sirva: no se ejecutó en 9 de los
     11 commits de la tanda.**
  2. **Nueve de los doce críticos salieron de los SEIS commits de decisiones**, que no reportan
     ninguna cifra de apariciones **aunque los seis editan capítulos y los seis editan el núcleo**.
     El generador se mudó: de los commits de arreglo a los de decisión.
  3. **El rastro por aparición no existe como artefacto.** Los once commits de la tanda **no
     agregan ningún archivo**, el worklog no lo contiene, y
     `rg -i "por aparici|declaradas correctas|apariciones recorridas"` sobre `.specs/` —excluidos
     los informes de fase— devuelve **sólo este log**, que es donde la regla se enuncia. Así que
     *«72 justificadas una por una»* es hoy **tan falsable como el «101 declaradas correctas»** que
     motivó `DEC-METH-010`.
  4. **5 de los 9 críticos que se escapan nacen en prosa que el commit escribió o editó** — que es
     exactamente lo que la versión acotada de la obligación 2 saca de su rastro.
- **Decisión, y son dos partes que van juntas:**
  1. **La obligación alcanza a TODO commit que edite el corpus, no sólo a los de arreglo.** Una
     decisión del owner que toca capítulos es un arreglo a los efectos de `DEC-METH-010`: redefine
     términos, crea transiciones y vuelve falsas premisas ajenas igual que cualquier otro. **Las
     tres obligaciones de `DEC-METH-010` corren idénticas sobre ella.**
  2. **El rastro por aparición se escribe como ARCHIVO, no en el mensaje del commit.** Vive en
     `<carpeta-de-la-fase>/rastro-<commit-corto>.md` y lleva, por cada aparición **no corregida**:
     archivo, §, la cita, y **por qué sigue siendo correcta**. Un agregado en el cuerpo del commit
     **ya no cumple la obligación 2**.
- **Por qué el archivo y no el mensaje, dicho en voz alta**: un mensaje de commit **no se puede
  verificar contra nada** —es texto libre que nadie vuelve a leer— y **un mensaje de commit no es
  evidencia de lo que se hizo**, que es una regla que el programa ya aplicaba a los informes y no
  se aplicaba a sí mismo. Un archivo, en cambio, **se grepea, se cuenta y se puede contradecir**:
  la vuelta que viene puede tomar una línea del rastro y mostrar que la resolución era falsa. Eso
  es lo único que convierte *«la miré»* en algo distinto de *«la resolví bien»*, que es el modo que
  `DEC-METH-010` no llegó a cerrar.
- **El costo aceptado, y es el caro de las tres opciones que se presentaron**: escribir el rastro
  de una decisión **cuesta más que la decisión**. `1e3c3fc9e` justificó 72 apariciones y
  `c29b318c7` recorrió 90. Con la extensión a los seis commits de decisiones el volumen crece, y el
  owner lo eligió igual **por encima de la opción barata** —sólo exigir el archivo, sin extender—,
  porque ésa dejaba intacto el modo que produjo **9 de los 12**.
- **Lo que esto NO cierra, declarado como lo declara `DEC-METH-010`**: sigue afuera **«el capítulo
  que nunca nombró el término»**, que ninguna búsqueda devuelve en ningún alcance y sólo encuentra
  recorrer el dominio por el eje del tiempo. Y sigue afuera **la prosa que el propio commit
  escribe**: la obligación 2 acotada excluye los párrafos que el commit tocó, y ahí nacen **5 de
  los 9** que se escapan. Esta decisión **no levanta esa exclusión** — la deja medida para la
  vuelta que viene.
- **Origen**: la FASE 8-bis-4, `20-fase-8-bis-4/C1-la-costura.md` §4, y la elección del owner del
  2026-09-21 entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-DATA-003 — El cupo que vuelve a alcanzar republica solo: `PB3` gana la rama simétrica a la del excedente

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el defecto crítico `F-8eA2-001` de la FASE 8-bis-4.
- **El caso**: un anfitrión con cinco fichas baja de Premium a Básico y el reconciliador le
  despublica tres. Tres meses después **vuelve a Premium y paga el precio entero**, y sus tres
  fichas **no vuelven nunca**. `PB2` tiene dos ramas y la del excedente está declarada como la que
  *«no cambia `cubierto` y sí el cupo»*; `PB3` y `PB7` exigen que `cubierto` **pase** a verdadero,
  y sobre alguien que estuvo cubierto todo el tiempo no hay cambio que disparar. El reconciliador
  tampoco lo levanta: *«actúa sólo si algo bajó»* (`V/15` §4.2). Desde
  `UNPUBLISHED_BY_BILLING` no sale ninguna otra transición salvo el reloj, así que el día 90 `PB4`
  las archiva y el día 180 el hard delete les borra el contenido. **Paga Premium y recibe Básico,
  indefinidamente, sin que nada lo señale.**
- **Decisión**: **`PB3` gana una segunda rama, simétrica a la segunda de `PB2`: *«el cupo vuelve a
  alcanzar»*.** Las fichas del excedente se republican **solas** cuando el cupo las vuelve a
  admitir, sin que el dueño tenga que entrar al panel.
- **Las dos alternativas, y por qué se descartan:**
  - **A mano, con la ficha viva**: el excedente va a un estado nuevo desde el que el dueño
    republica cuando quiere, con el reloj detenido. Cuesta un estado nuevo en la máquina de
    publicación, y **el que no entra nunca al panel igual pierde la ficha**: sólo hace correr el
    reloj más lento.
  - **A mano, reusando `PB8`**: darle a `UNPUBLISHED_BY_BILLING` la salida por acto del dueño que
    hoy sólo tiene `ARCHIVED`. Es la más barata —una fila— pero **el dueño tiene que enterarse, y
    hoy nada le avisa que le despublicaron tres fichas**.
- **El motivo, y es el criterio del owner aplicado literalmente**: *si la persona puso plata, se le
  da salida*. Acá **volvió a Premium y pagó**, que es la forma más explícita que tiene de decir qué
  quiere. Las dos alternativas le cobran Premium y le entregan Básico hasta que entre al panel, y
  el que no entra nunca es justamente el que pierde el contenido el día 180.
- **El costo aceptado, dicho en voz alta**: la rama **obliga a escribir un criterio de orden** —si
  se liberan tres cupos y hay cinco candidatas, cuáles suben—. **No es costo nuevo**: `PB3` y `PB7`
  ya compiten hoy por el mismo cupo sin criterio escrito (`F-8eA2-010`, `F-8eA1-006`), así que el
  criterio hace falta igual. Lo que esta decisión agrega es la obligación de escribirlo ahora.
- **Y el precedente que lo gobierna**: `DEC-SUB-008` ya exige un criterio *«escrito y predecible»*
  para decidir **qué se baja**. Esto lo extiende a **qué se sube**, que es la mitad que faltaba.
- **El riesgo aceptado**: se republica sola una ficha que el dueño **quizá ya no quiere pública**.
  Se acepta porque el estado del que viene no es *«la despubliqué yo»* sino
  `UNPUBLISHED_BY_BILLING` —la bajamos nosotros—, y devolverla al estado anterior a nuestro acto es
  lo que repara nuestro acto. El dueño que no la quiera pública tiene ~~`PB1`~~ **`PB6`** y la
  despublica. *(Corregido el 2026-09-21 por la FASE 9-bis-4: `PB1` sale sólo de `DRAFT`, así que la
  transición que despublica a mano es `PB6`. La decisión no cambia; la sigla estaba mal.)*
- **Los otros cuatro críticos que `DEC-DATA-002` produjo NO llevan decisión y se arreglan**, y va
  escrito acá para no volver sobre el tema: `F-8eA3-002` (el reloj sin columna), `F-8eA3-001` (la
  clave del outbox que manda los dos avisos una sola vez en la vida de la ficha), `F-8eA2-002`
  (`S10` sin rama de fallo) y `F-8eA1-001` (`PB8` inejecutable contra el piso). **Declarar
  cualquiera de los cuatro con causa significaría *«la ficha se borra igual»*, que es exactamente
  lo que `DEC-DATA-002` prohibió**: no son objeciones a la decisión, son la decisión sin terminar
  de escribir.
- **Origen**: la FASE 8-bis-4, hallazgo `F-8eA2-001`, y la elección del owner del 2026-09-21 entre
  las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-007 — La cortesía que el espejo se lleva puesta NO se re-apunta: se re-emite sobre la sucesora cuando autoriza

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el defecto crítico que la FASE 8-bis-4 reportó por **tres** IDs desde tres vectores
  distintos —`F-8eB2-001`, `F-8eB3-001` y `F-8eB1-003`—, verificados como un solo defecto en
  `20-fase-8-bis-4/C1-la-costura.md` §2.
- **El caso**: un cliente con una cortesía vigente —N días sin cobrar, firmados por `SUPER_ADMIN`—
  está en medio de un cambio de plan. **El proveedor da de baja su preapproval por su cuenta**, el
  espejo mata a la predecesora y `S18` cierra la sucesión **re-apuntando la cortesía a la
  sucesora**, que está en `PENDING_AUTHORIZATION`. Ahí `S18` va *«al mismo estado»* y **el único
  evento que lleva a `PAUSED · COURTESY` es `S9`**, que sale de `ACTIVE` y lo dispara
  `SUPER_ADMIN`. Los dos desenlaces le cobran: o `S18` escribe una pausa que ninguna fila declara
  —y la regla 1 la manda a la marca— o la sucesora autoriza, cobra y sigue cobrando con una
  cortesía re-apuntada que es *«una fila de base que no hace nada»*.
- **Decisión**: **la cortesía no se re-apunta en el cierre. `S18` guarda el SALDO DE DÍAS, y la
  cortesía se re-emite sobre la sucesora cuando ésta autoriza** — o sea cuando llega a `ACTIVE`,
  que es exactamente el `desde` que `S9` ya tiene. Lo único nuevo es **dónde vive el saldo** y que
  **el disparador sea la autorización de la sucesora** en vez del acto de `SUPER_ADMIN`.
- **Las dos alternativas, y por qué se descartan:**
  - **Que la sucesora herede la pausa** con una fila nueva que la lleve a `PAUSED · COURTESY` al
    cerrarse la sucesión. Es la más elegante y la más corta de escribir, y **se descarta por una
    razón de método, no de diseño**: apoya el mecanismo en **una capacidad del proveedor que nadie
    midió** —pausar un preapproval que todavía está `pending`—, y lo que sí está medido apunta en
    contra: `EX-11` `VERIFIED` dice que **una pausada no acepta ninguna modificación** (`400`
    explícito). Si no se puede, el diseño queda inejecutable y nos enteramos en FASE 10.
  - **Que la cortesía se pierda y se declare**. Cuesta cero y **es el único que contradice el
    criterio del owner**: la pérdida **no la causa un acto deliberado nuestro** —la causa el
    proveedor dando de baja el preapproval— y la persona tiene días que `SUPER_ADMIN` le firmó.
- **El motivo**: es la única de las tres que **no apoya el diseño en una medición que no existe**, y
  su riesgo cae en un camino que el programa **ya tiene construido y decidido**. Reusa `S9` tal como
  está, con su condición *«no hay pausa vigente»* intacta: una sucesora recién autorizada no tiene
  pausa, así que la fila corre sin tocarse.
- **El riesgo aceptado, dicho en voz alta**: entre que la sucesora autoriza y la cortesía se
  re-emite, **el proveedor puede cobrar el primer pago**. Ese cobro **se devuelve por el camino que
  ya existe** —`DEC-RF-002`, el reembolso que confirma una persona— y **no se inventa un mecanismo
  nuevo** para evitarlo. Se prefiere un cobro que se devuelve por una vía escrita antes que una
  pausa que quizá el proveedor no acepta.
- **Lo que esto NO cambia**: `DEC-GRANT-003` sigue entera —la cortesía se implementa **pausando**,
  porque el piso son ARS 15 (`PC-2`) y ni `free_trial` ni correr la fecha de cobro se pueden
  aplicar a una suscripción viva (`EX-35`, `EX-34`)—. Lo que cambia es **cuándo** se pausa: no en
  el cierre de la sucesión, sino cuando hay una fila `ACTIVE` que se pueda pausar.
- **Origen**: la FASE 8-bis-4, hallazgos `F-8eB2-001` / `F-8eB3-001` / `F-8eB1-003`, y la elección
  del owner del 2026-09-21 entre las tres opciones que se le presentaron — eligió la 2, que era la
  recomendada.

---

### DEC-SUB-014 — La baja desde `GRACE_PERIOD` corta el servicio en el acto

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: al escribir `S22` (desde `PAUSED`) y `S23` (desde `SUSPENDED`), la FASE 9-bis-4
  recorrió los seis estados vivos y encontró que **`GRACE_PERIOD` sigue sin fila de baja**. A
  alguien le rebotó la tarjeta, está en los 7 días de gracia y **decide irse en el medio**: hoy
  ninguna fila lo ejecuta, el intento se va a la marca por la regla 1 del núcleo, y mientras una
  persona lo mira **el reloj del grace sigue corriendo hacia `SUSPENDED`**.
- **Lo que el diseño existente no resolvía**: `DEC-SUB-009` fija que al cancelar se guarda
  **nuestra** fecha de fin de servicio, y **no dice cuál es cuando el período en curso no está
  pagado**. En `S11` (desde `ACTIVE`) la respuesta es clara —el cliente pagó el período, el
  servicio corre hasta que termine—; en `GRACE_PERIOD` **no pagó**.
- **Decisión**: **corta en el acto**, con `fin_real` en el día de la cancelación, igual que `S22` y
  `S23`. Es una fila propia de `B/03` §3.2, con `desde` = `GRACE_PERIOD`, evento *«pide la baja»*,
  `hacia` `CANCELLED` directo — **sin pasar por `CANCEL_SCHEDULED`**, por la misma razón que las
  otras dos: no queda período pagado que sostener.
- **El motivo**: es **el criterio que ya gobierna `S22` y `S23`** —*«no queda período pagado que
  sostener»*— aplicado al estado donde es más literal que en ninguno: **el grace existe porque el
  cobro falló**. El ciclo anterior ya se consumió, que es precisamente por lo que la fila está ahí.
- **Las dos alternativas, y por qué se descartan:**
  - **Correr el reloj del grace y cortar al vencer**, dándole la ventana completa por si paga:
    obliga a un estado intermedio —*«de baja pero viva»*— y **deja el candado `A` ocupado** durante
    esos días, que es **el mismo encierro que `S23` acaba de venir a romper**.
  - **No escribir la fila** y que el que quiere irse espere a que lo suspendan para usar `S23`: le
    pide a alguien que decidió irse que aguante una semana a que lo suspendan por falta de pago, y
    **el correo de suspensión del proveedor insinúa mora** (`PA-5`, medido). Un mal trago por nada.
- **Pendiente de implementación al momento de escribirse**: la fila **no está escrita todavía** en
  `B/03` §3.2. Se difirió a propósito porque la familia de la sucesión estaba editando ese mismo
  archivo, y dos escrituras simultáneas sobre la misma tabla es exactamente lo que esta fase evita
  corriendo las familias en serie. **Entra en una tanda corta posterior**, junto con el recuento de
  todo lo que la fila nueva mueve (las puertas del cap. 09, las transiciones de `B/16` §4.3, la
  regla 7 y las ramas de `B/12` §5.3).
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 1 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-SUB-015 — La suscripción pausada NO entra al piso de una vertical discontinuada: se le avisa, y al volver elige plan nuevo

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- ***Corregido el mismo día, y el error era del encuadre con que se presentó el caso, no de la
  decisión***: esta entrada nació diciendo *«el retiro de un plan»*, y **ese acto no produce el
  caso**. `B/10` §3 dice literal que **«retirar un plan no mueve a nadie»** y que *«un plan retirado
  sostiene a sus clientes por tiempo indefinido»*, y el §4.3 avisa que *«esto NO es el retiro de un
  plan del §3»*. El acto que produce el caso es **la discontinuación de una vertical** (§4.3), que
  es donde la decisión se implementó.
- **El hueco, que es anterior a los arreglos de esta tanda**: `B/10` §4.3 manda a
  `CANCEL_SCHEDULED` a **cada suscripción viva** alcanzada por la discontinuación de una vertical
  —los **60 días de piso**— y **no excluía a las pausadas**, mientras `B/03` §3.3 **prohíbe** llegar
  a `CANCEL_SCHEDULED` desde `PAUSED`, porque **`EX-11` midió que el proveedor rechaza toda
  modificación sobre una pausada**. Es una instrucción que ordena un movimiento imposible: el caso
  moría en la marca. La FASE 9-bis-4 lo encontró al recorrer, no lo creó.
- **El escenario está declarado improbable por el owner, y la corrección se conserva igual.** El
  owner declaró el 2026-09-21 que **una vertical no se va a discontinuar**, y que si algún día se
  decide **se resolverá en el momento**. Eso NO retira nada de lo escrito, y la razón es que
  **la contradicción entre `B/10` §4.3 y `B/03` §3.3 era real con escenario o sin escenario**: un
  capítulo ordenaba lo que otro prohíbe, que es exactamente la clase de defecto que el ciclo
  `DEC-METH-006` existe para eliminar. Lo que la declaración del owner sí cierra es **la pregunta
  del saldo de cortesía sin destino** (ver `DEC-GRANT-010`): no se define, y queda declarada con
  causa.
- **Y la ventana no es un borde raro**: el tope de una pausa son **120 días** y el piso son **60**,
  así que una pausa que sobrevive al piso es el caso **normal**, no la excepción.
- **Decisión, tres partes:**
  1. **La pausada NO entra al piso.** Queda `PAUSED` apuntando a un plan retirado, y **eso es
     legal**: hay que decirlo con todas las letras en `B/10` §4.3, que hoy la incluye sin poder
     alcanzarla.
  2. **El aviso sale al RETIRAR el plan, no al reanudar.** Es la parte que carga toda la ventaja de
     esta opción: el cliente se entera con la pausa corriendo y con tiempo para decidir, en vez de
     encontrarse con la novedad el día que vuelve.
  3. **Al reanudar elige un plan nuevo**, y la fila pausada termina ahí. `S10` no puede llevarla a
     `ACTIVE` sobre un plan que no existe: **qué transición ejecuta ese final es lo que la tanda
     corta tiene que escribir**, y no se inventa acá.
- **El motivo, y es una medición de esta misma vuelta, no una preferencia de estilo**: la
  alternativa recomendada por el agente —mantener la pausa y **congelar el reloj del piso**—
  agregaba **un segundo reloj que se detiene y se reanuda**. Ese mecanismo entró al programa esta
  misma mañana con `DEC-DATA-002` y **produjo cinco de los doce críticos de la FASE 8-bis-4**: el
  reloj sin columna, el aviso que se manda una sola vez, `S10` sin rama de fallo, `PB8` contra el
  piso y el excedente sin vuelta. **Cinco de doce, de un solo mecanismo, en una sola vuelta.**
  Proponer un segundo reloj con hechos de reinicio dos días después de medir eso es repetir a
  sabiendas el mecanismo más caro del programa. Esta decisión **no toca la máquina de estados**: es
  una rama del aviso.
- **Las tres alternativas, y por qué se descartan:**
  - **El piso con el reloj congelado** durante la pausa (la recomendada por el agente): compra la
    garantía *«nadie pierde su plan sin sus 60 días»* al precio de arriba.
  - **El piso sin congelar**: el plan se le vence estando pausado —a la **mayoría** de los que
    pausan, por los 120 contra 60— y hay que escribir igual a qué plan vuelve. Paga casi el mismo
    costo estructural y no compra la garantía.
  - **Interrumpir la pausa** para meterla al piso: **le cortás una pausa que pagó**, o le terminás
    una cortesía antes de tiempo. Acto nuestro, plata suya.
- **Lo que el cliente pierde, dicho sin maquillar**: el **derecho a volver al precio que tenía**,
  que es exactamente para lo que existen los 60 días. **Pero lo perdía igual con el piso**, sólo
  que 60 días después de reanudar. La diferencia real entre las opciones no es *si* pierde el plan
  sino **cuándo se entera**, y acá se entera antes y con la pausa corriendo.
- **Lo que NO está medido, y va escrito porque sostiene la decisión**: **nadie midió cuántas veces
  se retira un plan del catálogo.** No hay una cifra en el corpus. La decisión se apoya en el
  juicio del owner de que es un evento poco frecuente, y **eso es un juicio, no un dato**. Si
  resultara frecuente, la que hay que releer es esta entrada.
- **Un borde que esta decisión NO cierra**: qué pasa con una **cortesía pausada** cuando se retira
  el plan —`SUPER_ADMIN` le firmó N días y el plan desaparece debajo—. Queda abierto como pregunta
  al owner; el precedente de cómo tratarlo es `DEC-GRANT-007`, que resolvió hoy la misma tensión
  por otra puerta.
- **Pendiente de implementación al momento de escribirse**, igual que `DEC-SUB-014`: entra en la
  **tanda corta posterior**, con el recuento de todo lo que mueva.
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 2 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5); la contrapropuesta del owner del 2026-09-21 frente a
  las tres opciones que se le presentaron; y **el cambio de recomendación del agente**, que había
  recomendado el piso con reloj congelado y retiró esa recomendación ante el argumento de la
  medición.

---

### DEC-RF-003 — La rama 6 entra al listado con el default en DEVOLVER

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-RF-002`**, que no se toca: **ningún reembolso se dispara solo**, y éste tampoco.
  Lo que esta entrada agrega es **qué encuentra escrito la persona que abre el caso**.
- **El hueco**: al escribir `S23`, la FASE 9-bis-4 llevó `B/12` §5.3 de cinco ramas a **seis**. La
  nueva es **una baja desde `SUSPENDED` sobre una predecesora que retiene un pago** por `S19`:
  alguien pagó un período, quedó atrapado en una sucesión que nunca cerró, y **se da de baja él
  mismo**. Las otras cinco ramas traen su desenlace escrito; **ésta dejaba el caso en manos de una
  persona sin decirle qué debería hacer.**
- **Decisión**: **el default es DEVOLVER.** La marca entra al listado accionable con motivo
  *«reembolso por confirmar»*, y la persona **confirma salvo que haya razón para no hacerlo**. La
  confirmación sigue siendo humana y sigue pudiendo decir que no.
- **El motivo**: el pago quedó retenido **porque nuestra sucesión no cerró**, no porque el cliente
  hiciera nada raro. Es el criterio del owner aplicado literal —*puso plata, se le da salida*—, el
  mismo de `DEC-SUB-012` y `DEC-GRANT-007`.
- **Las dos alternativas, y por qué se descartan:**
  - **Sin default, la persona decide caso por caso**: es el estado actual y **es el que ya falló**.
    El crítico `F-8eB3-003` existe precisamente porque una marca sin motivo se volvía
    indistinguible de las otras y **el pago se quedaba**. Un default vacío reproduce ese desenlace
    con más pasos.
  - **El default depende de si el período se consumió** —entero si la baja llega antes de que
    empiece, nada si ya corrió—: es **más justo** y se descarta por una razón de método, no de
    fondo. Pide **una fecha que hay que verificar que exista**, y toda esta familia de críticos
    nació de columnas que nadie escribía; prometer un default apoyado en un dato sin confirmar es
    crear el defecto que la tanda acaba de arreglar cinco veces. **Queda anotada como mejora** para
    cuando se verifique que esa fecha está guardada.
- **El costo aceptado**: si el cliente usó el servicio durante el período, se devuelve un período
  consumido. Se acepta porque la persona que confirma puede verlo y negarse, y porque el caso llega
  ahí por una falla nuestra.
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 3 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-008 — La revocación de un grant guarda MOTIVO, además de fecha y firmante

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El contexto**: la FASE 9-bis-4 le dio a `permanent_grant` la columna **`revocado_en`** —el
  estado que las comprobaciones de cero llamadas necesitaban y que no existía (`F-8eB3-002`)— más
  **quién la firmó**. Faltaba decidir si además se guarda **por qué**.
- **Decisión**: **sí, y es texto libre.** La revocación guarda fecha, firmante y motivo.
- **El motivo**: un *Free Forever* es una concesión discrecional de `SUPER_ADMIN`, y revocarla
  **le corta el servicio a alguien que no hizo nada para provocarlo**. `DEC-TRIAL-009` decidió hoy
  que revocar **consume el trial y no se repara**, apoyándose en que es *«una decisión legítima y
  deliberada»* — y **una decisión deliberada cuyo motivo no se registra es indefendible seis meses
  después**, empezando por ante el propio beneficiario que pregunta por qué le cortaron.
- **Por qué libre y no de lista cerrada** (error / acuerdo vencido / abuso / otro): el volumen es
  bajo —son concesiones firmadas a mano por `SUPER_ADMIN`—, así que el texto libre no genera
  basura, y una lista cerrada obliga a mantenerla mientras el `otro` se come el resto.
- **Origen**: la FASE 9-bis-4, familia del grant y el addon, pregunta 1 de su rastro
  (`21-fase-9-bis-4/rastro-ce52dce5f.md`), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-009 — «A lo sumo un grant vivo por beneficiario» lo garantiza la base, no los nueve consumidores

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El contexto**: con `revocado_en` (`DEC-GRANT-008`), un beneficiario puede acumular **N filas
  revocadas** y ninguna clave lo impide. *«Grant vivo»* se resuelve hoy mirando
  `revocado_en IS NULL`, así que las revocadas no molestan **mientras ese filtro esté en todos
  lados** — y el inventario dice que hoy son **nueve consumidores**.
- **Decisión**: **un `UNIQUE` parcial sobre beneficiario, restringido a las filas vivas.** La base
  rechaza un segundo grant vivo para el mismo beneficiario.
- **El motivo**: convierte *«hay a lo sumo uno vivo»* en algo que **la base garantiza** en vez de
  algo que nueve lugares tienen que recordar. **Si un consumidor olvida el filtro, encuentra a lo
  sumo una fila viva y no dos**, que es la diferencia entre un resultado incompleto y uno falso.
  Y el precedente es de esta misma vuelta: **`F-8eB3-002` existió porque *«el grant sigue vivo»* se
  daba por sabido sin que nada lo garantizara**, y el programa tiene medido que los inventarios se
  olvidan —la única lista que existía antes **quedó corta en el mismo commit que creó su sexto
  miembro**—.
- **Por qué no rompe ningún caso contemplado**: el programa ya decidió que el grant es **un
  instrumento con un ancla POR VERTICAL**, así que la multiplicidad vive en
  `permanent_grant_vertical` y no en el grant. **Un segundo grant vivo para la misma persona no
  tiene significado escrito en ningún lado.**
- **El costo aceptado**: si algún día apareciera un caso legítimo de dos grants vivos simultáneos,
  la restricción es **difícil de revertir** sobre datos ya escritos. Se acepta porque hoy ese caso
  no existe en ningún capítulo.
- **Origen**: la FASE 9-bis-4, familia del grant y el addon, pregunta 2 de su rastro
  (`21-fase-9-bis-4/rastro-ce52dce5f.md`), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-TEST-001 — Va UN guard nuevo, el de la columna que nadie escribe; el del orden de escrituras NO

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El contexto**: la FASE 9-bis-4 produjo dos clases de defecto que ningún guard vigila, y cada
  una salió de un crítico real. Se evaluó agregar uno por cada una.
- **Decisión: va el primero y no va el segundo.**
  1. **SÍ — *«una condición que lee una columna que ninguna transición escribe»*.** Es
     `F-8eB1-002` exacto: `MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura
     del corpus avanzaba esa columna**, así que el pagador manual pagaba **una vez en la vida** y
     seguía cubierto para siempre. El guard recorre cada condición de transición, extrae las
     columnas que lee y exige que **al menos una transición las escriba**.
  2. **NO — *«toda fila con `desde` de conjunto declara cuántas escrituras tiene y en qué
     orden»*.** Es `F-8eB2-002`: `S20` copió de `S13` el *«idempotente y reanudable fila por fila»*
     teniendo **dos** escrituras, y el argumento de `S13` supone una.
- **Por qué el primero sí**: vigila una clase que ya costó **un crítico de dinero**, y **se
  verifica mecánicamente** — cruzar las columnas leídas contra las escritas es una comprobación
  estructural, no un juicio.
- ***Ampliado el mismo día, a pedido del owner: `G-R6` alcanza LAS DOS ÉPICAS, no sólo billing.***
  Nació acotado a las seis tablas de billing porque el crítico que lo motivó era de billing, y
  **nadie planteó la extensión**. Se amplía a las tres máquinas de verticales por una razón
  concreta y no por simetría: ahí vive **`inactiva_desde`**, la columna que `DEC-DATA-002` creó
  **ese mismo día**, con **cuatro escritores nuevos** y **cinco consumidores**, y **lo que decide es
  el borrado irreversible del contenido de una ficha**. Es el candidato más fresco del corpus para
  exactamente el defecto que `G-R6` vigila, y ahí el daño no es dinero: son datos sin vuelta. Se
  agrega su fila en `V/20` §2.
- **Por qué el segundo no, y es la parte que importa**: vigila una **convención de redacción**
  —*«declará tus escrituras»*— que un guard estático **sólo puede comprobar en su forma, no en su
  verdad**. Puede exigir que la fila **diga** cuántas escrituras tiene; no puede verificar que
  **sean ésas**. Sería **un guard que afirma más de lo que prueba**, y el programa tiene la regla
  escrita de que el mensaje de un guard no puede afirmar más que su predicado. Un guard así es
  **peor que no tenerlo**, porque declara cubierta una clase que no cubre.
- ***Y el catálogo estaba incompleto, medido el mismo día***: **`G12` y `G13` existen definidos
  sólo en `B/descomposicion.md`** —el documento de unidades de trabajo— **y no estaban en ningún
  catálogo**, en un § que se declara *«los guards, en un solo lugar… lo que permite preguntar
  "¿están todos?" una vez en vez de siete»*. Es el patrón de **inventario que afirma completitud
  sin tenerla**, el mismo que la FASE 8-bis-4 encontró cinco veces. Se agregan a `B/20` §2. *(El
  salto `G7` → `G9` del catálogo **no** es un agujero: la numeración `G1`-`G13` está repartida
  entre las dos épicas, y `G8` vive en `V/20` §2 — medido.)*
- **El costo aceptado**: los guards de este programa **no corren todavía** —son declaraciones en
  `B/20` §2 y `V/20` §2 hasta la FASE 10— y **se acepta agregar uno más**, porque la alternativa
  —no escribirlo— garantiza que no llegue a la FASE 10.
- ***La cifra con que se aceptó ese costo era falsa, y se corrige acá con la medición.***
  ~~`C2` midió que 12 de 26 no tienen unidad que los construya, y agregar uno empeora esa
  proporción a 13 de 27.~~ ~~Al agregar también `G12` y `G13` la proporción MEJORA, porque esos dos
  SÍ tienen unidad declarada.~~ **Lo medido el 2026-09-21, recorriendo las filas de las dos tablas
  y la columna de guards de las dos `descomposicion.md`:**

  | | cuántos | |
  |---|---|---|
  | filas de `B/20` §2 | ~~15~~ → **16** | |
  | filas de `V/20` §2 | ~~16~~ → **17** | |
  | guards **distintos** | ~~28~~ → **29** | menos **4** referencias cruzadas (`G-R4`, `G-R5`, `G-R6`, `G-R6-B`) |
  | **sin unidad que los construya** | **14** | la mitad son los `G-R*` |

  > **Estas cifras están ancladas a un SHA y NO describen el presente: son de `7676082e6`,
  > 2026-09-21.** La columna tachada es de `e98727349`, del mismo día y **tres horas antes** — la
  > movió `G-R6-B`, que la tercera enmienda de esta misma entrada introdujo. **El número medido vive
  > en `B/20` §2 y `V/20` §2**, que son los catálogos; acá vive **el costo que se aceptó al
  > decidir**, que es otra cosa y no caduca.
  >
  > **Por qué se ancla en vez de corregirse otra vez**: es la **tercera** vez en un día que este
  > número queda corto dentro de esta entrada, y las dos anteriores se arreglaron a mano. El log
  > estaba **repitiendo un número que se mueve cada vez que alguien toca un catálogo**, que es
  > exactamente lo que la regla de trabajo del owner prohíbe —*los conteos se recuentan con script,
  > no se toman de un índice*—. Anclado al SHA, el número deja de pretender describir el presente y
  > pasa a ser lo que siempre fue: **una medición de un momento**, en la misma forma que usan los
  > rastros. **Decisión del owner del 2026-09-21**, entre retirar la cifra, anclarla, o seguir
  > corrigiéndola a mano.

  **Tres correcciones sobre lo que esta entrada afirmaba**, y ninguna cambia la decisión:
  1. **El *«12 de 26»* de `C2` no era un conteo de catálogo**: era la **unión** de los dos
     catálogos **más** `G12` y `G13` leídos de la descomposición, en un día en que `B/20` §2 listaba
     **once** filas.
  2. **El *«13 de 27»* no describió ningún estado del corpus en ningún momento.** Desde la medición
     de `C2` habían entrado dos guards más —`G-R1-F` y el propio `G-R6`—, **los dos sin unidad**, así
     que los sin-unidad **ya eran catorce antes de que esta decisión se tomara**.
  3. **La mejora es real pero no por donde esta entrada decía.** Los sin-unidad **no se mueven**:
     catorce antes y catorce después, porque `G12` y `G13` ya estaban contados en la unión de `C2` y
     ya tenían unidad. **Lo que mejora es el denominador**: `14 de 26` → **`14 de 28`**.
  **La conclusión de la decisión es correcta; su cifra intermedia no lo era.**
- **Lo que queda sin vigilancia, declarado**: la clase del segundo guard. `S20` demostró que el
  error se comete **copiando de una fila que parece análoga**, y contra eso no hay comprobación
  estructural: lo único que lo detecta es que alguien lea las dos filas juntas.
- ***Tercera enmienda del mismo día: va un guard MÁS, el de la lista de escritores.*** Al escribir
  `G-R6` en `V/20` §2 se midió algo que nadie había planteado: de los **cuatro hechos que escriben
  `inactiva_desde`, sólo uno es una transición** (`PB1`/`PB3`/`PB7`); los otros tres salen del
  registro de eventos, del contrato y de `vertical.fin_de_servicio`. Como el predicado de `G-R6` es
  *«al menos una transición la escribe»*, **el guard queda verde por uno solo de los cuatro**:
  certifica *«alguien la mueve»*, **nunca *«los cuatro la escriben»***. Eso quedó declarado en
  `V/20` §2, y deja como única vigilancia de los otros tres **la lista cerrada de `V/02` §2.5**.
  - **Decisión: la lista lleva guard propio**, que falle si alguien escribe `inactiva_desde` desde
    un lugar que la lista no nombra — exactamente el papel que `G-R1-E` cumple para los inventarios
    del núcleo.
  - **El motivo**: `inactiva_desde` **decide un borrado irreversible**, sus cuatro escritores
    **nacieron el mismo día** (`DEC-DATA-002`), y `G-R6` ya declaró por escrito que no los cubre.
    Es la misma situación que motivó a `G-R1-E`, **con una consecuencia peor**. Y el precedente del
    programa es explícito: **la única lista que existía quedó corta en el mismo commit que creó su
    sexto miembro**, así que una lista cerrada sin guard es una promesa que ya se rompió una vez.
  - **Lo que esto NO contradice**: el segundo guard del rechazo de arriba sigue rechazado. La
    diferencia es medible y no de gusto — aquél sólo podía comprobar su **forma** (*que la fila diga
    cuántas escrituras tiene*), mientras éste comprueba un **hecho**: que no exista un escritor
    fuera de la lista. Uno afirma más de lo que prueba; el otro no.
  - ***Cuarta enmienda, el mismo día: `G-R6-B` vigila las DOS mitades de la lista.*** `V/02` §2.5
    cierra **dos** listas sobre `inactiva_desde` —sus **cuatro escritores** y sus **cinco
    consumidores**— y el guard nació vigilando sólo la primera. **Se le suma la segunda**, porque
    **las dos mitades fallan distinto y la segunda falla peor**: un escritor fuera de la lista mueve
    el reloj cuando no corresponde; **un consumidor que nadie registró LEE el reloj y decide con
    él**, y el consumidor más caro de esa columna **es el hard delete del día 180**. Un lector no
    inventariado es un lugar que borra contenido sin que la lista sepa que existe. Además es la
    simetría que ya tiene el precedente: **`G-R1-E` cubre la mitad consumidores** para los
    inventarios del núcleo.
  - **La condición con que se acepta, y no es decorativa**: **el mensaje del guard tiene que decir
    QUÉ MITAD falló.** Un guard que vigila dos cosas con un solo mensaje afirma más que su
    predicado, que es **exactamente la regla con la que se rechazó el segundo guard** tres párrafos
    más arriba. Sin esa condición, esta enmienda se contradice con su propia entrada.
- ***Quinta enmienda, y va contra la recomendación del agente, que es la razón de que quede
  escrita: LOS GUARDS SIN UNIDAD SE REPARTEN AHORA.*** `C2` lo viene reportando **tres vueltas
  seguidas** (`F-8dC2-003` → `F-8eC2-004`): la proporción de guards sin unidad que los construya
  fue de `11 de 24` a `12 de 26`, y el 2026-09-21 quedó en **14 de 29**. **Un guard sin unidad es
  una promesa escrita que nadie tiene asignado construir cuando llegue la FASE 10.**
  - **La decisión del owner: se reparten ahora**, con el contexto fresco del día en que la mitad de
    ellos se escribió, en vez de declararlos como límite conocido para la FASE 10.
  - **La recomendación del agente era la contraria, y su razón queda acá porque es el riesgo que
    esta decisión acepta**: `C2` midió que **el único de los trece que consiguió dueño lo consiguió
    en la ÉPICA EQUIVOCADA** —`G-R5` vigila un número que declara billing y lo construye una unidad
    de verticales **que corre antes de que ese número exista**—. **Una asignación apurada acierta el
    guard y erra la unidad, y eso es peor que no tener unidad, porque afirma que alguien lo
    construye.**
  - **Las tres condiciones con que se ejecuta, que son lo que hace aceptable el riesgo**: (1) **cada
    asignación lleva su razón medida con cita**, no plausible; (2) **la unidad nace ANTES o CON lo
    que el guard vigila, nunca después** —el criterio que confirmó `V6` para `G-R6-B` y el que
    `G-R5` violó—; y (3) **no se inventa**: un guard sin unidad clara **se declara sin dueño con su
    razón**. **Trece asignaciones medidas y una declarada honestamente valen más que catorce
    plausibles.**
  - **Y se aprovecha para cerrar `F-8eC2-004`**: si se confirma que la unidad de `G-R5` está en la
    épica equivocada, se corrige en el mismo acto.
- **Origen**: la FASE 9-bis-4, preguntas de los rastros del pagador manual
  (`rastro-8f9f31ac0.md`) y del grant (`rastro-ce52dce5f.md`), presentadas juntas al owner el
  2026-09-21 —eligió la 2, que era la recomendada—; la ampliación a las dos épicas pedida por el
  owner el mismo día; la tercera enmienda, sobre la medición de los cuatro escritores que trajo
  el cierre de guards (`rastro-12cc0879f.md`), donde eligió la 2, que era la recomendada; la cuarta,
  sobre las dos mitades de la lista, donde eligió la 1, que era la recomendada; y la quinta, el
  reparto, donde eligió la 1 **contra** la recomendada.

---

### DEC-GRANT-010 — La cortesía sobre una vertical discontinuada se difiere; su re-emisión puede no llegar, y eso queda declarado

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra el borde que `DEC-SUB-015` dejó abierto explícitamente.**
- ***Corregido el mismo día, por lo mismo que `DEC-SUB-015`***: nació diciendo *«se retira el plan»*
  y **ese acto no produce el caso** — `B/10` §3: *«retirar un plan no mueve a nadie»*. El acto es
  **la discontinuación de la vertical** (§4.3).
- **El caso**: `SUPER_ADMIN` le firmó a alguien **N días de cortesía**, y la cortesía **se
  implementa pausando** (`DEC-GRANT-003`), así que esa suscripción está `PAUSED · COURTESY`.
  Entonces **se discontinúa la vertical**. Por `DEC-SUB-015` la pausada no entra al piso, se le
  avisa y al volver elige plan nuevo — pero **el que vuelve está en medio de un regalo nuestro**, y
  la vertical sobre la que se lo hicimos está cerrada.
- **Decisión**: **la cortesía se difiere y se re-emite sobre el plan nuevo**, con el **mismo
  mecanismo que `DEC-GRANT-007`** escribió el mismo día: el saldo de días vive en
  `courtesy_grant.saldo_días`, y `S9` —que ya ganó un segundo disparador— la re-emite cuando la
  fila llega a `ACTIVE`. **No se inventa nada nuevo.**
- **El motivo**: es el criterio del owner sobre un caso donde la pérdida **la causaría un acto
  deliberado nuestro** —retirar el plan— **sobre alguien que todavía no recibió nada**. Es el caso
  de `DEC-TRIAL-009` **invertido**, y conviene leerlos juntos: allá la persona **ya había recibido
  la cobertura completa** del plan anclado y por eso el trial gastado no se repara; **acá el regalo
  no empezó a entregarse**.
- **Las dos alternativas, y por qué se descartan:**
  - **Que la cortesía corra hasta agotarse sobre el plan retirado** y recién ahí elija: le da
    exactamente lo que se le firmó, sobre el plan sobre el que se le firmó, pero **mantiene vivo un
    plan retirado hasta que se agote el regalo** — que es justo la garantía que `DEC-SUB-015`
    conservó: **un plan retirado tiene fecha de cierre**.
  - **Que la cortesía se pierda con el plan**, avisando: **contradice el criterio del owner**, por
    la razón de arriba.
- **El costo aceptado**: el plan nuevo puede ser **más caro**, así que los N días regalados valen
  más de lo que valían al firmarse. Es un sobrecosto **nuestro, acotado y consecuencia de una
  decisión nuestra**.
- **La re-emisión puede NO LLEGAR, y eso queda declarado con causa en vez de resuelto.** Una
  vertical discontinuada queda **cerrada a altas para siempre** (`B/10`, la tabla de verticales sin
  fecha), así que **no va a existir la fila nueva que reciba el saldo**, y re-emitirlo en otra
  vertical es lo que `DEC-GRANT-006` prohíbe —la cortesía es **por suscripción**—. El saldo no se
  pierde: **queda diferido y sin emitir.** Se le presentaron al owner tres salidas —pagarlo en otra
  vertical, declararlo perdido con aviso, o convertirlo en un crédito— y **eligió no definir
  ninguna**, con esta razón, el 2026-09-21: *«una vertical no la vamos a discontinuar nunca, y si
  algún día decidimos eso, lo veremos en el momento»*. **Es un desenlace declarado, que es lo que
  `DEC-METH-006` admite**, y no un hueco olvidado: el día que se discontinúe una vertical, esta
  entrada es la que hay que releer.
- **Origen**: la FASE 9-bis-4; el borde declarado abierto en `DEC-SUB-015`; la elección del owner
  del 2026-09-21 entre las tres opciones que se le presentaron —eligió la 1, que era la
  recomendada—; y la pregunta 2 del rastro de la tanda corta
  (`21-fase-9-bis-4/rastro-8d6b27a12.md` §6), que encontró que la re-emisión no tiene destino y que
  el owner cerró declarando el escenario improbable.

---

### DEC-MP-003 — La pausa que hace el proveedor por mora lleva motivo propio, y no entra como pausa del cliente

- **Fecha**: 2026-09-22 · **Estado**: ACCEPTED · **Decide**: owner
- **El hecho que la motiva, medido el 2026-09-21/22** (`RN-2` y `GR-3` de la matriz): **el proveedor
  pausa la suscripción por su cuenta** cuando un ciclo agota sus cuatro reintentos y vence su
  ventana. Está en el mail al vendedor —*«se pausó… no recibimos el pago en la fecha original del
  cobro y los 3 intentos siguientes fallaron»*— y medido sobre tres sujetos de producción, con la
  pausa cayendo **80-105 segundos antes** del `expire_date`. `PS-4` tenía medida la **no**
  auto-reanudación; **la auto-pausa no estaba medida en ningún lado.**
- **Lo que rompía**: `B/03` §10.1 espeja ese `paused` con **`S8`, o sea con motivo
  `CUSTOMER_REQUEST`** — *«el proveedor pausó y nosotros no lo sabíamos»*—, que es la transición de
  *«la persona pide pausar»*. Consecuencias, las cuatro reales:
  1. **el moroso queda FUERA del dunning**: sin `GRACE_PERIOD`, sin reloj, sin `SUSPENDED`;
  2. **se le consume una pausa que no pidió**, contra su tope de cuatro por mes y de 120 días;
  3. **`S10` lo devuelve a `ACTIVE`** al vencer el reloj de la pausa, **sin haber cobrado nada**;
  4. y `paused` ya cargaba **dos** significados, porque es también el mecanismo de la cortesía
     (`DEC-GRANT-003`, forzado por el piso de ARS 15 de `PC-2`).
- **Decisión**: **un motivo nuevo de pausa, `PROVIDER_DUNNING`.** El espejo lo escribe en lugar de
  `CUSTOMER_REQUEST`. Los motivos pasan de **dos a tres**, y **todo lo que lee el motivo de pausa
  hay que recorrerlo** — empezando por `puedePausar()`, los topes del §26 y las salidas `S10`,
  `S22` y `PB*`.
- **Por qué no las otras dos, y la segunda razón es la que más pesa:**
  - **Una columna *«quién pausó»*, escrita cuando pausamos nosotros**: no toca el enum, pero **falla
    abierto** — si no se escribe el registro (un job que se cae, una fila vieja), **una pausa
    nuestra se lee como del proveedor**. El programa lleva cuatro vueltas midiendo que lo que hay
    que acordarse de escribir se olvida: la única lista de consumidores que existía **quedó corta
    en el mismo commit que creó su sexto miembro**.
  - **Mapear el `paused` del proveedor a `GRACE_PERIOD`**: es lo semánticamente correcto —es mora,
    no pausa— y **se descarta por una razón operativa**: **el cobro que cerraría ese grace no lo va
    a intentar nadie**, porque del lado del proveedor la suscripción está pausada y no cobra. Nos
    dejaría un reloj corriendo hacia un pago imposible, más una divergencia permanente contra el
    proveedor que el barrido del cap. 09 tendría que declarar legal. **Se prefiere un estado honesto
    —«el proveedor lo pausó por mora»— antes que uno que promete un cobro que no ocurre.**
- **Lo que esta decisión NO cierra, y va declarado**: **qué hace el dunning con esa fila.** El
  motivo la vuelve distinguible; no dice si entra a `GRACE_PERIOD`, si va directo a `SUSPENDED`, ni
  con qué reloj. Esa decisión **espera el veredicto de la [sonda 49](../docs/mp-probes/probe-49-la-ventana-de-reintentos.mjs)**,
  que se lee el **2026-09-24**: si la ventana de reintentos resulta **fija de 24 h**, el proveedor
  se rinde al día siguiente sin importar el plan y **un `GRACE_PERIOD` de 7 días no lo sostiene
  nadie**; si resulta ser **el ciclo**, con un plan mensual hay un mes de margen y el grace se ata
  al ciclo. **Son dos diseños distintos y el dato llega en dos días.**
- **Origen**: la revisión de los mails de `info@mercadopago.com` y de la API de producción del
  2026-09-21/22 (`RN-2`, `GR-3`, `RC-5`, `RC-6`, `RC-7` de la matriz), y la elección del owner del
  2026-09-22 entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-MP-004 — Lo que se le dice al cliente cuando el alta rebota sale del `status_detail`, no de un texto único

- **Fecha**: 2026-09-22 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso, medido sobre nosotros mismos el 2026-09-21/22**: tres intentos de alta en producción,
  **dos rechazados con `cc_rejected_high_risk`** — el **scoring antifraude del proveedor**, no la
  tarjeta—. Lo que MP le muestra al cliente es *«Por motivos de seguridad, tu pago fue rechazado.
  Te recomendamos pagar con el medio de pago y dispositivo que solés usar para compras online»*. Y
  el preapproval queda **`cancelled` en ~83 segundos**, irreversible (`PA-5`, `EX-3`).
- **Lo que faltaba**: `S16` ya sabe que *«el proveedor la canceló al rechazarlo»*, pero **no
  distingue POR QUÉ la rechazó**, y las causas piden decirle cosas opuestas a la persona:
  - **`cc_rejected_high_risk`** → **no tiene que tocar nada de su tarjeta**: probar más tarde, otro
    dispositivo, o escribirnos.
  - **`payment_method_not_ready`, fondos, vencimiento** → **sí tiene que revisar su medio de pago**.
- **Decisión**: **el mensaje se deriva del `status_detail`, con un mapa explícito y un texto
  genérico obligatorio** para los detalles que no estén en el mapa.
- **El motivo, y no es cosmético**: a una causa le pedís que **cambie** algo y a la otra que **no
  cambie nada**. Mostrar *«revisá tu tarjeta»* a alguien rechazado por scoring lo manda a arreglar
  algo que funciona — y como el preapproval ya murió, **cada reintento suyo crea uno nuevo que el
  scoring vuelve a rechazar**. Eso no es hipotético: **es exactamente lo que nos pasó tres veces
  seguidas la noche del 21**.
- **Las dos alternativas:**
  - **Un solo mensaje neutro** para todos los rechazos: nunca miente y no cuesta mantenimiento,
    pero **al que sí tiene un problema de tarjeta no le dice cómo resolverlo**, y va a reintentar
    igual, creando otra alta muerta.
  - **Dejarlo sin especificar**, como está hoy: en la práctica termina siendo *«revisá tu tarjeta»*,
    que es el default de la industria y **el peor posible para el caso `high_risk`**.
- **Lo que hay que tener en cuenta al escribir el mapa**: **`RC-6` midió que el `status_detail`
  cambia entre intentos** —es el del último, no el del primero—. En el **alta** eso no molesta,
  porque hay un solo intento y el preapproval muere ahí; **en una renovación sí**, y el mapa no
  debe leerse temprano.
- **Lo que esta decisión NO cierra**: (1) **el contenido del mapa** —qué `status_detail` existen y
  cómo se agrupan— que se llena con lo medido y no se inventa; y (2) **qué hacemos para que el
  cliente no cree altas muertas en serie** cuando el scoring lo rechaza. La segunda es un problema
  de producto propio y no tiene decisión todavía.
- **Origen**: los tres intentos de alta de la sonda 49 del 2026-09-21/22, y la elección del owner
  del 2026-09-22 entre las tres opciones que se le presentaron — eligió la 1, que era la
  recomendada.

---

### DEC-METH-012 — La justificación de una aparición cubre el CUANTIFICADOR de la cita y no afirma nada que no esté verificado en ella

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-011`, que no la deroga.** `DEC-METH-011` hizo que el rastro existiera; ésta
  dice qué tiene que decir cada línea.
- **Lo que `DEC-METH-011` compró, medido en la FASE 8-bis-5 y acreditado antes que nada**: se
  ejecutó entera —**47 de 47** commits que editan el corpus nombrados en alguno de los diez
  rastros, **1.030** apariciones justificadas una por una— y **es la razón por la que esta decisión
  se puede escribir**. Los ocho informes revisaron **887** líneas y exhibieron **16 líneas falsas
  distintas, con archivo y línea**. Con *«72 apariciones justificadas una por una»* en un mensaje de
  commit, ninguna de las 16 era señalable. **Es la primera vez que el programa mide la CALIDAD de
  una resolución y no sólo su existencia** — entre 1,8 % y 3,1 % de falsas.
- **Y la serie bajó por primera vez en cinco vueltas**: **6 de 8** críticos distintos vienen de la
  tanda anterior, contra 12/12, 13/14, 17/17 y 25/25. Los dos que no vienen son de clases que el
  programa nunca había producido: una **medición externa** (`RC-5`) y una **lectura del conjunto**
  (la dirección inversa del contrato sin constructor).
- **El problema que queda, y es dónde se movió el agujero**: la regla **llega al lugar correcto en
  4 de los 6** críticos y **resuelve mal**. No es que no se ejecute —ése era el diagnóstico de
  `DEC-METH-011`— ni que no alcance: la aparición está en el rastro, recorrida, con su justificación
  escrita, y la justificación es falsa. Dos formas:
  1. **la resolución dice MENOS que la cita** — verifica un sujeto más angosto que el que la cita
     cuantifica (se verificó que los tres avisos *estuvieran*, no que los lectores *fueran cinco*);
  2. **la resolución dice MÁS que la cita** — le agrega una garantía que nadie verificó
     (*«…y ahora esa ficha además tiene cómo volver cuando el cupo se libere»*), y esa cláusula
     nueva es la que cierra el caso en falso.
- **Decisión**: la justificación de cada aparición no corregida **responde por la cláusula entera
  que cita —su cuantificador incluido— y no afirma nada que no esté verificado en la cita misma.**
- **La forma operativa, sacada de las cuatro que fallaron**: **la justificación no puede empezar con
  *«lo que cambió es…»***. Las tres del modo por delta empiezan así —*«lo que cambió es de dónde se
  lee»*, *«lo que cambió es el motivo»*, *«lo que cambia es el alcance del remedio»*—. **Nombrar el
  cambio y descartarlo en la misma frase es la firma del modo.**
- **Y la forma correcta no hay que inventarla: ya está escrita, por el mismo equipo, en el mismo
  artefacto.** Dos líneas del 2 % bueno son el patrón a copiar: *«la cláusula que la salva es la que
  ella misma escribe»* (`rastro-f21d5d828.md` sobre `B/02` §2.2, que además **enumera los seis
  sitios que deliberadamente no tocó y por qué**) y *«si alguna se hubiera escrito como «el último»
  o «de seis», sería falsa»* (`rastro-032f761e0.md` sobre los ordinales del espejo).
- **Lo que compra, y el número sale de una medición y no de una estimación**: **4 de los 6** críticos
  de la vuelta y **9 de las 16** líneas falsas. Es más de lo que ninguna corrección propuesta hasta
  hoy compró.
- **El costo, y es la razón de haberla elegido sola**: **dos renglones de la regla y ningún trabajo
  nuevo por aparición.** No pide recorrer más apariciones: pide que la justificación de cada una
  responda por la cláusula entera. **No agrega ningún mecanismo que alguien tenga que acordarse de
  correr**, que es exactamente el criterio con que `DEC-MP-003` descartó la columna *«quién pausó»*.
- **Las tres que NO van, y qué se acepta al dejarlas afuera** — el owner eligió esta sola por encima
  de la opción que la combinaba con la segunda:
  1. **El barrido de caducidad** (cada línea nombra el `archivo §` del objeto sobre el que afirma, y
     un barrido al cierre re-evalúa las que ese archivo tocó después). **Se acepta que las 6
     caducidades sigan**: una línea verdadera el día que se escribió que un commit POSTERIOR de la
     misma tanda vuelve falsa, sin que nadie edite ni el capítulo ni el rastro. Ninguna de las seis
     produjo un crítico; lo que producen es **la sensación de que el corpus está verificado cuando
     no lo está**. **Se descartó porque agrega mecanismo** —una columna y un comando al cierre— y el
     programa lleva cinco vueltas midiendo que lo que hay que acordarse de escribir se olvida. Se
     detectarán en la vuelta siguiente, como hasta ahora.
     ⚠️ **Y si alguna vez se implementa, no con `git log -S` sobre la cita**: se midió sobre las dos
     caducidades más limpias y **devolvió cero en las dos**, porque la caducidad no cambia la cita,
     cambia lo que la hace verdadera, que vive en otro archivo.
  2. **Levantar la exclusión de la prosa que el commit escribe o edita.** Compra **2 de los 6**,
     contra los 5 de 12 que se le estimaron en la 8-bis-4: **la medición corrigió a la recomendación
     anterior**, que la ponía primera. Sigue siendo la de costo más alto —un commit que escribe tres
     párrafos tendría que justificar cada afirmación que hace—. **El agujero se achicó solo**: de
     5 de 9 a 2 de 6.
  3. **Ampliar el alcance al decision log.** Es el **cuarto desenlace**, que ninguna vuelta había
     visto: el sexto sitio de *«`G-R4` sigue contando tres»* vive en este mismo archivo, que el
     alcance del rastro excluye por definición. Compra 2 conteos falsos. **Se descarta como está y
     queda acotada a futuro**: lo que habría que vigilar del log no es toda aparición sino **las
     cifras del bloque `## Resumen`**; las razones internas de cada decisión son registro histórico
     y caducarlas sería borrar el rastro del programa.
- **Origen**: la FASE 8-bis-5, `22-fase-8-bis-5/C1-la-costura.md` §4.5 (Corrección E), y la elección
  del owner del 2026-09-23 entre las tres opciones que se le presentaron. **Eligió la 2 —la enmienda
  sola, sin el barrido—, apartándose de la recomendación de `C1`**, que proponía las dos juntas. La
  razón del owner es la que el programa ya tiene medida y escrita: **entre dos correcciones, la que
  no agrega mecanismo.** El riesgo aceptado son las seis caducidades, declarado arriba para que se
  pueda evaluar después.

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | **89** |
| De metodología | 12 |
| Funcionales | 77 |
| | Recontadas el 2026-09-16 leyendo los encabezados, no a mano: la tabla venía arrastrando **un error de uno** desde antes de esta sesión. La plantilla del formato (`### DEC-<AREA>-<NNN>`) no es una decisión y no se cuenta |
| `SUPERSEDED` | **3** — `DEC-SUB-001` por `DEC-SUB-005`, `DEC-SUB-005` por `DEC-SUB-006`, y **`DEC-MIG-001` EN PARTE** por `DEC-MIG-003` (sobrevive *«cero código de migración»*, se cae el destino) |
| **Preguntas del owner abiertas** | **0 de 25** |
| Bloqueantes de FASE 2 que decide el owner | **9 de 9 cerradas** — `BD-MP-04` volvió al owner y la cerró `DEC-ADDON-002` |
| Bloqueantes de FASE 2 que decide el experimento | **0 abiertas** — `BD-MP-01` (pausa) la cerró `DEC-SUB-010` y `BD-MP-02` (cortesía) la cerró `DEC-GRANT-003`, las dos el 2026-09-16 con el reloj leído; `BD-MP-03` la había cerrado `DEC-MP-001`; `BD-MP-04` tiene sus filas medidas pero **le sobrevivió una elección de diseño** |
| Decisiones condicionadas a FASE 1C | **1** — `DEC-SUB-010`, a la segunda lectura del reloj (¿la fecha corre +1 ciclo por vencimiento **indefinidamente**, o sólo la primera vez?) |
| | `DEC-SUB-006` y `DEC-SUB-007` **se destrabaron el 2026-09-16**: `EX-33` quedó `VERIFIED` en **producción con tarjeta real**, medido tres veces sobre el mismo pagador. El checkout respeta la fecha de primer cobro futura, así que el cliente que cambia de ciclo no paga dos veces. ⚠️ Pero la medición trajo `EX-38` de arriba: el proveedor **convierte esa fecha en un free trial** y se lo anuncia al cliente como «Tu prueba gratis comenzó». El mecanismo funciona; **lo que hay que resolver es qué le decimos nosotros a alguien a quien el proveedor acaba de anunciarle una prueba gratis sobre días que ya pagó** |
| Decisiones de arquitectura del owner | **4**, las cuatro del 2026-09-18 — **`DEC-ARCH-004`**: el billing se implementa de nuestro lado, con la pasarela detrás de un adaptador. Es la **primera decisión del programa que no sale de una medición sino de un criterio del owner**. **`DEC-ARCH-005`**: el programa se parte en dos épicas **autónomas**, `HOS-1353` (verticales, arranca) y `HOS-1354` (billing, espera). **`DEC-ARCH-006`**: la frontera entre las dos es un contrato único con dos implementaciones desde el día uno — la condición B de `DEC-ARCH-004` aplicada a esta frontera. **`DEC-ARCH-007`**: se desarrollan en paralelo y **se liberan juntas** — ninguna llega a producción sola, y una rama de integración del paraguas lo hace cumplir |
| Apartamientos declarados del PDR | **7** — `DEC-ENT-001` (§10.3), `DEC-GRANT-002` (§34) y **`DEC-ARCH-003`** (§10.6, el `SUSPENDED` doble, que ya estaba anticipado acá y el 2026-09-17 tomó ID propio), **`DEC-OBS-001`** (§22.1, el aviso agregado en vez de uno por evento), **`DEC-METH-004`** (§65, la FASE 9 con cuatro salidas en vez de los cuatro documentos, y el criterio de «resuelto»), **`DEC-SUB-011`** (§11 y §64.8, el invariante 8 cuenta compromisos y no filas) y **`DEC-METH-006`** (§65, la FASE 8 vuelve a correr sobre lo que la 9 produjo, en vez de fases en secuencia) |
| Decisiones de la FASE 9 | **6**, las seis del 2026-09-19 — `DEC-GRANT-005` (el grant anclado al plan, con trinquete), `DEC-CONC-003` (la marca, que **revisa una razón escrita del owner**), `DEC-SUB-011` (compromisos, no filas), `DEC-MIG-003` (no se migra), `DEC-METH-006` (el ciclo 8 ↔ 9) y `DEC-METH-007` (el gate de FASE 5, con criterio de dos filtros). Salieron de las 37 preguntas que los cinco racimos resueltos dejaron para el owner |
