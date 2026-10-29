<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop, un cliente de escritorio de código abierto basado en DeepSeek Harness" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>Un cliente de escritorio de código abierto para Windows, macOS y Linux, basado en DeepSeek Harness.</strong>
</p>

<p align="center">
  Producto <code>2.2.3</code> · runtime de DSH <code>0.2.2-alpha.2</code> · Electron 44 · MIT License
</p>

<h3 align="center"><a href="https://www.nonead.com">Descarga con un clic, listo para usar.</a></h3>

<p align="center">
  Todo es un plugin, incluido el propio escritorio.
</p>

<p align="center"><sub>Un proyecto comunitario independiente de código abierto. No tiene relación de dependencia, colaboración, licencia ni respaldo con DeepSeek.<br>Actualmente ningún empleado de DeepSeek ni ningún miembro del equipo oficial upstream de DeepSeek Harness participa en este repositorio; los colaboradores upstream que aparecen en GitHub Contributors proceden del historial de commits heredado por fork y sincronización.<br><a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · Español · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a></sub></p>

<a id="toc"></a>

## Índice

| Sección | Contenido |
| --- | --- |
| [Qué es esto](#what) | Posicionamiento del producto y modelo de procesos |
| [Versiones y runtime](#versions) | Versiones, pin upstream, base de dependencias |
| [Descarga e instalación](#download) | Instalación en las tres plataformas |
| [Capacidades](#features) | Shell de escritorio, perfiles, mercado, actualizaciones |
| [Límites de seguridad](#security) | Credencial del renderer, LAN, verificación de actualizaciones |
| [Documentación](#docs) | Puntos de entrada para usuarios y desarrolladores |
| [Estructura del repositorio](#layout) | Directorios y los cuatro espacios de trabajo |
| [Compilación desde el código fuente](#dev) | Entorno, comandos, puertas de verificación |
| [Publicación y actualizaciones](#release) | Protocolo de canales y flujo de publicación |
| [Ecosistema de plugins](#plugins) | Por qué todo es un plugin |
| [Relación con upstream](#upstream) | Límites y reparto del trabajo |
| [Registro de cambios](#changelog) | Historial de versiones |
| [Limitaciones conocidas](#limits) | Comportamientos que conviene conocer de antemano |
| [Comunidad](#community) | Canales de conversación |
| [Enlaces](#links) | Proyectos del ecosistema |
| [Licencia](#license) | Licencia y avisos |

<a id="what"></a>

## Qué es esto

Nonead DSH Desktop lleva la interfaz web local, el servicio Host y el sistema de plugins de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) a una aplicación de escritorio nativa. El código upstream se ejecuta **sin modificaciones** y está fijado a una versión concreta; el shell de escritorio se ocupa de las ventanas, la bandeja del sistema, la terminal, la actualización automática, varias configuraciones de trabajo (perfiles) y el empaquetado, y **él mismo se monta como un plugin de DSH** mediante el mismo mecanismo de composición que usan los plugins de terceros.

El producto no es una reimplementación del cliente, sino un host Electron ligero más un runtime de DSH completo:

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Shell de escritorio | Proceso principal de Electron | Bloqueo de instancia única, ventanas y materiales, bandeja y menús, permisos, terminal, actualizaciones, directorio de datos, estado de los perfiles |
| Host | Proceso hijo en modo Node | Carga la capa de parches del perfil, arranca el boot del perfil upstream, sirve el transporte web y aloja los plugins Host de terceros |
| Transporte web | HTTP + WebSocket en loopback | Sirve la interfaz web oficial (puerto efímero por defecto) |
| Renderer | BrowserWindow en sandbox | Carga la interfaz web oficial y se identifica mediante una cabecera de credencial nativa |

El shell y el Host se comunican por un único canal IPC de proceso hijo. Cambiar de perfil o de modo descarta toda la generación del Host y lanza un proceso hijo nuevo; ningún estado se conserva entre generaciones. El renderer nunca recibe las API de Electron: recibe la interfaz web oficial más una credencial de acceso generada por el shell.

<a id="versions"></a>

## Versiones y runtime

| Elemento | Valor |
| --- | --- |
| Versión del producto | `2.2.3` (`nonead-dsh-desktop` y `dsh-plugin-desktop-beta` sincronizados) |
| Espacio de trabajo del canal estable | `nonead-dsh-desktop` (los scripts de la raíz usan el sufijo `:stable`) |
| Espacio de trabajo del canal Beta | `dsh-plugin-desktop-beta` (los scripts de la raíz usan el sufijo `:beta`) |
| Runtime de DSH | `0.2.2-alpha.2`, todas las dependencias `@deepseek-ai/dsh*` fijadas con pin exacto y el runtime vendored en el repositorio |
| Runtime vendored | `vendor/dsh-runtime/0.2.2-alpha.2/` (se conservan varios directorios de versiones anteriores) |
| Pin upstream | `f3803c96974ad4a94195fb97e5c637e9c2a3afe3fc48fa190a683e469daa699857e9afe8` (`channels.beta` en `upstream.json`, replicado en `nonead-dsh-desktop/upstream-reference.json`) |
| Electron / empaquetador | Electron `44.0.0` / electron-builder `26.15.7` (`app-builder-lib` con parche) |
| Node / Yarn | Node `^22.19.0` o `>=24.0.0`; Yarn `4.18.0` mediante Corepack (`nodeLinker: node-modules`) |
| Mercado de plugins | `dshmarket` `1.70.1`, más el `dsh-community-market` `0.1.0-dev.0` de este repositorio |
| Puente de control remoto | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop` (commit upstream `39b82d4`) |
| Skin de marca | `dsh-nonead-client-skin` (se distribuye en el instalador y se monta por perfil) |

`upstream.json` registra dos líneas de runtime vendored: `stable` corresponde al upstream `0.2.0-rc.2` y `beta` al upstream `0.2.2-alpha.2`. Lo que realmente se incluye en un instalador es la línea que el espacio de trabajo fija con pin exacto; actualmente ambos espacios de escritorio fijan `0.2.2-alpha.2`. **Los nombres de canal describen líneas de runtime, no el canal de publicación que consulta un espacio de trabajo.**

<a id="download"></a>

## Descarga e instalación

Los instaladores oficiales cubren Windows x64, macOS (Universal, con Intel y Apple Silicon) y Linux x64 (AppImage). No hace falta ningún entorno adicional. El AppImage y el deb de Linux x64 los genera el canal Beta; en Linux, el canal estable solo produce un directorio ejecutable, no un instalador.

| Plataforma | Descarga | Instalación |
| --- | --- | --- |
| Windows x64 | [Descargar el instalador](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | Ejecuta el instalador NSIS y sigue las indicaciones |
| macOS Universal | [Descargar el DMG](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | Abre el DMG y arrastra Nonead DSH Desktop a la carpeta Aplicaciones |
| Linux x64 | [Descargar el AppImage](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | Dale permisos de ejecución y ejecútalo: `chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Notas sobre Linux: algunas distribuciones necesitan FUSE instalado, o puedes ejecutarlo con `--appimage-extract-and-run`. La actualización desde la aplicación en Linux **solo comprueba la versión y nunca descarga un instalador**; para actualizar, descarga un AppImage nuevo. Usa el canal Beta cuando necesites un instalador de Linux: en Linux, el canal estable solo produce un directorio ejecutable.

Windows ARM64 solo está disponible como **compilación experimental** y no se ofrece en los enlaces de descarga ni en las actualizaciones desde la aplicación anteriores: el shell es arm64 nativo, pero el runtime de Python / Node / Office incluido sigue siendo el paquete x64 (se ejecuta mediante la emulación de Windows) y el artefacto aún no se ha ejecutado en hardware ARM. Compílalo tú mismo con el comando de [comandos habituales](#dev).

Los pasos detallados de uso, los perfiles y los comandos de plugins están en la [guía de usuario](docs/user-guide.en.md); las dudas sobre plataformas y alcance se responden en las [preguntas frecuentes](docs/faq.en.md).

<a id="features"></a>

## Capacidades

| Capacidad | Descripción |
| --- | --- |
| Shell de escritorio nativo | Bloqueo de instancia única, ventanas y menús nativos, bandeja del sistema, icono del Dock; los materiales de ventana están sujetos a la capacidad de cada plataforma (macOS acepta `off`/`transparent` y usa `transparent` por defecto, Linux acepta ambos pero siempre resuelve a `off`, Windows solo `off`) |
| Gestión del Host local | El shell lanza el proceso hijo del Host y gestiona su ciclo de vida: primero pide un cierre ordenado, `SIGTERM` a los 10 s y `SIGKILL` 5 s después; las actualizaciones del instalador exigen un cierre ordenado y se rechazan en caso contrario |
| Interfaz web oficial | Se enlaza solo a `127.0.0.1`, con puerto efímero por defecto; el shell genera una credencial aleatoria de 32 bytes por cada generación del Host y la entrega mediante `x-dsh-desktop-renderer` |
| Perfiles y configuración inicial | Los directorios de perfil están en `$DSH_HOME/profiles/<name>`; un perfil sin inicializar muestra primero el asistente de configuración de Desktop (modo y material de ventana, mercado de plugins, notificaciones, apertura con el navegador predeterminado, alcance del acceso web) y solo después arranca el Host |
| Acceso desde el navegador y la LAN | «Abrir en el navegador» solo decide si se lanza el navegador del sistema y no cambia la exposición; el acceso a la LAN es una opción independiente que además muestra la URL de LAN actual |
| Mercado de plugins integrado | DSH Community Market ofrece las vistas de descubrimiento / instalables / instalados / fuentes, con fuentes de catálogo ampliables y adaptadores revisados |
| Skin de marca | `dsh-nonead-client-skin` se distribuye con el instalador y el Perfil lo monta en todos los perfiles, sin instalación aparte |
| Actualización automática | Comprobación de versión fija contra `https://www.nonead.com/software/ndsh-desktop/version` con la versión actual, el canal y un identificador de instalación aleatorio; Windows y macOS descargan e instalan, Linux solo comprueba |
| Experiencia de actualización | La tarjeta de actualización muestra las notas de la versión que envía la respuesta de versión, y el menú de la bandeja y los diálogos nativos del canal Beta añaden una entrada «ver notas completas»; «omitir esta versión» se conserva, así que una comprobación programada sin supervisión no la vuelve a ofrecer; una instalación fallida se puede reintentar y revertir a cualquier instantánea guardada |
| Estado de ventana y sesión | Recuerda la posición y el tamaño de la ventana; una posición guardada solo se restaura mientras siga solapando una pantalla conectada, así que desenchufar un monitor no puede restaurar la ventana fuera de pantalla |
| Enlaces profundos y elemento de inicio | Se admiten enlaces `dsh-desktop://`, por ejemplo `dsh-desktop://settings/general` abre la configuración directamente; el interruptor de abrir al iniciar sesión lee el estado real del sistema operativo |
| Archivo de entorno | Compatibilidad estricta con `.env` por capas: rellena las variables que faltan para el proceso hijo del Host y nunca sobrescribe el entorno existente |
| Mejoras del mercado | El mercado de plugins previsualiza medios que no son imágenes y puede instalar un plugin por su nombre |
| Terminal y directorio de trabajo | El shell expone las capacidades de terminal y de directorio de trabajo como servicios de Desktop para los plugins |
| Capacidades experimentales | La configuración inicial activa por defecto el mercado de plugins y Computer Use; voz, traducción, Agent Team y Ralph vienen con el runtime |

<a id="security"></a>

## Límites de seguridad

| Límite | Comportamiento real |
| --- | --- |
| Identidad del renderer | Solo las solicitudes que llevan la credencial de la generación actual (`x-dsh-desktop-renderer`) cuentan como el renderer de Electron; con el acceso desde el navegador desactivado, cualquier otra solicitud recibe 403 y los WebSocket de navegador existentes se cierran |
| Transporte de la credencial del renderer | La credencial solo vive en la memoria del proceso principal y del Host; el Host recibe una línea por su **stdin privado** al arrancar y el canal se cierra de inmediato, así que nunca entra en el entorno del proceso hijo, en argv ni en ningún archivo (la implementación anterior usaba una variable de entorno, que procesos del mismo usuario podían leer del entorno del proceso o de un volcado de fallo para suplantar el renderer) |
| Puerta del acceso web | Cuando el Host no tiene credencial **falla en cerrado** para las solicitudes de tipo navegador y registra un único aviso en lugar de permitirlas; el intercambio de inicio de sesión de `/connect` y las solicitudes de solo lectura están exentos en el código, y las rutas del mercado necesitan credencial de conexión incluso para leer |
| Acceso a la LAN | **Sin autenticación**: cualquiera en la misma red que pueda alcanzar el puerto puede abrir DSH y operar este equipo. Actívalo solo en redes plenamente confiables |
| Verificación del instalador | La ruta de descarga admite un `installerSha256` publicado por el servidor y lo aplica como puerta estricta, pero el endpoint de versión aún no publica ese campo; mientras no lo haga, Windows solo verifica `ProductName` y `ProductVersion` del recurso de versión PE, mientras que macOS verifica la identidad del bundle, el manifiesto embebido, la firma de código y el Team Identifier; esa comprobación de identidad solo existe en el shell estable, mientras que la ruta de descarga del shell Beta solo comprueba los bytes mágicos y el tamaño del instalador antes de ejecutarlo |
| Configuración incorrecta de plugins | Un `id` de parche que no coincide con nada registra `entry not found` y se omite; un `name` que no coincide registra `name mismatch ... skipping`; pero un nombre de servicio `inject` equivocado **no da error**: el plugin queda pendiente para siempre y la interfaz solo muestra un 4xx HTTP sin explicación |

<a id="docs"></a>

## Documentación

Los usuarios habituales pueden empezar por la [guía de usuario](docs/user-guide.en.md); la documentación para desarrolladores solo importa al ampliar o mantener el proyecto. El índice completo está en el [índice de documentación](docs/README.en.md).

### Documentación para usuarios

| Objetivo | Punto de entrada |
| --- | --- |
| Instalar, perfiles, modos, terminal, comandos de plugins y actualizaciones | [Guía de usuario](docs/user-guide.en.md) |
| Respuestas directas sobre plataformas, entorno incluido, datos, plugins y actualizaciones | [Preguntas frecuentes](docs/faq.en.md) |
| Entender por qué existe el proyecto | [Por qué Nonead DSH Desktop](docs/why-desktop.en.md) |
| Consultar el historial de versiones | [Registro de cambios](CHANGELOG.es.md) |

### Documentación para desarrolladores y mantenedores

| Objetivo | Punto de entrada |
| --- | --- |
| Shell, proceso hijo Host, transporte web y empaquetado | [Arquitectura](docs/architecture.en.md) |
| Escribir plugins normales o de Desktop | [Desarrollo de plugins](docs/plugin-development.en.md) |
| Leer la propuesta del ecosistema de plugins | [Propuesta de ecosistema de plugins de DSH](docs/plugin-ecosystem.en.md) |
| Usar `desktopProfiles` / `desktopPnpm` y otros servicios de Desktop | [Servicios de plugins de Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md) |
| Participar en la discusión del contrato unificado de plugins | [DSH Community Fabric Draft](dsh-community-fabric/README.md) |
| Leer el diseño de producto y de seguridad del mercado | [DSH Community Market](dsh-community-market/README.md) |
| Compilación, publicación y limitaciones conocidas a nivel de paquete | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| El espacio de trabajo del shell del canal estable | [`nonead-dsh-desktop/README.md`](nonead-dsh-desktop/README.md) |
| El plugin de skin de marca | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## Estructura del repositorio

La raíz es un espacio de trabajo de Yarn `4.18.0` (`nodeLinker: node-modules`) con los siguientes miembros y responsabilidades:

| Ruta | Responsabilidad |
| --- | --- |
| `nonead-dsh-desktop/` | Espacio de trabajo de escritorio del canal estable: su propio shell (perfiles y recuperación, controles de ventana, configuración inicial), el puente de Agents Anywhere y los adaptadores de Community Market, el arranque de Electron y el empaquetado |
| `dsh-plugin-desktop-beta/` | Espacio de trabajo de escritorio del canal Beta: doble cara Host / Client, arranque de Electron, empaquetado y pruebas de publicación |
| `dsh-community-market/` | Diseño de producto y de seguridad del mercado de plugins integrado, contrato de proveedor de catálogo, pruebas y compilación |
| `dsh-community-fabric/` | RFC de interoperabilidad comunitaria: Manifest/Capability, Runtime/Presentation, composición de servicios y diagnóstico de procedencia |
| `dsh-nonead-client-skin/` | Skin de marca distribuida con el instalador, incorporada mediante una dependencia `file:` y fuera de la lista del espacio de trabajo raíz |
| `vendor/dsh-runtime/<version>/` | Paquetes del runtime de DSH vendored por canal y `manifest.json` |
| `vendor/agents-anywhere/` | Paquetes vendored del puente de Agents Anywhere |
| `patches/` | Parches de Yarn para el empaquetador de Electron, pnpm, `open`, `fs-ext`, el subproceso de DSH y más |
| `scripts/` | Scripts de la raíz de verificación y publicación (documentación bilingüe, dirección de dependencias del mercado, runtime vendored, iconos, layout, publicación de AA) |
| `docs/` | Documentación del producto; `docs/evidence/` conserva registros medidos de publicación e instaladores |
| `deepseek-harness/` | Submódulo upstream de solo lectura, fijado a `channels.beta.commit` en `upstream.json` |

**El submódulo no es necesario para el desarrollo diario.** El runtime está vendored, así que `corepack yarn install`, `build`, `typecheck`, `test`, `dev:*` y `dist:*` no lo necesitan; solo los scripts `upstream:*` (recompilar y reempaquetar el runtime) lo requieren. `corepack yarn check:layout` sí verifica el commit y el árbol de trabajo del submódulo, por lo que falla necesariamente en un clon sin inicializar: es lo esperado.

<a id="dev"></a>

## Compilación desde el código fuente

### Requisitos

- Node.js `^22.19.0` o `>=24.0.0`
- Yarn `4.18.0` en la raíz mediante Corepack (no instales las dependencias de la raíz con pnpm ni con npm)
- Git; solo es necesario para inicializar el submódulo upstream al recompilar el runtime

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # espacio de trabajo Beta
# corepack yarn dev:stable # espacio de trabajo del canal estable (nonead-dsh-desktop)
```

Cuando realmente necesites el código upstream:

```sh
git submodule update --init --recursive
```

### Comandos habituales

| Comando | Propósito |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | Inicia el flujo de desarrollo del espacio de trabajo correspondiente (verifica el `dshmarket` fijado, prepara los artefactos de AA y compila el mercado primero) |
| `corepack yarn build` | Compila el mercado, el espacio de trabajo Beta y el del canal estable (también verifica antes el `dshmarket` fijado) |
| `corepack yarn typecheck` | Comprobación de tipos de los tres espacios de trabajo |
| `corepack yarn test` | Pruebas unitarias de los tres espacios de trabajo |
| `corepack yarn check` | Puerta headless completa: layout, dirección de la arquitectura, runtime vendored, documentación bilingüe, conector de AA y las comprobaciones de cada espacio de trabajo |
| `corepack yarn check:ci` | La cadena que ejecuta realmente la CI: igual que `check`, pero el espacio de trabajo Beta usa `check:ci` (omite `verify:aa`, que upstream tiene en pausa) en lugar de reescribir el manifiesto dentro de la CI |
| `corepack yarn check:layout` | Topología de espacios de trabajo, pins exactos, submódulo, runtime vendored, iconos y puertas de layout |
| `corepack yarn check:bilingual-docs` | Verifica que los hashes de blob de Git registrados en `*.i18n.yaml` coinciden con los documentos |
| `corepack yarn check:vendored-runtime` | Verifica `vendor/dsh-runtime/` contra `upstream.json` |
| `corepack yarn market:prepare` / `market:check` | `market:prepare` mueve `dshmarket` a npm `latest` (solo las `resolutions`/dependencias de los dos espacios de escritorio y `yarn.lock`); `market:check` es la comprobación de consistencia offline que ejecuta cada compilación, y solo `--latest` accede a la red |
| `corepack yarn aa:prepare-release` / `aa:check` | Compila o verifica los artefactos de publicación de Agents Anywhere |
| `corepack yarn package:dir:beta` | Genera un directorio de aplicación sin empaquetar |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | Genera los artefactos de publicación de cada plataforma |
| `DSH_PACKAGE_ARCH=arm64 corepack yarn dist:win:stable` | Genera un instalador experimental de Windows ARM64 (x64 por defecto; una compilación cruzada omite las pruebas de humo que solo pueden ejecutarse en este host) |

Convenciones:

- `build`, `dev:*` y `dist:*` de la raíz ejecutan primero `corepack yarn market:check`: verifica offline que la versión de `dshmarket` registrada en el repositorio, el lockfile y el parche de compatibilidad coinciden, sin acceder a la red ni reescribir manifiestos. Mover el pin exige que una persona ejecute `corepack yarn market:prepare` y confirme juntos la versión, el lockfile y el parche.
- `nonead-dsh-desktop` y `dsh-plugin-desktop-beta` son **espacios de trabajo separados**: los cambios compartidos deben llegar a ambos respetando las diferencias declaradas; ejecuta `corepack yarn check` y la comprobación de cada espacio de trabajo antes de publicar.
- Tras editar `README*.md` o `CHANGELOG*.md` en cualquier idioma, actualiza los hashes de blob de Git del `*.i18n.yaml` correspondiente (tómalos con `git hash-object`); de lo contrario, `check:bilingual-docs` falla.
- `corepack yarn check:layout` necesita un submódulo inicializado; en un entorno puramente headless, valida el código de negocio con `typecheck` / `test` / el `check` de cada espacio de trabajo.
- **La CI no debe dejar que el código revisado decida qué se ejecuta**: el trabajo `changes` restaura `scripts/` desde la **base de la pull request** antes de ejecutar el clasificador y las puertas de documentación y mercado (los documentos siguen viniendo del árbol de trabajo); `workflow_dispatch` no tiene base, así que recurre a la copia del head con un aviso. La CI ejecuta `corepack yarn check:ci` (= el `check` local sin `verify:aa`) en lugar de reescribir `dsh-plugin-desktop-beta/package.json` en tiempo de ejecución.
- **La paridad de versiones forma parte de la puerta**: `scripts/verify-layout.mjs` exige que el `version` de ambos espacios de trabajo sea igual al encabezado `## <version> — <date>` más reciente de `CHANGELOG.md`, así que olvidar cualquiera de los dos lados en una publicación falla.

<a id="release"></a>

## Publicación y actualizaciones

- **Dos líneas de producto**: las generan los dos espacios de trabajo de escritorio. Los instaladores Beta y estable difieren en el id del bundle, el prefijo del artefacto y el canal de actualización, y no deben mezclarse.
- **Protocolo de canal**: la comprobación de versión solicita `https://www.nonead.com/software/ndsh-desktop/version`, informando la versión actual en `X-DSH-Desktop-Version`, `stable` / `beta` en `X-DSH-Desktop-Channel` y un UUID aleatorio generado y persistido localmente en `X-DSH-Desktop-Installation-Id`. Las descargas del instalador llevan `channel` y `X-DSH-Desktop-Target-Version`, pero nunca el identificador de instalación ni la versión actual.
- **Aplicación del canal**: la respuesta del servidor debe devolver el canal; el canal estable solo acepta SemVer simple y el canal Beta solo `-beta.N`, y el cliente nunca descarga entre canales de forma silenciosa.
- **Consistencia de versiones**: el artefacto subido, la correspondencia versión → archivo de la URL de descarga directa y la versión que informa el endpoint deben coincidir; una discrepancia se manifiesta como 404 en lugar de una instalación incorrecta.
- **Requisitos previos de publicación**: ejecuta primero `corepack yarn aa:prepare-release`; si esta publicación incluye un `dshmarket` nuevo, una persona debe ejecutar también `corepack yarn market:prepare` y confirmarlo. Los comandos de distribución de Windows verifican además los artefactos de AA con `--verify-release`.

<a id="plugins"></a>

## Ecosistema de plugins

Los plugins amplían DSH: los modelos, las herramientas, la interfaz y los flujos de trabajo son plugins que se combinan como piezas de construcción. Nonead DSH Desktop no modifica el código upstream y no es un shell con todo cableado: el upstream fijado se ejecuta tal cual, y el propio shell de escritorio se conecta mediante la misma regla de «todo es un plugin».

Quien escribe plugins solo necesita tres cosas:

1. **Los plugins DSH normales** se desarrollan exactamente igual que en cualquier entorno DSH; consulta [desarrollo de plugins](docs/plugin-development.en.md).
2. **Los servicios de Desktop** (`desktopProfiles`, `desktopPnpm`, …) permiten a los plugins inspeccionar o cambiar perfiles e instalar, actualizar o eliminar plugins; consulta [servicios de plugins de Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md).
3. **Composición y parches**: un perfil se compone apilando capas de parches, donde `id` coincide con una fila existente e `insert` añade filas nuevas; ten en cuenta los tres modos de fallo «silenciosamente inertes» de [Límites de seguridad](#security).

La visión y los tres principios están en la [propuesta de ecosistema de plugins de DSH](docs/plugin-ecosystem.en.md); la propuesta comunitaria de un contrato unificado de plugins es [Community Fabric](dsh-community-fabric/README.md).

<a id="upstream"></a>

## Relación con upstream

Nonead DSH Desktop es un proyecto comunitario independiente construido sobre [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) y el modelo de plugins de Cordis, desarrollado y mantenido por **Nonead Corporation**.

El upstream aporta las capacidades centrales del agente, el sistema de plugins, la interfaz web y los paquetes del runtime. Este repositorio se encarga de:

- Empaquetado de la aplicación de escritorio (proceso principal de Electron, ventanas, bandeja, menús, materiales)
- Arrancar, detener y recuperar el servicio Host local, incluidas las alternativas ante fallos
- Perfiles y capas de parches, el asistente de primera ejecución, el control de acceso desde el navegador y la LAN
- Distribuir el mercado de plugins y el skin de marca dentro del instalador
- Compilaciones de Windows / macOS / Linux, firma y flujo de publicación, y actualización automática

Si solo quieres usar DeepSeek Harness desde la línea de comandos, o trabajar en su núcleo, ve al repositorio upstream.

<a id="changelog"></a>

## Registro de cambios

El historial completo está en el [registro de cambios](CHANGELOG.es.md) ([中文](CHANGELOG.md)). Versiones recientes:

| Versión | Fecha | Aspectos destacados |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | Notas de la versión en la tarjeta de actualización, la bandeja y los diálogos nativos, omisión de una versión, reintento de instalación y reversión a instantáneas; estado de ventana recordado, `.env` por capas, enlaces profundos `dsh-desktop://` y abrir al iniciar sesión; previsualización de medios del mercado e instalación por nombre; `dshmarket` `1.66.45` |
| `2.2.3` | 2026-10-29 | El shell de escritorio está totalmente localizado en ocho idiomas (chino, inglés, japonés, español, francés, alemán, ruso y portugués de Brasil): cinco diccionarios nuevos del shell más diccionarios de la página de ajustes en seis idiomas, búsquedas basadas en plantillas para los diálogos con interpolación, y el espacio de nombres de idioma del cliente y los menús nativos siguen el mismo conjunto |
| `2.2.2` | 2026-10-28 | El runtime pasa a DSH `0.2.2-alpha.2` (370 paquetes re-vendored, 24 parches de versión y el parche del mercado rebasados), dshmarket pasa a 1.73.1 y el puente de Agents Anywhere se reconstruye para los nuevos rangos de peer |
| `2.1.18` | 2026-10-24 | El runtime pasa a DSH `0.2.2-alpha.2` (344 paquetes re-vendored, 24 parches rebasados), el puente de Agents Anywhere se compila desde el código fuente con un parche de conector rebasado, llega una compilación experimental de Windows ARM64 y se corrigen el texto de la tarjeta de actualización y la posición del progreso; incluye el lote de correcciones de auditoría de la 2.1.17 |
| `2.1.17` | 2026-10-24 | Lote de correcciones de auditoría: carrera al refrescar la recuperación, recomprobación de inodos de los puntos de control y degradación a una sola ranura, escritura atómica de ajustes, liberación en la ruta de fallo de actualización, limpieza del estado de plugins y del staging, propiedad de los diálogos de la bandeja, paginación del mercado y declaración del skin, correcciones de las puertas de CI |
| `2.1.16` | 2026-10-22 | Correcciones de seguridad y de puertas: las puertas de CI ejecutan el clasificador del lado base, fuses de Electron más estrictos (`NODE_OPTIONS`/`--inspect` cerrados, el shell estable carga solo desde `app.asar`; `runAsNode` se mantiene porque los shims de Host/CLI/pnpm lo necesitan y ahora está fijado por aserciones derivadas del layout), credencial del renderer inyectada por una tubería privada, la puerta web falla en cerrado, lista de acciones permitidas para enlaces profundos, enmascarado de secretos con base64url; el acoplamiento `asarUnpack` / `files[].from` del shell estable ahora está fijado por una prueba que deriva el prefijo (los patrones existentes se verificaron correctos), se añadió CI de empaquetado del shell estable y `verify-layout` ahora exige la paridad de versiones |
| `2.1.13` | 2026-10-21 | El runtime pasa a DSH `0.2.1-rc.2`, `dshmarket` `1.66.44`, puente de AA `39b82d4`, nuevo wordmark de arranque y guía sobre la clave de API en la configuración inicial, el desbordamiento de la cola de AA descarta eventos en lugar de fallar |

<a id="limits"></a>

## Limitaciones conocidas

- **La actualización desde la aplicación en Linux solo comprueba la versión** y nunca descarga un instalador; para actualizar, descarga un AppImage nuevo.
- **Windows ARM64 se distribuye como compilación experimental**: `dist:win:stable` solo genera el instalador x64 por defecto; arm64 requiere `DSH_PACKAGE_ARCH=arm64` (combínalo con `DSH_PACKAGE_OUTPUT_DIR` para un directorio de salida aparte). El shell es arm64 nativo mientras el runtime incluido sigue en el paquete x64 (emulación de Windows), una compilación cruzada omite las pruebas de humo que requieren ejecución, y el canal de actualización solo lleva un artefacto `windows`, así que no puede servir x64 y arm64 a la vez.
- **Los instaladores de Windows aún no se verifican criptográficamente**: la ruta de descarga admite un `installerSha256` del servidor, pero el endpoint de versión no lo publica, así que por ahora solo se comparan `ProductName` / `ProductVersion` (solo en el shell estable; el shell Beta comprueba únicamente los bytes mágicos y el tamaño del instalador y luego lo ejecuta).
- **El acceso a la LAN no tiene autenticación**: entrega el DSH de este equipo a cualquiera en el mismo segmento de red.
- **Un nombre de servicio `inject` equivocado en un plugin falla en silencio** y queda como un plugin pendiente para siempre, visible solo como un 4xx HTTP.
- Un `yarn install` local puede reescribir la huella de contenido de `dsh-nonead-client-skin` en `yarn.lock` (no reproducible entre máquinas); **no confirmes esos cambios locales del lockfile**.

<a id="community"></a>

## Comunidad

- Discord: [únete a la comunidad de Nonead DSH Desktop](https://discord.gg/TJeGqKRNM)
- Grupos de WeChat Work y QQ: escribe a @王博升Benson después de unirte, o solicita una invitación por correo
- Si te interesa unirte al equipo: escribe a [t4wefan@qq.com](mailto:t4wefan@qq.com)

<a id="links"></a>

## Enlaces

Proyectos del ecosistema de DeepSeek Harness y herramientas para desarrolladores:

| Proyecto | Descripción | Enlace |
| --- | --- | --- |
| dshfind | Comunidad de aprendizaje e intercambio sobre DeepSeek Harness (DSH). | [GitHub](https://github.com/hikariming/dshfind) · [Sitio web](https://dshfind.com) |
| DSH 1024Store | Catálogo comunitario de plugins para DSH, con un mercado de código abierto, una canalización de catálogo y una API pública de consulta. | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | Lista seleccionada de plugins de DeepSeek Harness. | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | Mercado visual de plugins dentro de DSH, con navegación, búsqueda e instalación con un clic. | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | OCR, maquetación y reconocimiento semántico para DSH y para agentes de código de solo texto. | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness orange book | Manual comunitario de práctica medida de DeepSeek Harness. | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | Colección de plugins y skins de la interfaz web de DeepSeek Harness. | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | Interfaz de terminal interactiva a pantalla completa para DeepSeek Harness. | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | Panel de contexto para DSH: cuadro de mando, comando `/context` y navegador. | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | Controla desde el teléfono un agente de código en tu ordenador. | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | Espacio de trabajo de barra lateral para DSH que integra archivos, terminal, Git y subagentes. | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | Lista seleccionada de plugins, herramientas e infraestructura de DSH. | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## Licencia

Copyright © 2026 **Nonead Corporation**. Distribuido bajo la [licencia MIT](LICENSE).

> «DeepSeek Harness» es una marca registrada de DeepSeek. El nombre se usa solo para describir con precisión la compatibilidad, la procedencia técnica y la relación con el software upstream.

> Este proyecto es completamente gratuito y de código abierto. Si alguien te vende este software de cualquier forma, rechaza la transacción.

> Nonead DSH Desktop es un proyecto comunitario independiente y no tiene relación de dependencia, colaboración, licencia ni respaldo con DeepSeek.
