<p align="center">
  <strong>Nonead DSH Desktop · Registro de cambios</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · <a href="CHANGELOG.en.md">English</a> · <a href="CHANGELOG.ja.md">日本語</a> · Español · <a href="CHANGELOG.fr.md">Français</a> · <a href="CHANGELOG.de.md">Deutsch</a> · <a href="CHANGELOG.ru.md">Русский</a> · <a href="CHANGELOG.pt.md">Português</a></sub>
</p>

# Registro de cambios

Este archivo recoge los cambios de Nonead DSH Desktop que afectan al usuario. Cada versión eleva a la vez el número de versión en los dos espacios de trabajo de escritorio (`nonead-dsh-desktop` y `dsh-plugin-desktop-beta`); ese número aparece también en los nombres de archivo del instalador, en la respuesta del punto de actualización y en la asignación de la URL de descarga directa, y los tres deben coincidir.

Convenciones de mantenimiento:

- Cada versión añade una entrada por idioma (`CHANGELOG.md`, `CHANGELOG.en.md` y las versiones ja/es/fr/de/ru/pt) y refresca los hashes de blob de Git registrados en `CHANGELOG.i18n.yaml`; de lo contrario, `corepack yarn check:bilingual-docs` falla.
- Las entradas solo recogen los cambios que el usuario puede percibir y los cambios de límites que los mantenedores deben conocer; las refactorizaciones puras no tienen entrada propia.
- El historial anterior está en las etiquetas de Git (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) y en el registro de confirmaciones.

## 2.2.3 — 2026-10-29

El shell de escritorio queda localizado en ocho idiomas (chino simplificado, inglés, japonés, español, francés, alemán, ruso y portugués de Brasil):

- Texto del shell: se añaden diccionarios de español, francés, alemán, ruso y portugués de Brasil, con 209 entradas cada uno junto a los idiomas existentes; los diálogos nativos, el panel de permisos, Computer Use, la página de configuración, los controles de plugins y la etiqueta del modo de terminal se resuelven todos mediante `desktopText`, y los menús nativos y el idioma de interfaz almacenado siguen el mismo conjunto de ocho idiomas.
- Página de configuración: los diccionarios de configuración en seis idiomas (125 entradas cada uno) cubren las secciones del mercado de plugins, el control remoto, la ventana, el navegador y la red local, y las notificaciones, en lugar de recurrir al inglés.
- Texto interpolado: once diálogos (eliminación y cambio de Perfil, activación, desactivación y desinstalación de plugins, directorio de datos y estado de actualización) ahora consultan las plantillas `{name}` y sustituyen el valor, así que ya no recurren al inglés en seis idiomas.
- Renderizador: el texto de respuesta de recuperación se ha sacado del módulo que importa módulos nativos de Node, de modo que la compilación de native-ui ya no muestra advertencias de externalización de `node:fs`/`node:path`/`node:crypto`.
- Límite: el asistente de recuperación y el selector de Perfil viven en el espacio de trabajo compartido `dsh-plugin-desktop-beta` y siguen solo en chino e inglés.
- Versión: el producto pasa de 2.2.2 a **2.2.3** en los dos espacios de trabajo de escritorio.
- Documentación: el README y el CHANGELOG también se publican en japonés, español, francés, alemán, ruso y portugués de Brasil; la puerta bilingüe ahora acepta registros multilingües (al menos dos documentos por registro).


## 2.2.2 — 2026-10-28

El runtime pasa a DSH `0.2.2-alpha.2` y el mercado a 1.73.1:

