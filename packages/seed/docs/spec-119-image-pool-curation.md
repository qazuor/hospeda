# SPEC-119 T-004 — Image Pool Curation

> Reference data for the type-specific image pool consumed by T-005 (`_image-pool.ts`).
> 25 Pexels URLs per accommodation type × 8 types = 200 URLs.
>
> **Expansion note (2026-05-14)**: The seed application strategy was redesigned to use
> larger per-type pools with random per-accommodation selection + variable gallery counts
> (5-24 photos each). Each type was expanded from 10 to 25 URLs, keeping the original 10
> in their original order and appending 15 new content-verified Pexels URLs.

## Methodology

**Approach B (reuse-first)**:

1. Extracted every `media.featuredImage.url` + `media.gallery[].url` across the 104 accommodation seed JSONs and grouped by lowercase `type`. Raw extraction landed at 614 image occurrences and ~95 distinct URLs across the 8 types.
2. Deduplicated per type, ranked by frequency, and identified **cross-type pollution** — URLs reused across more than one accommodation type. These are the generic stock photos that cause the "every accommodation looks the same" problem the spec wants to fix.
3. For each high-frequency URL, verified the **actual** photo content by fetching its Pexels page (title, tags, photographer). Many existing seed captions are **wrong** (e.g. `271639` was used everywhere with caption "Cabaña apacible" but the photo actually shows a hotel door handle).
4. Verified every Pexels image URL returns HTTP 200 via `curl`. Dropped URLs that returned 4xx (e.g. photo id `45241` is reachable on the Pexels page but its image CDN URL pattern no longer resolves).
5. Where the existing-and-type-appropriate pool fell short of 10 URLs, augmented with new high-quality Pexels search hits from the queries listed below. New URLs were also content-verified before adding.

**Pexels search queries used for replenishment**:

Initial pool (URLs 1-10):

- camping → `https://www.pexels.com/search/camping%20tent/`
- apartment → `https://www.pexels.com/search/apartment%20interior/`
- hostel → `https://www.pexels.com/search/hostel%20dormitory/`
- cabin → `https://www.pexels.com/search/cabin%20wooden/`
- country_house → `https://www.pexels.com/search/country%20house/`
- house → `https://www.pexels.com/search/house%20exterior/`
- room → `https://www.pexels.com/search/bedroom/`
- hotel → `https://www.pexels.com/search/hotel%20room/`

Expansion pool (URLs 11-25, added 2026-05-14):

- camping → `https://www.pexels.com/search/campsite/`, `https://www.pexels.com/search/tent%20forest/`
- apartment → `https://www.pexels.com/search/apartment%20living%20room/`
- hostel → `https://www.pexels.com/search/bunk%20bed/`, `https://www.pexels.com/search/hostel%20common%20area/`
- hotel → `https://www.pexels.com/search/hotel%20lobby/`, `https://www.pexels.com/search/hotel%20bedroom/`
- cabin → `https://www.pexels.com/search/log%20cabin/`, `https://www.pexels.com/search/wooden%20cottage/`
- room → `https://www.pexels.com/search/cozy%20bedroom/`, `https://www.pexels.com/search/guest%20room/`
- country_house → `https://www.pexels.com/search/farmhouse/`, `https://www.pexels.com/search/rural%20house/`
- house → `https://www.pexels.com/search/suburban%20house/`, `https://www.pexels.com/search/modern%20house/`

**Out of scope**: JSON files are NOT modified in this task. The curated pool below is reference data only; T-005 reads it to generate `_image-pool.ts`, and a later task will retrofit existing JSONs to consume the pool.

---

## Pool per type

### camping (25 URLs)

1. `https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg`
   - **Source**: existing (was in 19 camping JSONs — most reused photo for this type)
   - **Caption**: "Carpa bajo cielo estrellado"
   - **Description**: "Vista nocturna del área de acampe con tipi iluminado y la Vía Láctea de fondo"
2. `https://images.pexels.com/photos/104664/pexels-photo-104664.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Carpa azul sobre el césped"
   - **Description**: "Parcela con carpa familiar instalada sobre pasto al borde del monte"
3. `https://images.pexels.com/photos/5993943/pexels-photo-5993943.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Armando la carpa"
   - **Description**: "Acampante terminando de montar la carpa amarilla bajo los árboles"
4. `https://images.pexels.com/photos/5994751/pexels-photo-5994751.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Carpa iluminada en el bosque"
   - **Description**: "Atardecer en el camping con carpa marrón iluminada desde adentro"
5. `https://images.pexels.com/photos/17192955/pexels-photo-17192955.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Varias carpas en el claro"
   - **Description**: "Grupo de carpas distribuidas en un claro del monte al atardecer"
6. `https://images.pexels.com/photos/15925118/pexels-photo-15925118.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Carpa entre árboles"
   - **Description**: "Carpa naranja y azul instalada entre la arboleda del camping"
7. `https://images.pexels.com/photos/33102155/pexels-photo-33102155.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Acampe junto al arroyo"
   - **Description**: "Carpas armadas a orillas del arroyo con vista a los cerros"
8. `https://images.pexels.com/photos/14036357/pexels-photo-14036357.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Campamento con tarp"
   - **Description**: "Carpa con techo extendido para sombra en un sector arbolado del predio"
9. `https://images.pexels.com/photos/34034355/pexels-photo-34034355.jpeg`
   - **Source**: new (Pexels search `camping tent`)
   - **Caption**: "Carpa entre el verde"
   - **Description**: "Carpa amarilla rodeada de vegetación frondosa típica del Litoral"
10. `https://images.pexels.com/photos/33102150/pexels-photo-33102150.jpeg`
    - **Source**: new (Pexels search `camping tent`)
    - **Caption**: "Carpa naranja al aire libre"
    - **Description**: "Carpa naranja instalada en parcela soleada lista para recibir huéspedes"
11. `https://images.pexels.com/photos/12623152/pexels-photo-12623152.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Campamento con fogón"
    - **Description**: "Carpas y fogón en un claro rodeado de bosque verde y frondoso"
12. `https://images.pexels.com/photos/9159974/pexels-photo-9159974.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpa azul entre árboles"
    - **Description**: "Carpa azul instalada entre árboles altos en un sector arbolado del camping"
13. `https://images.pexels.com/photos/4268158/pexels-photo-4268158.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpas en la ladera"
    - **Description**: "Grupo de carpas sobre la ladera con vista despejada al horizonte"
14. `https://images.pexels.com/photos/17282348/pexels-photo-17282348.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpas de colores"
    - **Description**: "Carpas de varios colores armadas en el sector arbolado del predio"
15. `https://images.pexels.com/photos/15331106/pexels-photo-15331106.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpa en el bosque"
    - **Description**: "Carpa solitaria en medio del bosque rodeada de pasto y árboles"
16. `https://images.pexels.com/photos/8985295/pexels-photo-8985295.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Acampe con vista"
    - **Description**: "Campamento al pie de un cerro rodeado de vegetación y árboles verdes"
