# El Impostor

Juegos de fiesta para jugar con amigos, en un solo teléfono o cada uno en el suyo (online).

**Jugar:** https://nachobracco1595.github.io/el-impostor/ (requiere activar GitHub Pages, ver abajo).

## Juegos
### El Impostor
1. Carga los jugadores (mínimo 3) y elige los temas.
2. Elige cuántos impostores, si tienen pista, roles extra (Cómplice, Infiltrado, Bufón), rondas sorpresa
   (todos impostores / ningún impostor) y el cronómetro.
3. Pasen el teléfono: cada uno ve su rol y la palabra (el impostor ve la pista).
4. La app dice quién empieza; debatan con el cronómetro y voten a quién expulsar.

### Mesa del Mentiroso (estilo Liar's Bar)
- Baraja de Reinas, Reyes, Ases y Comodines. Cada ronda se reparten 5 cartas y se elige la carta de la mesa.
- En tu turno tiras de 1 a 3 cartas boca abajo diciendo que son de la mesa. El comodín vale como cualquiera.
- El siguiente te cree (y tira las suyas) o grita "¡Mentiroso!". Si había alguna carta falsa, gatilla el mentiroso; si no, el que acusó.
- Cada jugador tiene su revólver con 1 bala en 6 recámaras. El último en pie gana.

### Detectives
- Cuatro casos escritos para el juego (el collar de la abuela, el apagón en el museo, el tren nocturno y el sabotaje en la final de cocina).
- Cada caso tiene 4 sospechosos y 3 actos. En cada acto hay una pista pública y tres pistas secretas que se reparten entre los jugadores: hay que contarlas y debatir.
- En cada acto el grupo elige un lugar para investigar entre dos: el otro queda sin revisar.
- Al final votan a quién arrestar. Cada sospechoso tiene su propio final, y si se equivocan se revela lo que realmente pasó.
- Opcional (4 o más jugadores): un **soplón** sabe quién es el culpable y gana si arrestan a otra persona.
- Los casos están en `js/casos-data.js`; para agregar uno nuevo se copia la estructura de un caso existente.

## Perfiles, puntos y ranking
- **Iniciar sesión:** cada jugador crea un perfil con su personaje (color, sombrero, lentes…) y un PIN de 4 números.
- **Puntos:** se suman al terminar cada partida, según el rol y el resultado (las reglas están en el Ranking → "¿Cómo se ganan puntos?").
- **Niveles, rachas, 16 logros e historial** en la pantalla de perfil.
- **Ranking** general y por juego, con podio.
- En un teléfono, suman puntos los jugadores cuyo nombre coincide con un perfil de ese teléfono. Online, cada uno suma en su propio teléfono.

**Base de datos:** por ahora es local (`localStorage`, clave `impostor:bd`). Desde el perfil se puede exportar a un
archivo `.json` e importarlo en otro teléfono. Todo el acceso pasa por el objeto `BD` en `js/bd.js`, así que para
la nube está en `js/nube.js` (Supabase).
El PIN es solo para que nadie use tu perfil en el mismo teléfono: no es seguridad real.

## Nube: inicio de sesión y ranking mundial (Supabase)
Con Supabase configurado aparecen **"Continuar con Google"** y **"Entra con tu correo"** (enlace mágico, sin contraseña).
El perfil y los puntos se guardan en la tabla `perfiles` y el ranking pasa a ser **mundial**. Los perfiles locales con PIN siguen funcionando.

Configuración (una sola vez, plan gratis):
1. Crear un proyecto en https://supabase.com/dashboard (región São Paulo, `sa-east-1`).
2. **SQL Editor → New query**: pegar `supabase/esquema.sql` y **Run**.
3. **Authentication → URL Configuration**: *Site URL* `https://nachobracco1595.github.io/el-impostor/` y en
   *Redirect URLs* agregar `https://nachobracco1595.github.io/el-impostor/**`.
4. **Project Settings → API**: copiar *Project URL* y la clave *anon public* en `js/supabase-config.js`
   (`window.SUPABASE_CONFIG = { url: "...", anonKey: "..." }`). Nunca usar la clave `service_role`.
5. El correo funciona sin nada más (el plan gratis manda pocos correos por hora).
6. Para Google: **Authentication → Providers → Google** necesita un *Client ID* y *Client Secret* de una credencial
   OAuth de Google Cloud (tipo "Aplicación web", con el *Callback URL* que muestra Supabase como URI de redirección autorizada).

Seguridad (en `supabase/esquema.sql`): cualquiera puede leer el ranking, pero cada uno solo crea, edita y borra su propio
perfil (Row Level Security), y un trigger impide que los puntos bajen o suban más de 500 de una vez. El correo no se muestra.

## Música y sonidos
La música y los efectos se generan en el teléfono con Web Audio (no hay archivos de audio).
Cada juego tiene su pista: fiesta en el menú, misterio al repartir roles, tensión en el debate,
un bar del oeste en la Mesa del Mentiroso y jazz noir en Detectives. Los botones de abajo a la
derecha apagan la música y los efectos por separado. Está en `js/sonido.js`.

## Jugar online
Un jugador toca **Jugar online → Crear sala** y comparte el código de 4 letras (o el enlace).
Los demás tocan **Unirme** y escriben el código. El teléfono del anfitrión guarda la partida:
no debe bloquearse ni cerrar la página mientras juegan.

La conexión es directa entre teléfonos (WebRTC con [PeerJS](https://peerjs.com/)); el servidor
gratuito de PeerJS solo presenta a los teléfonos entre sí. No hace falta crear cuentas.

## Activar GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, carpeta `/ (root)` → Save.
En uno o dos minutos el juego queda en la dirección de arriba.

## Archivos
- `index.html`: página principal.
- `juego.html`: la misma página sin cabecera HTML, usada para publicarla como Artifact de Claude (ahí no funciona el modo online).
- `css/estilo.css`, `js/`: estilos y lógica (`casos-data.js` tiene los casos de Detectives, `bd.js` la base de datos y los puntos, `cuenta.js` las pantallas de perfil y ranking, `nube.js` Supabase). `js/vendor/supabase.js` es supabase-js 2.45.4 (licencia MIT). `js/vendor/peerjs.min.js` es PeerJS 1.5.4 (licencia MIT).
- Para probar online con un servidor PeerJS propio: `index.html?peer=127.0.0.1:9000`.