- Actualización del runtime: el canal beta salta de dsh `0.2.1-rc.3` a **`0.2.2-alpha.2`** (pin del submódulo `1f81c047` → `f3803c96`, confirmación upstream «release(dsh): 0.2.2-alpha.2»): el runtime se vuelve a empaquetar y a vendorizar (370 paquetes, frente a 344), y los 24 parches de versión se reajustan sobre la nueva base. Siete paquetes necesitaron un reanclaje semántico porque su salida empaquetada cambió: los nombres de archivo del bundle en `dsh`, `dsh-sandbox-windows-acl` y `dsh-web-frontend` llevan hashes nuevos; `dsh-client-ui-plugin-manager` se refactorizó upstream para derivar `available` de `listed` pero nunca lo define (este parche restaura las ranuras de escritorio y aporta esa definición); `dsh-client-ui-settings-account` movió su icono de vuelta del onboarding a una variable de módulo; `dsh-client-ui-directory-picker-browse` creció hasta nueve diccionarios de idioma; `dsh-client-ui-primitives` cambió las tablas anchas a una barra de desplazamiento visible solo al pasar el ratón, que este parche devuelve a barra fina siempre visible. La instantánea del runtime rc.3 y sus parches se conservan como historial.
- Superficie de dependencias: `@deepseek-ai/cordis` pasa a 4.0.6-alpha.1, `schemastery` a 3.18.6-alpha.1 y tres paquetes de plugins de cordis suben cada uno un alfa menor, o fallan las comprobaciones de peer del upstream 0.2.2-alpha.2; `nonead-dsh-desktop` se alinea a mano con el canal beta porque pertenece a la línea estable y queda fuera de la lista de espacios de trabajo sincronizados automáticamente.
- Mercado: `dshmarket` 1.70.1 → **1.73.1**, con el parche de escritorio (entrada de autoactualización, versiones proporcionadas por el host, comparación de línea base de la ejecución de prueba) reajustado sobre 1.73.1; upstream trasladó la caché de actualizaciones a la semántica `recheckAt`, así que el fragmento de `checkUpdates` se reescribe con la nueva forma.
- Puente de Agents Anywhere: reconstruido para los nuevos rangos de peer (artefacto `rd9c47cbc`, pin sin cambios en `39b82d4`), parche del conector intacto.
- Versión: el producto pasa de 2.1.18 a **2.2.2** en los dos espacios de trabajo de escritorio.

## 2.1.18 — 2026-10-24

Actualización del runtime upstream, una compilación desde el código fuente de Agents Anywhere y una compilación experimental para Windows ARM64 (incluye el lote de correcciones de auditoría de 2.1.17):

- Actualización del runtime upstream: el canal beta pasó de dsh `0.2.1-rc.2` a **`0.2.1-rc.3`** (pin del submódulo `687f282e` → `1f81c047`): 24 parches versionados se reajustaron sobre rc.3, `vendor/dsh-runtime/0.2.1-rc.3/` se vendorizó de nuevo (344 paquetes), y los manifiestos raíz, los dos espacios de trabajo de escritorio y los rangos de peer del puente de Agents Anywhere quedan alineados; la instantánea del runtime rc.2 sustituida y sus parches dejan de rastrearse.
- Puente de Agents Anywhere: ahora **se compila desde el código fuente** (`39b82d4`, antes un artefacto reutilizado), con el parche del conector reajustado sobre el nuevo artefacto: el informe de estado ya no bloquea la publicación de notificaciones, se conservan la conversión de IPv6 sin corchetes en `NO_PROXY` y el informe de runtime listo, y se descarta el cambio de proveedor de respuestas que upstream sustituyó con su refactor `interactionPeer(connection)`; los archivos Python del artefacto se normalizan a LF para que el parche se aplique de forma reproducible.
- Windows ARM64 (experimental): una nueva ruta de compilación `DSH_PACKAGE_ARCH=arm64` entrega un proceso principal arm64 nativo mientras los runtimes de Python / Node / Office incluidos reutilizan la carga útil x64 bajo la emulación de Windows; el empaquetado entre arquitecturas omite las pruebas de humo que solo pueden ejecutarse en el host, la compilación x64 y sus comprobaciones no se ven afectadas, y este artefacto todavía no está conectado a los enlaces de descarga ni al canal de actualizaciones.
- Tarjeta de actualización de la configuración: el mensaje de fallo del servicio ahora dice «Las actualizaciones de Nonead-DSH-Desktop no están disponibles temporalmente. Inténtalo de nuevo más tarde.» en lugar de nombrar el producto Next retirado; la barra de progreso de descarga se movió entre la etiqueta «Descargando la actualización x %» y las notas de la versión.