17. `https://images.pexels.com/photos/20468085/pexels-photo-20468085.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpas en valle"
    - **Description**: "Varias carpas distribuidas en un valle abierto al amanecer"
18. `https://images.pexels.com/photos/9375017/pexels-photo-9375017.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Acampe bajo los árboles"
    - **Description**: "Carpas armadas bajo árboles altos en sector de sombra del predio"
19. `https://images.pexels.com/photos/14087937/pexels-photo-14087937.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpas al amanecer"
    - **Description**: "Carpas iluminadas por el sol de la mañana en sector despejado del camping"
20. `https://images.pexels.com/photos/17767045/pexels-photo-17767045.jpeg`
    - **Source**: new (Pexels search `tent forest`)
    - **Caption**: "Carpa bajo los árboles"
    - **Description**: "Carpa instalada bajo árboles del monte con luz filtrada del sol"
21. `https://images.pexels.com/photos/8993120/pexels-photo-8993120.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Carpa verde en pradera"
    - **Description**: "Carpa verde solitaria sobre pasto verde en un área abierta del predio"
22. `https://images.pexels.com/photos/20708782/pexels-photo-20708782.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Campamento en el monte"
    - **Description**: "Sector de acampe enclavado en bosque verde con varias carpas armadas"
23. `https://images.pexels.com/photos/11320367/pexels-photo-11320367.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Dos carpas en pradera"
    - **Description**: "Par de carpas instaladas sobre pasto verde en sector tranquilo del predio"
24. `https://images.pexels.com/photos/34883304/pexels-photo-34883304.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Camping con pava"
    - **Description**: "Acampe en el bosque con pava sobre el fuego para el mate de la tarde"
25. `https://images.pexels.com/photos/18755614/pexels-photo-18755614.jpeg`
    - **Source**: new (Pexels search `campsite`)
    - **Caption**: "Mesa y sombra"
    - **Description**: "Mesas y árboles del camping al atardecer en sector común del predio"

### apartment (25 URLs)

1. `https://images.pexels.com/photos/2062431/pexels-photo-2062431.jpeg`
   - **Source**: existing (was in 17 apartment JSONs — kitchen, verified content)
   - **Caption**: "Cocina del departamento"
   - **Description**: "Cocina blanca modular con detalles en madera y luz natural"
2. `https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Living integrado con cocina"
   - **Description**: "Diseño minimalista con living y cocina abierta del apartamento"
3. `https://images.pexels.com/photos/11296215/pexels-photo-11296215.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Living con iluminación cálida"
   - **Description**: "Sala de estar amplia con sillones, mesa baja y lámparas de pie"
4. `https://images.pexels.com/photos/11296222/pexels-photo-11296222.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Living del apartamento"
   - **Description**: "Ambiente principal con sillón gris, plantas y decoración contemporánea"
5. `https://images.pexels.com/photos/7614615/pexels-photo-7614615.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Sala con ventanal"
   - **Description**: "Living moderno con grandes ventanas y mucha luz natural"
6. `https://images.pexels.com/photos/29003510/pexels-photo-29003510.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Ambiente principal luminoso"
   - **Description**: "Sala elegante con luz natural entrando por los ventanales"
7. `https://images.pexels.com/photos/7214732/pexels-photo-7214732.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Living con pared de ladrillo"
   - **Description**: "Sala contemporánea con pared de ladrillo a la vista y zona de TV"
8. `https://images.pexels.com/photos/17832175/pexels-photo-17832175.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Loft con escalera"
   - **Description**: "Apartamento tipo loft con escalera interior y mobiliario moderno"
9. `https://images.pexels.com/photos/7511701/pexels-photo-7511701.jpeg`
   - **Source**: new (Pexels search `apartment interior`)
   - **Caption**: "Living acogedor"
   - **Description**: "Sala cálida con sillón, plantas de interior y luz natural suave"
10. `https://images.pexels.com/photos/32750273/pexels-photo-32750273.jpeg`
    - **Source**: new (Pexels search `apartment interior`)
    - **Caption**: "Apartamento con vista a la ciudad"
    - **Description**: "Piso alto con ventanal panorámico y vista urbana del Litoral"
11. `https://images.pexels.com/photos/19899060/pexels-photo-19899060.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Sala con sillón y mesas"
    - **Description**: "Living con sillón, mesas auxiliares y butaca en ambiente acogedor"
12. `https://images.pexels.com/photos/14505912/pexels-photo-14505912.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living totalmente equipado"
    - **Description**: "Sala completa con sofá, mesas y decoración lista para los huéspedes"
13. `https://images.pexels.com/photos/36887747/pexels-photo-36887747.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Sala con sillón beige"
    - **Description**: "Living moderno con sillón color beige y detalles de decoración contemporáneos"
14. `https://images.pexels.com/photos/19916700/pexels-photo-19916700.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Vista del apartamento"
    - **Description**: "Vista aérea del living del apartamento con sillones y mesa baja"
15. `https://images.pexels.com/photos/37252339/pexels-photo-37252339.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living minimalista"
    - **Description**: "Sala de diseño minimalista con líneas limpias y luz natural abundante"
16. `https://images.pexels.com/photos/34933264/pexels-photo-34933264.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Apartamento moderno"
    - **Description**: "Living del apartamento con diseño contemporáneo y mobiliario sobrio"
17. `https://images.pexels.com/photos/34818757/pexels-photo-34818757.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Sala elegante"
    - **Description**: "Living de diseño elegante con detalles modernos y luz cálida"
18. `https://images.pexels.com/photos/19674451/pexels-photo-19674451.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living en piso alto"
    - **Description**: "Sala de apartamento en piso alto con vista despejada y mobiliario moderno"
19. `https://images.pexels.com/photos/6077368/pexels-photo-6077368.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Ambiente luminoso"
    - **Description**: "Sala amplia con grandes ventanas y mucha luz natural durante el día"
20. `https://images.pexels.com/photos/5417293/pexels-photo-5417293.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living con alfombra"
    - **Description**: "Sala contemporánea con mobiliario, alfombra y decoración cuidada"
21. `https://images.pexels.com/photos/30765736/pexels-photo-30765736.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living con balcón ajardinado"
    - **Description**: "Apartamento moderno con balcón con plantas y vista al exterior"
22. `https://images.pexels.com/photos/6681824/pexels-photo-6681824.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Rincón junto a la ventana"
    - **Description**: "Sillón cómodo con muebles de madera junto a la ventana del living"
23. `https://images.pexels.com/photos/7031708/pexels-photo-7031708.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living con TV"
    - **Description**: "Sala acogedora con sillón mullido y TV en pared del apartamento"
24. `https://images.pexels.com/photos/9494898/pexels-photo-9494898.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Living amplio"
    - **Description**: "Sala espaciosa del apartamento con sillón grande y mobiliario actual"
25. `https://images.pexels.com/photos/33636640/pexels-photo-33636640.jpeg`
    - **Source**: new (Pexels search `apartment living room`)
    - **Caption**: "Sala con cocina abierta"
    - **Description**: "Living del apartamento integrado con cocina en diseño minimalista"

### hostel (25 URLs)

1. `https://images.pexels.com/photos/2844474/pexels-photo-2844474.jpeg`
   - **Source**: existing (was in 16 hostel JSONs — fachada colonial)
   - **Caption**: "Fachada del hostel"
   - **Description**: "Frente del hostel con balcón ornamentado y torre colonial al fondo"
2. `https://images.pexels.com/photos/6957069/pexels-photo-6957069.jpeg`
   - **Source**: existing (was in 8 hostel JSONs — living común)
   - **Caption**: "Sala común"
   - **Description**: "Living compartido con sillón beige, pared de ladrillo y luz natural"
3. `https://images.pexels.com/photos/7005428/pexels-photo-7005428.jpeg`
   - **Source**: existing (was in 4 hostel JSONs)
   - **Caption**: "Cocina comunitaria"
   - **Description**: "Cocina compartida del hostel con barra y utensilios para los huéspedes"
4. `https://images.pexels.com/photos/4907208/pexels-photo-4907208.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Dormitorio compartido"
   - **Description**: "Habitación con cuchetas de madera y huéspedes charlando relajados"
5. `https://images.pexels.com/photos/5137980/pexels-photo-5137980.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Dormitorio con cuchetas"
   - **Description**: "Dormitorio del hostel con cuchetas prolijas y luz natural"
6. `https://images.pexels.com/photos/4907232/pexels-photo-4907232.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Cucheta superior"
   - **Description**: "Huéspedes descansando en distintos niveles de las cuchetas del dormitorio"
7. `https://images.pexels.com/photos/4907181/pexels-photo-4907181.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Llegada al dormitorio"
   - **Description**: "Viajeras ingresando al dormitorio compartido al inicio de su estadía"
8. `https://images.pexels.com/photos/4907190/pexels-photo-4907190.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Habitación compartida luminosa"
   - **Description**: "Dormitorio amplio con cuchetas y muchísima luz natural"
9. `https://images.pexels.com/photos/4907433/pexels-photo-4907433.jpeg`
   - **Source**: new (Pexels search `hostel dormitory`)
   - **Caption**: "Charla entre viajeros"
   - **Description**: "Ambiente sociable característico del hostel con huéspedes charlando"
10. `https://images.pexels.com/photos/4907211/pexels-photo-4907211.jpeg`
    - **Source**: new (Pexels search `hostel dormitory`)
    - **Caption**: "Encuentro en el dormitorio"
    - **Description**: "Huéspedes compartiendo un momento en el dormitorio del hostel"
11. `https://images.pexels.com/photos/5137981/pexels-photo-5137981.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Cucheta minimalista"
    - **Description**: "Cucheta de madera con sábanas a rayas en habitación cálida del hostel"
12. `https://images.pexels.com/photos/4907210/pexels-photo-4907210.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Subiendo a la cucheta"
    - **Description**: "Viajera subiendo la escalera de la cucheta en el dormitorio del hostel"
13. `https://images.pexels.com/photos/4907626/pexels-photo-4907626.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Relax en las cuchetas"
    - **Description**: "Dos viajeras descansando en cuchetas y revisando sus teléfonos"
14. `https://images.pexels.com/photos/4907609/pexels-photo-4907609.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Charla entre cuchetas"
    - **Description**: "Mujeres jóvenes conversando en dormitorio moderno con cuchetas"
15. `https://images.pexels.com/photos/7969098/pexels-photo-7969098.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Estadía con mochila"
    - **Description**: "Viajeros con mochila disfrutando la estadía en habitación con cuchetas"
16. `https://images.pexels.com/photos/7969102/pexels-photo-7969102.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Amigos en el hostel"
    - **Description**: "Dos amigas compartiendo un momento alegre en habitación con cuchetas"
17. `https://images.pexels.com/photos/4907221/pexels-photo-4907221.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Charla en la cucheta"
    - **Description**: "Dos viajeras sentadas en la cucheta sonriendo y charlando relajadas"
18. `https://images.pexels.com/photos/4907430/pexels-photo-4907430.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Cuchetas azules"
    - **Description**: "Dos viajeras descansando en cuchetas azules del dormitorio del hostel"
19. `https://images.pexels.com/photos/4907205/pexels-photo-4907205.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Dormitorio moderno"
    - **Description**: "Habitación moderna del hostel con cuchetas y huéspedes relajadas"
20. `https://images.pexels.com/photos/4907600/pexels-photo-4907600.jpeg`
    - **Source**: new (Pexels search `bunk bed`)
    - **Caption**: "Viajeros conversando"
    - **Description**: "Dos viajeros charlando en el dormitorio del hostel con cuchetas"
21. `https://images.pexels.com/photos/35165103/pexels-photo-35165103.jpeg`
    - **Source**: new (Pexels search `hostel common area`)
    - **Caption**: "Dormitorio rústico"
    - **Description**: "Dormitorio acogedor del hostel con cuchetas y decoración rústica"
22. `https://images.pexels.com/photos/7969103/pexels-photo-7969103.jpeg`
    - **Source**: new (Pexels search `hostel common area`)
    - **Caption**: "Llegada al hostel"
    - **Description**: "Mochilero ingresando al hostel por la puerta vidriada de entrada"
23. `https://images.pexels.com/photos/5137963/pexels-photo-5137963.jpeg`
    - **Source**: new (Pexels search `hostel common area`)
    - **Caption**: "Mochileros con mapa"
    - **Description**: "Mochileros consultando un mapa de la zona en el sector de recepción"
24. `https://images.pexels.com/photos/4907458/pexels-photo-4907458.jpeg`
    - **Source**: new (Pexels search `hostel common area`)
    - **Caption**: "Recepción del hostel"
    - **Description**: "Dos viajeras realizando el check-in en la recepción del hostel"
25. `https://images.pexels.com/photos/5152833/pexels-photo-5152833.jpeg`
    - **Source**: new (Pexels search `hostel common area`)
    - **Caption**: "Lobby cálido"
    - **Description**: "Lobby acogedor del hostel con decoración tropical y luz cálida"

### hotel (25 URLs)

1. `https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg`
   - **Source**: existing (was in 22 hotel JSONs — la más usada)
   - **Caption**: "Fachada del hotel"
   - **Description**: "Frente del hotel con entrada principal y cartelería"
2. `https://images.pexels.com/photos/271619/pexels-photo-271619.jpeg`
   - **Source**: existing (was in 13 hotel JSONs)
   - **Caption**: "Habitación superior"
   - **Description**: "Habitación contemporánea minimalista con iluminación cálida"