## 2.1.17 — 2026-10-24

Lote de correcciones de auditoría (26 correcciones, detalladas a continuación):

- Asistente de recuperación: cuando la exportación automática de diagnósticos y una acción del usuario refrescaban el mismo documento a la vez, la primera navegación fallaba con `ERR_ABORTED`; en la ruta que no es una acción del usuario, ese fallo podía escalarse mediante fail-loud hasta cerrar toda la aplicación. Los refrescos ahora se serializan, una navegación abortada por la destrucción de la ventana se trata como un final normal, y los fallos de la ruta de acción solo se registran como diagnóstico.
- Lectura de puntos de control y degradación: los archivos de manifiesto y de copia de seguridad se abren y se vuelven a comprobar por inodo (`O_NOFOLLOW` + `fstat`), así que una ruta sustituida entre `lstat` y la lectura ya no es de confianza; una ranura dañada ya no hace fallar toda la lista de instantáneas: se marca como ilegible, sigue visible pero no se puede restaurar en la página de recuperación, y la rotación la reutiliza como siguiente objetivo de sobrescritura.
- Escrituras de configuración: `settings.yaml` y el `pnpm-workspace.yaml` de un Perfil se publican mediante un archivo temporal más un rename, de modo que una escritura interrumpida deja o bien el contenido antiguo o bien el nuevo, en lugar de un YAML a medias que perdería todos los ajustes en el siguiente arranque.
- Actualizaciones: los cuerpos de respuesta se liberan en las rutas de límite de tamaño y de fallo de decodificación; macOS prepara el traspaso de la instalación antes de que empiece la etapa nativa, así que salir ya no elimina el paquete que la fuente local sigue sirviendo; elegir Salir en una ventana de recuperación abierta por el usuario ya no se informa como fallo de arranque (código de éxito), mientras que los fallos de arranque siguen siendo distintos de cero.
- Almacenes de plugins y de estado: las lecturas del estado de los plugins vuelven a comprobar el inodo; la recuperación de bloqueos de datos obsoletos tolera un `ENOENT` concurrente; la protección contra estados dañados ahora comprueba el archivo que realmente protege; los árboles de preparación del runtime que deja un fallo se barren antes de la siguiente publicación.
- Shell estable: el diálogo con el resultado de la comprobación de actualizaciones iniciado desde la bandeja pertenece a la ventana principal, así que ya no puede quedar enterrado y perder la respuesta; el interruptor de Computer Use trata `cancelled` igual que `failed`; el cierre del invitado del navegador está acotado (forzar tras 1,5 s y luego 0,5 s de margen), el lease se libera primero y `browserRelease` ya no se queda colgado para siempre.
- Mercado comunitario y skin: una solicitud de paginación interrumpida ya no deja «cargar más» atascado en carga; la capa del mercado devuelve el foco al cerrarse; el estilo inyectado declara `data-plugin`, así que un plugin cargado después ya no puede reclamarlo y eliminarlo al descargarse; la gramática de nombres de paquete coincide con la del Host.
- Puertas y CI: `upstream-command-windows` instala las dependencias antes de `check:layout`; la clasificación de cambios desactiva la detección de renombrados para que un archivo de código renombrado a una ruta de documentación no pueda saltarse las puertas del producto; la prueba de compatibilidad del inspector se ancla en la raíz del repositorio.
- Empaquetado: el `verify:safe-cleanup` del shell estable ahora apunta el `TEMP` del proceso hijo de Electron a un directorio escribible del espacio de trabajo (Electron 44 en este host rechaza crear directorios bajo `%TEMP%`), así que la comprobación previa ya no se aborta antes de generar el instalador.

## 2.1.16 — 2026-10-22

Endurecimiento de seguridad y correcciones de puertas (resultado de una auditoría completa):