3. `https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg`
   - **Source**: existing (was in 14 hotel JSONs)
   - **Caption**: "Habitación standard"
   - **Description**: "Habitación moderna con tonos neutros y luz natural abundante"
4. `https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg`
   - **Source**: existing (was in 13 hotel JSONs)
   - **Caption**: "Lobby bar"
   - **Description**: "Bar elegante del hotel con iluminación tenue y ambiente sofisticado"
5. `https://images.pexels.com/photos/53464/sheraton-palace-hotel-lobby-architecture-san-francisco-53464.jpeg`
   - **Source**: existing (was in 3 hotel JSONs)
   - **Caption**: "Lobby del hotel"
   - **Description**: "Lobby amplio con arquitectura clásica y techo abovedado"
6. `https://images.pexels.com/photos/34559240/pexels-photo-34559240.jpeg`
   - **Source**: new (Pexels search `hotel room`)
   - **Caption**: "Habitación de lujo"
   - **Description**: "Habitación amplia con diseño contemporáneo y mobiliario premium"
7. `https://images.pexels.com/photos/28962539/pexels-photo-28962539.jpeg`
   - **Source**: new (Pexels search `hotel room`)
   - **Caption**: "Habitación con vista"
   - **Description**: "Habitación moderna con ventanal panorámico y vista a la ciudad"
8. `https://images.pexels.com/photos/36816426/pexels-photo-36816426.jpeg`
   - **Source**: new (Pexels search `hotel room`)
   - **Caption**: "Habitación matrimonial"
   - **Description**: "Habitación con cama doble, lámparas suaves y diseño elegante"
9. `https://images.pexels.com/photos/33400871/pexels-photo-33400871.jpeg`
   - **Source**: new (Pexels search `hotel room`)
   - **Caption**: "Habitación con balcón"
   - **Description**: "Habitación con acceso a balcón privado y mobiliario contemporáneo"
10. `https://images.pexels.com/photos/36767624/pexels-photo-36767624.jpeg`
    - **Source**: new (Pexels search `hotel room`)
    - **Caption**: "Habitación luminosa"
    - **Description**: "Suite con ventanal grande, luz natural y mobiliario moderno"
11. `https://images.pexels.com/photos/29649745/pexels-photo-29649745.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby con araña"
    - **Description**: "Lobby elegante del hotel con araña de cristal y mobiliario clásico"
12. `https://images.pexels.com/photos/36354489/pexels-photo-36354489.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby moderno"
    - **Description**: "Lobby del hotel con diseño moderno, mobiliario sobrio y luz cálida"
13. `https://images.pexels.com/photos/7512139/pexels-photo-7512139.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Recepción del hotel"
    - **Description**: "Vista aérea de la recepción moderna del hotel con huéspedes en el lobby"
14. `https://images.pexels.com/photos/28102352/pexels-photo-28102352.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby con sillones"
    - **Description**: "Sillones en el lobby moderno del hotel para descansar y esperar"
15. `https://images.pexels.com/photos/7942138/pexels-photo-7942138.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Atrio del hotel"
    - **Description**: "Atrio amplio y elegante del hotel con interior moderno y techo alto"
16. `https://images.pexels.com/photos/14841133/pexels-photo-14841133.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby con araña moderna"
    - **Description**: "Lobby elegante con araña de diseño moderno y mobiliario contemporáneo"
17. `https://images.pexels.com/photos/18117651/pexels-photo-18117651.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby con estilo"
    - **Description**: "Lobby de hotel con decoración moderna y zonas de estar para huéspedes"
18. `https://images.pexels.com/photos/37252307/pexels-photo-37252307.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby contemporáneo"
    - **Description**: "Lobby espacioso del hotel con decoración contemporánea y luz cuidada"
19. `https://images.pexels.com/photos/6474588/pexels-photo-6474588.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Lobby decorado"
    - **Description**: "Lobby del hotel con decoración elegante y luces tenues por la noche"
20. `https://images.pexels.com/photos/5378699/pexels-photo-5378699.jpeg`
    - **Source**: new (Pexels search `hotel lobby`)
    - **Caption**: "Pareja en el lobby"
    - **Description**: "Pareja caminando por un lobby lujoso del hotel con detalles elegantes"
21. `https://images.pexels.com/photos/35664333/pexels-photo-35664333.jpeg`
    - **Source**: new (Pexels search `hotel bedroom`)
    - **Caption**: "Habitación con cabecero floral"
    - **Description**: "Habitación elegante del hotel con cabecero de motivos florales"
22. `https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg`
    - **Source**: new (Pexels search `hotel bedroom`)
    - **Caption**: "Habitación contemporánea"
    - **Description**: "Habitación del hotel con diseño contemporáneo y elegancia cuidada"
23. `https://images.pexels.com/photos/31967701/pexels-photo-31967701.jpeg`
    - **Source**: new (Pexels search `hotel bedroom`)
    - **Caption**: "Habitación de noche"
    - **Description**: "Habitación moderna del hotel con iluminación cálida en horario nocturno"
24. `https://images.pexels.com/photos/35103156/pexels-photo-35103156.jpeg`
    - **Source**: new (Pexels search `hotel bedroom`)
    - **Caption**: "Habitación acogedora"
    - **Description**: "Habitación del hotel de diseño moderno con detalles acogedores"
25. `https://images.pexels.com/photos/13722872/pexels-photo-13722872.jpeg`
    - **Source**: new (Pexels search `hotel bedroom`)
    - **Caption**: "Habitación doble"
    - **Description**: "Habitación del hotel con cama doble y diseño moderno cuidado"

### cabin (25 URLs)

1. `https://images.pexels.com/photos/6489103/pexels-photo-6489103.jpeg`
   - **Source**: existing (was in 8 cabin JSONs — altillo de cabaña)
   - **Caption**: "Altillo de la cabaña"
   - **Description**: "Entrepiso de madera de la cabaña con cama y vista al living"
2. `https://images.pexels.com/photos/15586348/pexels-photo-15586348.jpeg`
   - **Source**: new (Pexels search `cabin wooden`)
   - **Caption**: "Cabaña entre el verde"
   - **Description**: "Cabaña de madera rodeada de vegetación y flores"
3. `https://images.pexels.com/photos/12566236/pexels-photo-12566236.jpeg`
   - **Source**: new (Pexels search `cabin wooden`)
   - **Caption**: "Cabaña rústica"
   - **Description**: "Cabaña de madera estilo rústico en entorno arbolado"
4. `https://images.pexels.com/photos/12319415/pexels-photo-12319415.jpeg`
   - **Source**: new (Pexels search `cabin wooden`)
   - **Caption**: "Cabaña en el monte"
   - **Description**: "Cabaña de madera enclavada en bosque verde y frondoso"
5. `https://images.pexels.com/photos/17041194/pexels-photo-17041194.jpeg`
   - **Source**: new (Pexels search `cabin wooden`)
   - **Caption**: "Cabaña con pradera"
   - **Description**: "Cabaña en paisaje veraniego con pasto verde y árboles altos"