- CI ejecuta ahora la clasificación de cambios y las puertas de documentación y mercado desde el **lado base de la solicitud de cambios**, de modo que el código revisado ya no puede debilitar su propio clasificador para saltarse todas las puertas del producto.
- Fuses de Electron reforzados: ambos shells cierran la superficie de inyección de `NODE_OPTIONS` / `--inspect`; el shell estable (`asar: true`) ahora carga solo desde `app.asar`, mientras que el canal Beta mantiene ese bit desactivado porque distribuye un directorio físico (`asar: false`). `runAsNode` tiene que seguir activado: en Windows, el Host, la CLI y los shims de pnpm inician el binario de Electron con `ELECTRON_RUN_AS_NODE`. Ambos scripts `verify-fuses` derivan ahora el valor esperado del diseño real y comprueban todo el conjunto, así que aflojarlo falla; antes, el shell estable llamaba a `verifyElectronExecutableFuses(path, undefined, false)`, que nunca comprobaba el bit de archivo.
- La credencial del renderizador ya no viaja en el entorno del proceso hijo del Host; se inyecta una vez por una tubería privada al arrancar, así que los procesos del mismo usuario no pueden leerla desde el entorno del proceso ni desde un volcado de fallo para suplantar al renderizador.
- La puerta de acceso web ahora **rechaza cuando falta la credencial** (antes dejaba pasar); las solicitudes de clase navegador ya no se permiten en silencio.
- Los enlaces profundos `dsh-desktop://` se distribuyen mediante una lista de acciones permitidas; las acciones desconocidas se descartan con una sola línea de registro.
- El enmascaramiento de secretos para diagnósticos y registros ahora cubre las formas base64url, así que la credencial del renderizador ya no puede exportarse.
- La ruta del selector de directorios comparte la comprobación de mismo origen por loopback que usa la ruta de configuración, en lugar de confiar en un `Origin` proporcionado por el cliente.

Empaquetado y publicación:

- El contrato `asarUnpack` del shell estable se volvió a comprobar contra app-builder-lib 26.15.7: las coincidencias se resuelven contra la **ruta del proyecto de empaquetado**, así que los tres patrones deben conservar el prefijo `.desktop-build/payload/` de `files[].from` para acertar (`scripts/node-bin`, `assets` y `build` sí se descomprimen junto a `app.asar`). Los patrones se mantienen tal cual; una prueba nueva deriva el prefijo esperado de `files[].from` y lo comprueba, fallando si cualquiera de los dos lados se desvía: antes no había ninguna comprobación que cubriera este acoplamiento.
- CI gana cobertura de empaquetado del shell estable, y `verify-layout` ahora exige paridad de versión: el `version` de los dos espacios de trabajo debe coincidir con el encabezado más reciente de `CHANGELOG`.
- CI ya no reescribe `dsh-plugin-desktop-beta/package.json` in situ para saltarse el smoke de AA; un script `check:ci` explícito sustituye esa mutación, de modo que CI y las ejecuciones locales coinciden.

Higiene del repositorio y cadena de suministro:

- Todas las Actions de terceros que usa CI están fijadas a un SHA de commit (`actions/checkout`, `actions/setup-node`, `actions/cache`), con la etiqueta conservada solo como comentario final para facilitar la lectura, de modo que una etiqueta upstream movida no pueda cambiar en silencio lo que ejecutan las puertas.
- El clasificador de cambios ya no trata cualquier archivo bajo `docs/` como documentación: las extensiones que no son de documentación dentro de `docs/` (`.js`/`.mjs`/`.json`/`.ts` y similares) ahora activan las puertas del producto, y solo quedan exentos los formatos de documentación reales y `docs/schemas/*.schema.json`.
- Se eliminaron seis archivos tgz históricos sin referencias (unos 1,7 MB) de `vendor/agents-anywhere/`, conservando solo el fijado; el README de ese directorio ya no enseña la ruta retirada `DSH_AA_SOURCE_REF=pinned` y en su lugar fija mediante `provenance.pinnedCommit`.
- Los archivos `nonead-dsh-desktop/README.md` y `README.zh.md` ya no codifican la versión del producto (decían `2.1.3`); apuntan al `version` de `package.json` y a la entrada más reciente del `CHANGELOG` raíz.
- La documentación ahora indica que el AppImage y el deb de Linux x64 los compila solo el canal Beta y que el canal estable entrega un directorio ejecutable en Linux; la primera comprobación real de los fuses y de `onlyLoadAppFromAsar` es el trabajo `desktop-windows-stable` de CI (`package:dir:stable`), ya que en local solo los cubren las pruebas unitarias.