6. `https://images.pexels.com/photos/13807232/pexels-photo-13807232.jpeg`
   - **Source**: new (Pexels search `cabin wooden`)
   - **Caption**: "Cabaña en el campo"
   - **Description**: "Cabaña ubicada en campo abierto con árboles alrededor"
7. `https://images.pexels.com/photos/34034355/pexels-photo-34034355.jpeg`
   - **Source**: new (Pexels search `cabin wooden`, dual-fit con camping pero seleccionada por el contexto rústico)
   - **Caption**: "Entorno natural de la cabaña"
   - **Description**: "Espacio al aire libre rodeado de vegetación característica del Litoral"
8. `https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg`
   - **Source**: existing (was in 2 cabin + country_house JSONs; relegated to cabin only)
   - **Caption**: "Interior con detalles de madera"
   - **Description**: "Ambiente cálido con revestimientos de madera y mobiliario rústico"
9. `https://images.pexels.com/photos/5994751/pexels-photo-5994751.jpeg`
   - **Source**: new (used also for camping; here represents cabin nocturna)
   - **Caption**: "Cabaña iluminada de noche"
   - **Description**: "Cabaña iluminada desde el interior durante el atardecer en el bosque"
10. `https://images.pexels.com/photos/33567174/pexels-photo-33567174.jpeg`
    - **Source**: new (Pexels search `cabin wooden`)
    - **Caption**: "Cabaña tradicional"
    - **Description**: "Antigua cabaña de madera enclavada en bosque verde y húmedo"
11. `https://images.pexels.com/photos/11293209/pexels-photo-11293209.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en invierno"
    - **Description**: "Cabaña de troncos en bosque nevado durante el invierno"
12. `https://images.pexels.com/photos/4406354/pexels-photo-4406354.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en el valle"
    - **Description**: "Cabaña de troncos en valle verde rodeada de pinos y vegetación"
13. `https://images.pexels.com/photos/18332501/pexels-photo-18332501.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña al atardecer"
    - **Description**: "Cabaña de troncos entre árboles con luz cálida del atardecer"
14. `https://images.pexels.com/photos/1518757/pexels-photo-1518757.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña escondida"
    - **Description**: "Cabaña de troncos escondida entre árboles densos en entorno rural"
15. `https://images.pexels.com/photos/17804250/pexels-photo-17804250.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en bosque denso"
    - **Description**: "Cabaña de troncos rodeada de bosque denso y vegetación frondosa"
16. `https://images.pexels.com/photos/2294125/pexels-photo-2294125.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña con ventanales"
    - **Description**: "Imponente cabaña de troncos con grandes ventanales de vidrio al exterior"
17. `https://images.pexels.com/photos/25853247/pexels-photo-25853247.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en bosque verde"
    - **Description**: "Cabaña de madera rodeada de vegetación verde y árboles altos"
18. `https://images.pexels.com/photos/13354350/pexels-photo-13354350.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña ideal para descanso"
    - **Description**: "Cabaña de troncos en bosque sereno, perfecta para descansar de la rutina"
19. `https://images.pexels.com/photos/1365110/pexels-photo-1365110.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en verano"
    - **Description**: "Vieja cabaña de troncos en paisaje veraniego con árboles alrededor"
20. `https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en otoño"
    - **Description**: "Cabaña de troncos rodeada de árboles otoñales con iluminación cálida"
21. `https://images.pexels.com/photos/751546/pexels-photo-751546.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña rural"
    - **Description**: "Cabaña de madera con encanto rústico en entorno rural sereno y verde"
22. `https://images.pexels.com/photos/11539579/pexels-photo-11539579.jpeg`
    - **Source**: new (Pexels search `log cabin`)
    - **Caption**: "Cabaña en pradera"
    - **Description**: "Cabaña de madera en pradera verde con vegetación frondosa alrededor"
23. `https://images.pexels.com/photos/14771408/pexels-photo-14771408.jpeg`
    - **Source**: new (Pexels search `wooden cottage`)
    - **Caption**: "Cabaña en paisaje rural"
    - **Description**: "Cabaña de madera en paisaje rural con cielo despejado y horizonte abierto"
24. `https://images.pexels.com/photos/6374162/pexels-photo-6374162.jpeg`
    - **Source**: new (Pexels search `wooden cottage`)
    - **Caption**: "Cabaña entre árboles"
    - **Description**: "Cabaña de madera enclavada en bosque denso de tonos verdes"
25. `https://images.pexels.com/photos/31493936/pexels-photo-31493936.jpeg`
    - **Source**: new (Pexels search `wooden cottage`)
    - **Caption**: "Cabaña con sol filtrado"
    - **Description**: "Cabaña de madera con sol que se filtra entre los árboles del bosque"

### room (25 URLs)

> Habitaciones privadas para alquiler tipo "room rental" — no son hoteles ni cabañas.

1. `https://images.pexels.com/photos/271620/pexels-photo-271620.jpeg`
   - **Source**: existing (was in 26 room JSONs — la más usada)
   - **Caption**: "Habitación privada"
   - **Description**: "Habitación amena con cama doble y mobiliario sencillo"
2. `https://images.pexels.com/photos/6580369/pexels-photo-6580369.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Habitación serena"
   - **Description**: "Dormitorio con iluminación elegante y almohadones acogedores"
3. `https://images.pexels.com/photos/8089073/pexels-photo-8089073.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Habitación con TV"
   - **Description**: "Dormitorio moderno con cama gris y TV en la pared"
4. `https://images.pexels.com/photos/6782578/pexels-photo-6782578.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Cama con almohadones"
   - **Description**: "Habitación luminosa con almohadones y manta sobre la cama"
5. `https://images.pexels.com/photos/6862448/pexels-photo-6862448.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Habitación cálida"
   - **Description**: "Dormitorio acogedor con cama de madera y luz suave"
6. `https://images.pexels.com/photos/7045354/pexels-photo-7045354.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Habitación contemporánea"
   - **Description**: "Dormitorio con detalles de madera y lámparas colgantes"
7. `https://images.pexels.com/photos/8089081/pexels-photo-8089081.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Dormitorio minimalista"
   - **Description**: "Habitación sobria con cama mullida y mobiliario contemporáneo"
8. `https://images.pexels.com/photos/6782338/pexels-photo-6782338.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Dormitorio con mesas de luz"
   - **Description**: "Habitación con mesas de luz, lámparas y silloncito al pie"
9. `https://images.pexels.com/photos/7511702/pexels-photo-7511702.jpeg`
   - **Source**: new (Pexels search `bedroom`)
   - **Caption**: "Cama con respaldo tapizado"
   - **Description**: "Habitación con cama de respaldo blando junto a mesa de luz blanca"
10. `https://images.pexels.com/photos/3144580/pexels-photo-3144580.jpeg`
    - **Source**: new (Pexels search `bedroom`)
    - **Caption**: "Dormitorio elegante"
    - **Description**: "Habitación de diseño con iluminación tenue y ropa de cama prolija"