### Suplemento del 2026-10-23 (mismo número de versión, incluido en las compilaciones posteriores)

Cadena de empaquetado:

- Se corrigieron tres puertas de empaquetado de Windows que se habían desviado del comportamiento real del producto: las uniones creadas por pnpm dentro de un Perfil no se podían eliminar de forma recursiva; `verify:host` nunca pasaba la credencial del renderizador (32 bytes en base64url, y tiene que ser la misma que recibió el Host); y ese script suplantaba al renderizador con una cadena fija, que la puerta Web de rechazo por defecto rechaza.
- `dsh-plugin-desktop-beta` ahora declara `@deepseek-ai/dsh-plugin-manager` (un peer necesario de `dsh-plugin-market`), lo que restaura el cierre de runtime de 318 nodos.

## 2.1.15 — 2026-10-22

La versión salta de `2.1.13` directamente a `2.1.15`; en el historial no hay una confirmación de publicación separada para `2.1.14`.

Runtime y dependencias:

- El runtime de DSH se mantiene en **`0.2.1-rc.2`** y `channels.beta.commit` de `upstream.json` sigue siendo `687f282e`; el puente de Agents Anywhere sigue siendo `39b82d4`.
- El mercado de plugins `dshmarket` pasa a `1.66.45` y el parche de escritorio se reajusta sobre él.
- El parche de marca pasó de `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` a `patches/dsh-web-frontend@0.2.1-rc.2.patch`, uniéndose a los demás parches del runtime.
- El parche httpx del conector de AA creció para cubrir la nueva ruta de conexión.

Actualizaciones y recuperación:

- La tarjeta de actualización puede mostrar **notas de la versión** proporcionadas por la respuesta de versión; el menú de la bandeja y los diálogos nativos del canal Beta ofrecen además una entrada «ver notas completas de la versión» (las etiquetas de la bandeja y los cuerpos de las notificaciones se truncan según las reglas de la plataforma), mientras que el diálogo nativo de actualización del canal estable sigue llevando solo texto fijo.
- **Omitir esta versión** es nuevo: la decisión se guarda en disco, así que la comprobación programada desatendida ya no vuelve a ofrecer una versión omitida.
- Una instalación fallida se puede reintentar, y la recuperación puede volver a **cualquier instantánea guardada**, no solo a la más reciente.
- Iniciar el instalador nativo ahora comienza **antes** de la secuencia de salida, así que salir no puede llevarse el instalador consigo.
- La firma de instaladores de Windows y la verificación del editor se introdujeron y luego se **revirtieron por completo** en `c5896ac`; los instaladores de Windows siguen comparando solo `ProductName` / `ProductVersion` del recurso de versión del PE.

Shell de escritorio:

- Se recuerdan la posición y el tamaño de la ventana; la restauración solo ocurre mientras la ventana sigue solapando una pantalla montada, así que desconectar un monitor no puede dejarla fuera de pantalla.
- La compatibilidad estricta con archivos `.env` por capas rellena las variables que faltan para el proceso hijo del Host sin sobrescribir el entorno existente.
- Se admiten enlaces profundos `dsh-desktop://` (por ejemplo `dsh-desktop://settings/general`).
- Un interruptor de inicio al iniciar sesión lee el estado efectivo del sistema operativo.
- Los ciclos de lectura, modificación y escritura de la configuración de Perfil ahora se ejecutan bajo un único bloqueo de escritor, así que el shell y el gestor de perfiles del Host no pueden descartar en silencio las actualizaciones del otro.
- Los presupuestos de reintento de instancia única y de limpieza de desechables se fijan en tres; los fallos no gestionados del renderizador aparecen en el área de avisos.
- El `.env` y el entorno de runtime del navegador invitado se pasan correctamente.

Mercado y skin:

- El mercado previsualiza **medios que no son imágenes** y puede **instalar un plugin por nombre**.
- Omitir el mercado de plugins durante la configuración inicial se recuerda, y volver a abrir el asistente conserva el ajuste de mercado guardado.
- La sustitución del titular del hero de la skin está limitada al subárbol del hero y ya no toca otros textos.