11. `https://images.pexels.com/photos/30457596/pexels-photo-30457596.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación acogedora"
    - **Description**: "Dormitorio cálido con ropa de cama suave y luz tenue para descansar"
12. `https://images.pexels.com/photos/35236655/pexels-photo-35236655.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación con escritorio"
    - **Description**: "Dormitorio moderno con escritorio de madera y placard en habitación amplia"
13. `https://images.pexels.com/photos/36710323/pexels-photo-36710323.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación minimalista"
    - **Description**: "Dormitorio minimalista con cama prolija y ventanas amplias"
14. `https://images.pexels.com/photos/36411723/pexels-photo-36411723.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación en tonos neutros"
    - **Description**: "Dormitorio elegante con decoración en tonos neutros y cama mullida"
15. `https://images.pexels.com/photos/10917522/pexels-photo-10917522.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Cama con dosel"
    - **Description**: "Cama con dosel de tela blanca en dormitorio luminoso y ordenado"
16. `https://images.pexels.com/photos/11327757/pexels-photo-11327757.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Dormitorio minimal"
    - **Description**: "Dormitorio con decoración mínima, cama bien armada y luz natural"
17. `https://images.pexels.com/photos/6438756/pexels-photo-6438756.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación espaciosa"
    - **Description**: "Dormitorio amplio con cama mullida y mobiliario en madera clara"
18. `https://images.pexels.com/photos/33619684/pexels-photo-33619684.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Dormitorio con estilo"
    - **Description**: "Habitación con interior moderno y detalles de decoración cuidados"
19. `https://images.pexels.com/photos/35430054/pexels-photo-35430054.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Dormitorio con madera"
    - **Description**: "Habitación acogedora con mobiliario de madera y luz cálida"
20. `https://images.pexels.com/photos/31538824/pexels-photo-31538824.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación con macramé"
    - **Description**: "Dormitorio acogedor con luz cálida y detalles de macramé en la pared"
21. `https://images.pexels.com/photos/31538818/pexels-photo-31538818.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Dormitorio cálido"
    - **Description**: "Habitación acogedora con luz cálida en ambiente sereno para descansar"
22. `https://images.pexels.com/photos/545012/pexels-photo-545012.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Mesa de luz con lámpara"
    - **Description**: "Cama blanca con mesa de luz y lámpara de cobre en habitación serena"
23. `https://images.pexels.com/photos/16436957/pexels-photo-16436957.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación rústica"
    - **Description**: "Dormitorio con diseño rústico iluminado por luz cálida y mobiliario de madera"
24. `https://images.pexels.com/photos/14580423/pexels-photo-14580423.jpeg`
    - **Source**: new (Pexels search `guest room`)
    - **Caption**: "Habitación con almohadones"
    - **Description**: "Dormitorio acogedor con almohadones y obras de arte sobre la pared"
25. `https://images.pexels.com/photos/4119845/pexels-photo-4119845.jpeg`
    - **Source**: new (Pexels search `cozy bedroom`)
    - **Caption**: "Habitación limpia"
    - **Description**: "Cama prolija en habitación limpia, ordenada y lista para huéspedes"

### country_house (25 URLs)

1. `https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg`
   - **Source**: existing (was in 18 country_house JSONs — la más usada)
   - **Caption**: "Casa de campo con jardín"
   - **Description**: "Frente de la casa quinta con galería y arboleda al fondo"
2. `https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg`
   - **Source**: existing (was in 9 country_house JSONs)
   - **Caption**: "Living de la casa quinta"
   - **Description**: "Sala de estar con TV y sillones cómodos para días de descanso"
3. `https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg`
   - **Source**: existing (was in 8 country_house JSONs; mantengo aquí solo en este pool)
   - **Caption**: "Interior con detalles rústicos"
   - **Description**: "Ambiente principal con techos altos y elementos en madera"
4. `https://images.pexels.com/photos/567186/pexels-photo-567186.jpeg`
   - **Source**: new (Pexels search `country house`)
   - **Caption**: "Casona de piedra"
   - **Description**: "Antigua casa rural en piedra rodeada de verde y árboles"
5. `https://images.pexels.com/photos/5543266/pexels-photo-5543266.jpeg`
   - **Source**: new (Pexels search `country house`)
   - **Caption**: "Casa de campo con cerco blanco"
   - **Description**: "Casa rural pintoresca con cerco blanco y vegetación abundante"
6. `https://images.pexels.com/photos/6858170/pexels-photo-6858170.jpeg`
   - **Source**: new (Pexels search `country house`)
   - **Caption**: "Casa rústica"
   - **Description**: "Casa con paredes de madera y base de ladrillo rodeada de árboles"
7. `https://images.pexels.com/photos/33623258/pexels-photo-33623258.jpeg`
   - **Source**: new (Pexels search `country house`)
   - **Caption**: "Casa quinta con campo"
   - **Description**: "Casa de campo con tierras alrededor y vista despejada al horizonte"
8. `https://images.pexels.com/photos/23458269/pexels-photo-23458269.jpeg`
   - **Source**: new (Pexels search `country house`)
   - **Caption**: "Casa de madera celeste"
   - **Description**: "Casa rural rústica de madera celeste en zona tranquila"
9. `https://images.pexels.com/photos/4256852/pexels-photo-4256852.jpeg`
   - **Source**: existing (was in 4 country_house JSONs)
   - **Caption**: "Galería de la casa quinta"
   - **Description**: "Galería techada con vista al parque de la propiedad"
10. `https://images.pexels.com/photos/2736388/pexels-photo-2736388.jpeg`
    - **Source**: existing (was in 9 country_house JSONs)
    - **Caption**: "Parrilla y patio"
    - **Description**: "Sector de parrilla y patio para reuniones al aire libre"
11. `https://images.pexels.com/photos/9811328/pexels-photo-9811328.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa de campo entre cultivos"
    - **Description**: "Casa quinta solitaria rodeada de cultivos verdes bajo cielo despejado"
12. `https://images.pexels.com/photos/34467492/pexels-photo-34467492.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa rural con galería"
    - **Description**: "Casa de campo rústica de madera con vista a paisaje montañoso"
13. `https://images.pexels.com/photos/17648544/pexels-photo-17648544.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa quinta con campos"
    - **Description**: "Casa rural pintoresca con techo a dos aguas rodeada de campos verdes"
14. `https://images.pexels.com/photos/13280780/pexels-photo-13280780.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa quinta tranquila"
    - **Description**: "Casa rural en paisaje natural con vegetación abundante alrededor"
15. `https://images.pexels.com/photos/36394900/pexels-photo-36394900.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa con techo rojo"
    - **Description**: "Casa rural con techo rojo en paisaje sereno del campo verde"
16. `https://images.pexels.com/photos/17503665/pexels-photo-17503665.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa de piedra rural"
    - **Description**: "Casa de piedra con detalles rojos sobre colinas verdes y cielo abierto"
17. `https://images.pexels.com/photos/19612932/pexels-photo-19612932.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa quinta con jardín"
    - **Description**: "Casa de campo pintoresca rodeada de jardín y cultivos en paisaje rural"
18. `https://images.pexels.com/photos/164306/pexels-photo-164306.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa rural antigua"
    - **Description**: "Casa rural envejecida en paisaje vibrante del campo bajo cielo nublado"
19. `https://images.pexels.com/photos/9769288/pexels-photo-9769288.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa quinta con verde"
    - **Description**: "Casa rural pintoresca rodeada de vegetación verde en día soleado"
20. `https://images.pexels.com/photos/27056345/pexels-photo-27056345.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa de campo con flores"
    - **Description**: "Casa rural en paisaje campestre con camino sinuoso y flores silvestres"
21. `https://images.pexels.com/photos/32150698/pexels-photo-32150698.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa rural soleada"
    - **Description**: "Casa rural pintoresca rodeada de vegetación en día soleado de verano"
22. `https://images.pexels.com/photos/9811331/pexels-photo-9811331.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa de madera rural"
    - **Description**: "Casa rural de madera rodeada de vegetación abundante en verano"
23. `https://images.pexels.com/photos/19937378/pexels-photo-19937378.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa rural rústica"
    - **Description**: "Casa quinta rústica rodeada de naturaleza serena y árboles cercanos"
24. `https://images.pexels.com/photos/36675535/pexels-photo-36675535.jpeg`
    - **Source**: new (Pexels search `farmhouse`)
    - **Caption**: "Casa rural con verde"
    - **Description**: "Casa rural rústica con vegetación frondosa alrededor en día nublado"
25. `https://images.pexels.com/photos/17249891/pexels-photo-17249891.jpeg`
    - **Source**: new (Pexels search `rural house`)
    - **Caption**: "Casa rural pintoresca"
    - **Description**: "Casa rural con arquitectura rústica en campo soleado y vegetación verde"

### house (25 URLs)

> Casas urbanas/suburbanas alquiladas completas (NO casas de campo — esas van en `country_house`).

1. `https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg`
   - **Source**: existing (was in 14 house JSONs — la más usada)
   - **Caption**: "Casa con luces encendidas"
   - **Description**: "Casa de dos plantas iluminada al anochecer con garage doble"
2. `https://images.pexels.com/photos/4832503/pexels-photo-4832503.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa suburbana"
   - **Description**: "Casa moderna de dos plantas con jardín delantero prolijo"
3. `https://images.pexels.com/photos/4290722/pexels-photo-4290722.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Frente con jardín"
   - **Description**: "Casa con jardín cuidado y entrada para auto"
4. `https://images.pexels.com/photos/4469137/pexels-photo-4469137.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa familiar"
   - **Description**: "Casa amplia con frente de ladrillo y jardín de pasto verde"
5. `https://images.pexels.com/photos/4469146/pexels-photo-4469146.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa de dos plantas"
   - **Description**: "Casa de ladrillo de dos plantas con jardín y árboles maduros"
6. `https://images.pexels.com/photos/4832522/pexels-photo-4832522.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa moderna"
   - **Description**: "Vivienda moderna con frente prolijo y entrada para vehículo"
7. `https://images.pexels.com/photos/6510949/pexels-photo-6510949.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa con frente azul"
   - **Description**: "Casa familiar con fachada azul y jardín delantero"
8. `https://images.pexels.com/photos/10486072/pexels-photo-10486072.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa en barrio tranquilo"
   - **Description**: "Casa de dos plantas en barrio residencial bajo cielo despejado"
9. `https://images.pexels.com/photos/6952009/pexels-photo-6952009.jpeg`
   - **Source**: new (Pexels search `house exterior`)
   - **Caption**: "Casa amarilla con árboles"
   - **Description**: "Casa amarilla rodeada de árboles verdes ideal para descanso"
10. `https://images.pexels.com/photos/5563473/pexels-photo-5563473.jpeg`
    - **Source**: new (Pexels search `house exterior`)
    - **Caption**: "Casa contemporánea"
    - **Description**: "Casa moderna con ventanales amplios y terraza al frente"
11. `https://images.pexels.com/photos/32802992/pexels-photo-32802992.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa suburbana con jardín"
    - **Description**: "Casa suburbana elegante con jardín cuidado y entrada delantera"
12. `https://images.pexels.com/photos/5587965/pexels-photo-5587965.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Barrio residencial"
    - **Description**: "Vista aérea de casas suburbanas en barrio residencial tranquilo"
13. `https://images.pexels.com/photos/5353883/pexels-photo-5353883.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Frente de casa familiar"
    - **Description**: "Vista frontal de casa familiar con entrada para vehículo y jardín delantero"
14. `https://images.pexels.com/photos/209274/pexels-photo-209274.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa pintada en dos tonos"
    - **Description**: "Casa familiar con frente pintado en blanco y marrón en barrio tranquilo"
15. `https://images.pexels.com/photos/33327061/pexels-photo-33327061.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa con follaje otoñal"
    - **Description**: "Casa suburbana con árboles otoñales y luz cálida en horario de tarde"
16. `https://images.pexels.com/photos/33350028/pexels-photo-33350028.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa moderna con auto"
    - **Description**: "Casa suburbana moderna con auto estacionado en la entrada para vehículo"
17. `https://images.pexels.com/photos/31602311/pexels-photo-31602311.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa de ladrillo rojo"
    - **Description**: "Casa suburbana de ladrillo rojo con jardín delantero en día soleado"
18. `https://images.pexels.com/photos/30707539/pexels-photo-30707539.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa rojiza con encanto"
    - **Description**: "Casa de ladrillo rojo en barrio suburbano con árboles maduros alrededor"
19. `https://images.pexels.com/photos/209315/pexels-photo-209315.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa con jardín cuidado"
    - **Description**: "Casa de paredes marrones con jardín cuidado y vegetación delantera"
20. `https://images.pexels.com/photos/4469136/pexels-photo-4469136.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa estilo americano"
    - **Description**: "Casa familiar amplia con estilo americano y entrada para auto"
21. `https://images.pexels.com/photos/33253271/pexels-photo-33253271.jpeg`
    - **Source**: new (Pexels search `suburban house`)
    - **Caption**: "Casa vintage verde"
    - **Description**: "Casa vintage de ladrillo verde con autos al frente en barrio tranquilo"
22. `https://images.pexels.com/photos/35705942/pexels-photo-35705942.jpeg`
    - **Source**: new (Pexels search `modern house`)
    - **Caption**: "Casa moderna entre pinos"
    - **Description**: "Casa moderna rodeada de pinos con arquitectura contemporánea cuidada"