Correcciones:

- El flujo de interacción de AA mantiene un peer activo, y el runtime de DSH sigue siendo utilizable mientras se sincroniza el historial.
- Se repararon las aserciones multiplataforma y el bundle del mercado ahora se distribuye con el paquete.
- CI ejecuta las puertas del producto cuando cambia un esquema JSON de runtime.
- El flujo de publicación deriva la versión distribuida de los manifiestos.

## 2.1.13 — 2026-10-21

Runtime y dependencias:

- El runtime de DSH pasó de `0.2.1-alpha.5` a **`0.2.1-rc.2`**: todas las dependencias `@deepseek-ai/dsh*` se fijan exactamente a esa versión, `vendor/dsh-runtime/0.2.1-rc.2/` se distribuye con el instalador y el antiguo directorio de runtime `alpha.5` desaparece. `upstream.json` registra `channels.beta.commit` = `687f282e`.
- El mercado de plugins `dshmarket` pasa a `1.66.44`.
- El puente de Agents Anywhere pasa a `2.1.0-desktop` (upstream `39b82d4`) con el parche `agents-anywhere-connector-httpx`.

Interfaz y experiencia:

- La pantalla de arranque muestra ahora el logotipo de NONEAD / DEEPSEEK HARNESS.
- La página de finalización de la configuración inicial ahora guía al usuario para introducir una clave de API y ofrece un punto de entrada de NONEAD.
- La configuración inicial activa el mercado de plugins y Computer Use por defecto (efectivo desde 2.1.12).

Estabilidad:

- El puente de AA **descarta eventos** cuando su cola está llena en lugar de fallar.
- Se corrigieron las aserciones de PTC que rompió la refactorización de rc.2 upstream.
- CI ahora se activa en `main` en lugar de `master`.
- Se eliminaron los archivos `AGENTS.md`, `CLAUDE.md`, `PRIVACY*`, `CONTRIBUTING*` y `CODE_OF_CONDUCT*` de la raíz; las reglas del repositorio ahora viven solo en `README.md` y `docs/`.

## 2.1.12 — 2026-10-19

- La configuración inicial activa el mercado de plugins (`dsh-market`) y Computer Use por defecto, así que las instalaciones nuevas tienen ambos desde el primer arranque.

## 2.1.11 — 2026-10-18

- Los dos espacios de trabajo de escritorio se unifican en `2.1.11`, con las pruebas y la documentación sincronizadas.
- Los manifiestos raíz y la documentación se sincronizan con DSH `0.2.1-rc.2` (tras pasar por `0.2.1-rc.1`).
- `aa:prepare-release` ahora puede usar un árbol de código fuente local en lugar de un paquete de GitHub, lo que ayuda en publicaciones sin conexión o con ancho de banda limitado.

## 2.1.6 — 2026-10-17

- Se añadió un parche de compatibilidad para los plugins de Perfil, que corrige la carga de plugins de perfil en runtimes más recientes.
- Los puntos de descarga de actualizaciones se trasladaron a `nonead.com`; el README incorporó instrucciones de instalación y ejecución del AppImage de Linux.

## 2.0.8 — 2026-10-11

- Los tres canales se unifican en `2.0.8`, con los recursos de iconos, `dshmarket` y la documentación de publicación actualizados.
- El runtime upstream ya había pasado a `0.2.0-rc.2`.

## Problemas conocidos

- La actualización dentro de la aplicación en Linux solo comprueba la versión y nunca descarga un instalador; para actualizar, descarga un AppImage nuevo.
- Los instaladores de Windows aún no se verifican criptográficamente: la ruta de descarga admite un `installerSha256` del servidor, pero el punto de versión no lo publica, así que solo se comparan `ProductName` y `ProductVersion` del recurso de versión del PE.
- Un submódulo `deepseek-harness` sin inicializar hace que `corepack yarn check:layout` falle; las compilaciones normales, la comprobación de tipos y las pruebas no se ven afectadas.