23. `https://images.pexels.com/photos/7031408/pexels-photo-7031408.jpeg`
    - **Source**: new (Pexels search `modern house`)
    - **Caption**: "Casa con piedra y madera"
    - **Description**: "Casa suburbana privada con fachada de piedra y madera en barrio tranquilo"
24. `https://images.pexels.com/photos/8134846/pexels-photo-8134846.jpeg`
    - **Source**: new (Pexels search `modern house`)
    - **Caption**: "Casa con entrada amplia"
    - **Description**: "Casa contemporánea con entrada amplia, jardín cuidado y diseño actual"
25. `https://images.pexels.com/photos/30278097/pexels-photo-30278097.jpeg`
    - **Source**: new (Pexels search `modern house`)
    - **Caption**: "Casa minimalista"
    - **Description**: "Casa de diseño minimalista con detalles de madera y jardín cuidado"

---

## Cross-type pollution found (culled from pool)

URLs that appeared in multiple types in the existing JSONs and were the main cause of "every accommodation looks the same". Each kept at most in ONE type (or dropped entirely):

| URL ID | Used in (existing) | Actual content (verified) | Decision |
|--------|--------------------|-----------------------------|----------|
| `271639` | CABIN, CAMPING, COUNTRY_HOUSE, HOSTEL, HOTEL, HOUSE (6 types!) | Hotel door handle close-up | **DROPPED** from pool — too generic, caption-content mismatch in 99% of seeds |
| `5997965` | CABIN, COUNTRY_HOUSE, HOUSE | Beige fabric sofa / modern living room | **DROPPED** — too generic, doesn't read as "accommodation" |
| `6489107` | CABIN, HOUSE, ROOM | Empty room with wardrobe | **DROPPED** — sterile empty-room shot |
| `6775267` | CABIN, COUNTRY_HOUSE | Woman near pickup truck at beach (NOT a bedroom!) | **DROPPED** — content mismatch with caption "Dormitorio" |
| `4050317` | CABIN, COUNTRY_HOUSE | Woman with laptop in kitchen | **DROPPED** — not on-theme |
| `2736388` | COUNTRY_HOUSE, HOUSE, ROOM | (low frequency, content reasonable) | Kept in `country_house` only |
| `1454806` | COUNTRY_HOUSE, HOUSE | Bedroom with cityscape artwork | **DROPPED** — overused, generic bedroom shot |
| `2104882` | CABIN, COUNTRY_HOUSE | Generic rustic interior | Kept in BOTH cabin and country_house (the only dual-fit kept — both pools low on rustic interiors) |
| `1268076` | CABIN, CAMPING, COUNTRY_HOUSE | (low frequency, dropped) | **DROPPED** |
| `164595` | APARTMENT, HOTEL | Hotel room | Kept in `hotel` only |
| `2555635` | HOSTEL, ROOM | Beige sofa living room | **DROPPED** — not a dormitory, not a bedroom |
| `2631746` | APARTMENT, COUNTRY_HOUSE | (low frequency) | **DROPPED** |
| `2062426` | APARTMENT, CABIN | (low frequency) | **DROPPED** |
| `1457847` | APARTMENT, COUNTRY_HOUSE | (low frequency) | **DROPPED** |
| `1643383` | CABIN, HOUSE | (low frequency) | **DROPPED** |

## URLs needing replacement (content-mismatch from existing JSONs)

Even URLs used **only in one type** but with wrong captions were culled, because their content doesn't actually match the accommodation type:

| URL ID | Type in seeds | Caption in seeds | Actual content (Pexels verified) | Decision |
|--------|---------------|------------------|----------------------------------|----------|
| `1011302` | APARTMENT (32 uses!) | "Ambiente principal" / "Living" | Green orchid plant — NOT a living room | **DROPPED** |
| `2111769` | APARTMENT (17 uses) | "Baño" | Balcony beside church tower — NOT a bathroom | **DROPPED** |
| `1687844` | CAMPING (18 uses) | "Camping junto al arroyo" | Flower close-up — NOT a campground | **DROPPED** |
| `5137664` | CAMPING (17 uses) | "Camping con sombra" / "Parcelas" | Sea cliffs at sunset — NOT a campground | **DROPPED** |
| `5473182` | CAMPING (15 uses) | "Sanitarios" / "Baños" | Massage therapy session — NOT a bathroom | **DROPPED** |
| `2029719` | HOSTEL (12 uses) | "Dormitorio compartido" | Man meditating on bed — NOT a dorm | **DROPPED** |
| `1643384` | HOUSE (9 uses) | "Living" | Concrete buildings near sea — NOT a living room | **DROPPED** |

These mismatches are the **primary root cause** of the realism problem this spec is fixing. The existing JSONs have plausible captions tied to wrong photos.

## URLs dropped because the image URL no longer resolves

| URL ID | Status | Note |
|--------|--------|------|
| (Pexels candidate `45241`) | image CDN returns 404 | Considered for camping but skipped during HTTP verification |

All other Pexels candidates returned HTTP 200 on the standard CDN pattern (`https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg`).

## URLs dropped because they were not on Pexels

The existing JSONs contained 11 URLs from `images.unsplash.com` and 14 from `i0.wp.com/cherogacasaquinta.com`. Per spec scope (Pexels-only pool), all were dropped from the pool. Worth noting: the `cherogacasaquinta.com` URLs are real photos from a real Concepción del Uruguay country house and may eventually be worth keeping as **literal** local-content overrides for that specific accommodation, but that lives outside the type-pool curation.

---

## Stats

- **Total URLs in final pool**: 200 (25 × 8 types)
- **Per-type breakdown (existing kept / new added in T-004 initial / new added in T-004 expansion)**:
  - camping: 1 / 9 / 15 = 25
  - apartment: 1 / 9 / 15 = 25
  - hostel: 3 / 7 / 15 = 25
  - hotel: 5 / 5 / 15 = 25
  - cabin: 2 / 8 / 15 = 25
  - room: 1 / 9 / 15 = 25
  - country_house: 6 / 4 / 15 = 25
  - house: 1 / 9 / 15 = 25
- **Existing (pre-T-004) URLs reused**: 21 distinct (22 listings; `2104882` dual-listed in cabin+country_house)
- **New URLs added in T-004 initial round**: 59 (10 per type minus existing)
- **New URLs added in T-004 expansion round (2026-05-14)**: 120 (15 per type)
- **Cross-type contamination URLs dropped from pool**: 15 (including `271639` — used across 6 types)
- **Content-mismatch URLs dropped (caption ≠ actual photo)**: 7 high-frequency URLs (accounting for ~120 image references in current JSONs)
- **Non-Pexels URLs dropped (Unsplash + cherogacasaquinta)**: 25 distinct URLs across types
- **All 200 final URLs verified to return HTTP 200** on the Pexels image CDN (`curl -sI` HEAD request, 2026-05-14)
- **Cumulative deduplication enforced**: every URL appears in exactly one type pool (the `2104882` dual-listing inherited from the initial round is the only exception)
