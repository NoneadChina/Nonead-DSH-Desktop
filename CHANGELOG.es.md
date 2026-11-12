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

## 2.2.10 — 2026-11-12

Tiempo de ejecución elevado a DSH 0.2.2-rc.2, adaptando los cambios incompatibles del nuevo núcleo:

- Runtime: DeepSeek Harness incluido pasa de 0.2.2-rc.1 a **0.2.2-rc.2** (commit upstream `ddac96760`, 374 paquetes re-vendored, 24 parches de escritorio rebasados). `dsh-experimental-agent-team` pasa a ser `@deepseek-ai/dsh-agent-team`; paquetes como `dsh-error` ahora son dependencias peer que la aplicación declara explícitamente.
- Puente: el puente de Agents Anywhere sigue en la línea 2.1.0, cuyo rango peer es anterior a rc.2; al activar el control remoto la aplicación escribe una excepción de versión exacta en `compatibility.json` del perfil, por lo que el puente sigue cargando.
- Plugins incluidos: `@deepseek-ai/dsh-tool-subagent` sube a 0.2.2-rc.2 para coincidir con la cadena de dependencias del runtime; el paquete baja de 35 a **27**: `@linxin666/dsh-client-ui-skill-explorer`, `@weibaohui/skills-management`, `dsh-image-gen`, `dsh-nonead-ursim`, `dsh-nonead-universal-robots`, `dsh-superagent`, `dsh-univer-office` y `dshmarket` salen del conjunto (el mercado de plugins se sigue compilando en el instalador con su versión fijada, solo deja de venir preinstalado), y otros siete siguen npm latest; la lista completa está más abajo.
- Documentación: los README en ocho idiomas y `THIRD_PARTY_NOTICES` se sincronizan con los nuevos datos de versión.
- Versión: producto 2.2.9 → **2.2.10** (ambos espacios de trabajo de escritorio).

### Lista de plugins incluidos (27)

Estos 27 plugins se distribuyen con el instalador; tras el primer arranque puede activarlos, desactivarlos o quitarlos desde la página Plugins. El número tras cada nombre es la versión incluida.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Memoria automática. Recupera decisiones previas y resume los registros en notas y libros.
- `@changfenhuang/dsh-genui` 0.16.0 — UI generativa. El modelo dibuja gráficos, formularios y diagramas; los clics vuelven a él.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.2 — Delegación en subagentes. Pasa trabajo independiente al backend y avisa al terminar.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Gráfico de Git. Cambia de rama en sesión vacía y muestra el historial y los worktrees.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Tablero de tareas. El host abre sesiones reales para ejecutar tarjetas, con cron y reposo.
- `@michengai/dsh-agency-agents` 1.2.27 — Biblioteca de expertos. 331 especialistas invocables y cinco equipos de expertos.
- `@michengai/dsh-archive-manager` 1.3.1 — Archivo de sesiones. Archiva, restaura y borra sesiones y diagnostica registros dañados.
- `@michengai/dsh-code-review` 1.0.10 — Revisión de código. Un subagente aparte revisa Git, fuentes y pruebas y trae el informe.
- `@michengai/dsh-skills-manager` 1.4.1 — Gestor de habilidades. Carga y administra las locales, con instalación desde GitHub.
- `@tt-a1i/archify-dsh` 1.1.0 — Diagramas de arquitectura. Integra Archify para dibujar desde una descripción del sistema.
- `@wenaixi/dsh-superpower` 8.0.0 — Paquete de ingeniería. Porta 15 habilidades de superpowers, con conmutación individual.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Memoria del proyecto. Indexa documentos y símbolos con citas path:line y guarda lecciones.
- `billion-context` 0.1.213 — Compresión de contexto. Pliega conversaciones largas en resúmenes para usar menos tokens.
- `dsh-better-sidebar` 0.30.1 — Barra lateral mejorada. Reúne árbol, editor, cambios, tareas y chat lateral por sesión.
- `dsh-client-auto-continue` 0.18.0 — Continuación automática. Reenvía la petición de continuar si el fallo no es del usuario.
- `dsh-config-manager` 0.8.0 — Gestor de configuración. Respalda, restaura, exporta, importa, migra y sincroniza DSH.
- `dsh-context` 0.83.1 — Perspectiva del contexto. Un panel muestra su composición y comprime cuando hace falta.
- `dsh-cost-meter` 1.9.64 — Panel de coste. Cuenta tokens y coste por sesión, día e historial, con más de 170 precios.
- `dsh-excel-chat` 0.43.0 — Chat de hojas de cálculo. Lee, edita y limpia hojas en lenguaje natural y valida fórmulas.
- `dsh-find-plugins` 0.3.0 — Descubrimiento de plugins. Agrega cinco catálogos y busca en GitHub y npm por relevancia.
- `dsh-github-skills` 0.2.1 — Habilidades de flujo de GitHub. Parte de la semántica de OpenAI Codex y la adapta a DSH.
- `dsh-markitdown` 0.2.2 — Documentos a Markdown. Convierte PDF, Word, Excel, PPT, HTML o una URL en texto legible.
- `dsh-mcp-connector` 0.2.101 — Conector MCP. Incluye más de cien conectores, gestiona autorización y diagnostica fallos.
- `dsh-nonead-prompt-recall` 0.8.7 — Historial de entrada. Con el compositor vacío, ↑ recupera la instrucción anterior.
- `dsh-nonead-prompt-rewind` 0.5.4 — Rebobinado de la conversación. Vuelve a un mensaje anterior y restaura los archivos.
- `dsh-ppt-master` 6.1.0 — Generación de presentaciones. Crea PPTX editable y exporta SVG o mejora el archivo.
- `dsh-remotion` 0.10.5 — Taller de vídeo. Convierte un proyecto React en vídeo con plantillas, vista previa y MP4.

## 2.2.9 — 2026-11-10

El tiempo de ejecución pasa a DSH 0.2.2-rc.1, el conjunto de plugins incluidos llega a 35 y la guía de puesta en marcha del instalador cambia de enfoque:

- Tiempo de ejecución: el DeepSeek Harness incluido pasa de 0.2.2-alpha.3 a **0.2.2-rc.1** (commit upstream `66491b0`, con la familia cordis promovida a 4.1.0 y schemastery 3.19.0). `vendor/dsh-runtime/0.2.2-rc.1` se reconstruye desde el código upstream local como 373 paquetes, exactamente el mismo conjunto que la versión anterior; los 24 parches de escritorio se reajustan sobre los nuevos artefactos, el `resolutions` raíz y las dependencias de DSH de los dos espacios de trabajo de escritorio apuntan a la nueva versión, y `yarn check:vendored-runtime` pasa en ambos canales.
- Guía de inicio: el paso «listo para usar» del instalador ya no enumera todos los plugins de entrada, sino que explica por categorías qué cubre el conjunto incluido; al empezar la instalación, cada plugin muestra al llegar su turno el nombre, la versión, la categoría y la descripción completa, y da crédito a su autor: «Gracias a X por este plugin».
- Plugins incluidos: el conjunto pasa de 30 a **35**, con la incorporación de `@changfenhuang/dsh-genui`, `@deepseek-ai/dsh-tool-subagent`, `@linxin666/dsh-client-ui-task-board`, `@weibaohui/skills-management`, `billion-context`, `dsh-client-auto-continue`, `dsh-cost-meter`, `dsh-markitdown`, `dsh-nonead-prompt-rewind`, `dshmarket`; salen del conjunto `dsh-api-client`, `dsh-design`, `dsh-doc-reader`, `dsh-rewind-plugin` y `@kenz1117/dsh-ui-usage-billing`.
- Actualización de plugins: `dsh-ppt-master` 1.0.8 → 6.1.0, `dsh-config-manager` 0.3.1 → 0.6.0, `@michengai/dsh-skills-manager` 1.2.28 → 1.4.0, `dsh-better-sidebar` 0.28.2 → 0.30.1, `dsh-context` 0.80.3 → 0.83.0, y el resto sigue npm latest.
- Manifiesto de plugins: `plugin/manifest.json` sube a v4 y cada entrada lleva categoría y autor; de ahí salen la agrupación y la línea de crédito del instalador.
- Versión: producto 2.2.6 → **2.2.9** (los dos espacios de trabajo de escritorio avanzan juntos).
- Aviso al iniciar: un Profile que no habilita el control remoto ya no escribe la fila del puente en su capa cordis, así que `patch: entry "agents-anywhere-bridge-next" not found` deja de aparecer en cada arranque; los Profile que sí lo habilitan conservan la fila anterior, incluidas las redirecciones de la instalación empaquetada.
- Complementos incluidos: `dsh-nonead-ursim` pasa a **0.3.15** con una descripción de simulación (antes coincidía byte a byte con el complemento de robot real `dsh-nonead-universal-robots`, lo que invitaba a instalarlo para trabajo con hardware).
- Puente incluido: el puente de Agents Anywhere pasa a la línea **2.1.0** (tag `v2.1.0`). AA exige actualizar el complemento junto con un salto MINOR de Desktop/Connector; si no, la conexión local se queda esperando. El artefacto sigue siendo la variante desktop de compilación propia, con el parche de robustez del conector reajustado a 2.1.0.
- Actualizaciones: `@michengai/dsh-archive-manager` 1.3.1, `dsh-config-manager` 0.7.0, `dsh-context` 0.83.1, `dshmarket` 1.73.17.

### Lista de plugins incluidos (35)

Estos 35 plugins se distribuyen con el instalador; tras el primer arranque puede activarlos, desactivarlos o quitarlos desde la página Plugins. El número tras cada nombre es la versión incluida.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Memoria automática. Recupera decisiones previas y resume los registros en notas y libros.
- `@changfenhuang/dsh-genui` 0.16.0 — UI generativa. El modelo dibuja gráficos, formularios y diagramas; los clics vuelven a él.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1 — Delegación en subagentes. Pasa trabajo independiente al backend y avisa al terminar.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Gráfico de Git. Cambia de rama en sesión vacía y muestra el historial y los worktrees.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.16 — Centro de habilidades. Explora las habilidades por origen y permite crearlas o borrarlas.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Tablero de tareas. El host abre sesiones reales para ejecutar tarjetas, con cron y reposo.
- `@michengai/dsh-agency-agents` 1.2.27 — Biblioteca de expertos. 331 especialistas invocables y cinco equipos de expertos.
- `@michengai/dsh-archive-manager` 1.3.1 — Archivo de sesiones. Archiva, restaura y borra sesiones y diagnostica registros dañados.
- `@michengai/dsh-code-review` 1.0.9 — Revisión de código. Un subagente aparte revisa Git, fuentes y pruebas y trae el informe.
- `@michengai/dsh-skills-manager` 1.4.0 — Gestor de habilidades. Carga y administra las locales, con instalación desde GitHub.
- `@tt-a1i/archify-dsh` 1.1.0 — Diagramas de arquitectura. Integra Archify para dibujar desde una descripción del sistema.
- `@weibaohui/skills-management` 0.9.3 — Mercado de habilidades. Gestiona en una página las de cada agente local, con más de 6600.
- `@wenaixi/dsh-superpower` 8.0.0 — Paquete de ingeniería. Porta 15 habilidades de superpowers, con conmutación individual.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Memoria del proyecto. Indexa documentos y símbolos con citas path:line y guarda lecciones.
- `billion-context` 0.1.213 — Compresión de contexto. Pliega conversaciones largas en resúmenes para usar menos tokens.
- `dsh-better-sidebar` 0.30.1 — Barra lateral mejorada. Reúne árbol, editor, cambios, tareas y chat lateral por sesión.
- `dsh-client-auto-continue` 0.17.4 — Continuación automática. Reenvía la petición de continuar si el fallo no es del usuario.
- `dsh-config-manager` 0.7.0 — Gestor de configuración. Respalda, restaura, exporta, importa, migra y sincroniza DSH.
- `dsh-context` 0.83.1 — Perspectiva del contexto. Un panel muestra su composición y comprime cuando hace falta.
- `dsh-cost-meter` 1.9.62 — Panel de coste. Cuenta tokens y coste por sesión, día e historial, con más de 170 precios.
- `dsh-excel-chat` 0.43.0 — Chat de hojas de cálculo. Lee, edita y limpia hojas en lenguaje natural y valida fórmulas.
- `dsh-find-plugins` 0.3.0 — Descubrimiento de plugins. Agrega cinco catálogos y busca en GitHub y npm por relevancia.
- `dsh-github-skills` 0.2.1 — Habilidades de flujo de GitHub. Parte de la semántica de OpenAI Codex y la adapta a DSH.
- `dsh-image-gen` 0.11.1 — Generación de imágenes. Dibuja y retoca hablando, con Gemini, OpenAI, Seedream o ComfyUI.
- `dsh-markitdown` 0.2.2 — Documentos a Markdown. Convierte PDF, Word, Excel, PPT, HTML o una URL en texto legible.
- `dsh-mcp-connector` 0.2.97 — Conector MCP. Incluye más de cien conectores, gestiona autorización y diagnostica fallos.
- `dsh-nonead-prompt-recall` 0.8.7 — Historial de entrada. Con el compositor vacío, ↑ recupera la instrucción anterior.
- `dsh-nonead-prompt-rewind` 0.5.4 — Rebobinado de la conversación. Vuelve a un mensaje anterior y restaura los archivos.
- `dsh-nonead-universal-robots` 0.8.6 — Brazos UR. Mueve cobots Universal Robots en lenguaje natural: pose, articulaciones y E/S.
- `dsh-nonead-ursim` 0.3.15 — Simulación UR. Valida movimientos sin conexión antes de tocar la máquina real.
- `dsh-ppt-master` 6.1.0 — Generación de presentaciones. Crea PPTX editable y exporta SVG o mejora el archivo.
- `dsh-remotion` 0.10.5 — Taller de vídeo. Convierte un proyecto React en vídeo con plantillas, vista previa y MP4.
- `dsh-superagent` 0.1.0 — Prototipo de agente proactivo (investigación de DeepSeek, no un producto oficial). Vigila un repositorio de GitHub (opcionalmente Feishu) y ejecuta las peticiones autorizadas como tareas en sesiones propias.
- `dsh-univer-office` 0.4.0 — Integración con Office. Trae hojas, documentos, presentaciones, lienzos y bases a DSH.
- `dshmarket` 1.73.17 — Mercado visual de plugins. Explora, busca e instala plugins dentro de DSH en un clic.

## 2.2.6 — 2026-11-03

El tiempo de ejecución pasa a DSH 0.2.2-alpha.3 y el conjunto de plugins incluidos llega a 30:

- Tiempo de ejecución: el DeepSeek Harness incluido pasa de 0.2.2-alpha.2 a **0.2.2-alpha.3** (commit upstream `05b1cae`, con la actualización de vendor cordis 4.0.6-alpha.2 y cosmokit 1.8.7-alpha.2). `vendor/dsh-runtime/0.2.2-alpha.3` se reconstruye desde el código upstream local como 373 paquetes, y tanto el `resolutions` raíz como los dos espacios de trabajo de escritorio apuntan a la nueva versión; `yarn check:vendored-runtime` pasa en ambos canales.
- Plugin nuevo: `dsh-superagent` 0.1.0 (prototipo de investigación de DeepSeek: vigila GitHub y Feishu, convierte las solicitudes autorizadas en tareas que se ejecutan en sesiones propias y un panel web reúne lo que necesita a una persona; creado desde `deepseek-ai/dsh-superagent-prototype` con su cadena de compilación oficial).
- Actualización de plugins: `dsh-remotion` pasa a 0.10.4 y `dsh-design` sustituye al no publicado `dsh-design-skills`; `@michengai/dsh-agency-agents` 1.2.23, `@michengai/dsh-archive-manager` 1.2.0, `@michengai/dsh-code-review` 1.0.7, `@michengai/dsh-skills-manager` 1.2.28, `dsh-config-manager` 0.3.1, `dsh-context` 0.80.3 y `dsh-rewind-plugin` 0.19.2 siguen npm latest.
- Mercado incluido: `dshmarket` pasa a 1.73.9.
- Herramientas: el nuevo `yarn plugins:update` actualiza todos los archivos de `plugin/` a npm latest y reconstruye el manifiesto.
- Versión: producto 2.2.5 → **2.2.6** (los dos espacios de trabajo de escritorio avanzan juntos).

### Lista de plugins incluidos (30)

Estos 30 plugins se distribuyen con el instalador; tras el primer arranque puede activarlos, desactivarlos o quitarlos desde la página Plugins. El número tras cada nombre es la versión incluida.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Memoria automática. Inyecta el trabajo pasado relevante y las decisiones ya tomadas antes de empezar una tarea, sin necesidad de pedirlo; el contexto acumulado permanece en este equipo y sigue siendo consultable entre sesiones.
- `@kenz1117/dsh-ui-usage-billing` 1.8.1 — Panel de uso y coste. Reúne las métricas de consumo y el detalle del gasto en la barra lateral para poder revisar el coste en cualquier momento.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Gráfico de ramas de Git. Dibuja el historial de confirmaciones y el flujo de ramas, y permite cambiar de rama desde una sesión vacía sin volver al terminal.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.14 — Centro de habilidades. Explora las habilidades cargadas por origen, muestra qué hace cada una y aclara qué componente aporta una capacidad concreta.
- `@michengai/dsh-agency-agents` 1.2.23 — Biblioteca de expertos. Incluye 331 agentes especialistas invocables de ingeniería, diseño, marketing, legal y más; para un juicio de un área concreta se invoca al experto correspondiente en lugar de dejar que la sesión principal lo supla.
- `@michengai/dsh-archive-manager` 1.2.0 — Archivo de sesiones. Archiva, restaura, marca como favoritas y elimina definitivamente sesiones, y diagnostica registros de sesión dañados, de modo que la limpieza rutinaria no obliga a perder registros que aún quieres.
- `@michengai/dsh-code-review` 1.0.7 — Revisión de código. Un flujo de revisión estilo Codex ejecutado por un subagente nativo independiente, con alcance de revisión elegible (cambios, un rango de confirmaciones o todo el repositorio).
- `@michengai/dsh-skills-manager` 1.2.28 — Gestor de habilidades. Carga en un solo lugar las habilidades del agente local y las mantiene gestionadas de forma segura, con el origen y el estado de activación a la vista.
- `@tt-a1i/archify-dsh` 1.0.0 — Diagramas de arquitectura. Convierte la estructura de un sistema o un proceso de negocio en diagramas interactivos de arquitectura, flujo, secuencia, flujo de datos y estados.
- `@wenaixi/dsh-superpower` 8.0.0 — Paquete de habilidades de ingeniería. Quince habilidades de ingeniería de superpowers, disponibles en chino e inglés.
- `@yolk_vat-y/dsh-project-memory` 0.6.9 — Memoria del proyecto. Indexa documentos (PDF, Markdown) y símbolos de código para que las preguntas posteriores se respondan por recuperación en lugar de relectura.
- `dsh-api-client` 0.2.0 — Depuración de API. Envía peticiones HTTP y muestra las respuestas dentro del editor, para trabajos de integración de interfaces.
- `dsh-better-sidebar` 0.28.2 — Una barra lateral mejor. Fusiona árbol de archivos, editor, cambios, tareas y chat lateral en una sola columna, independiente por sesión; además expone a otros plugins un servicio de registro de pestañas laterales y visores de archivos.
- `dsh-config-manager` 0.3.1 — Gestor de configuración. Copia de seguridad, restauración, exportación, importación, migración y sincronización de la configuración de DSH, para trasladar el entorno a otro equipo o tras reinstalar.
- `dsh-context` 0.80.3 — Observación y gestión del contexto. Muestra el uso actual del contexto y comprime cuando se acerca al límite.
- `dsh-design` 0.2.0 — Habilidades de sistema de diseño. Restringe las decisiones de diseño y usa `design_audit` para medir escala tipográfica, contraste, espaciado y deriva de la paleta en páginas renderizadas.
- `dsh-doc-reader` 0.2.0 — Lector de documentos. Extrae el texto de PDF, Word y formatos similares para que el modelo lea el documento y no solo su nombre de archivo.
- `dsh-excel-chat` 0.43.0 — Chat de hojas de cálculo. Opera hojas de Excel en lenguaje natural sin memorizar funciones ni coordenadas de celdas.
- `dsh-find-plugins` 0.3.0 — Búsqueda de plugins. Busca plugins en cinco catálogos comunitarios y realiza búsquedas en vivo en GitHub y npm.
- `dsh-github-skills` 0.2.1 — Habilidades de flujo de trabajo de GitHub. Adaptadas a partir de las habilidades de GitHub de OpenAI Codex.
- `dsh-image-gen` 0.10.2 — Generación de imágenes. Se conecta a Gemini, OpenAI y proveedores similares para generar y editar imágenes.
- `dsh-mcp-connector` 0.2.93 — Conector MCP. Conecta servicios MCP y ofrece búsqueda e invocación unificadas de herramientas entre ellos.
- `dsh-nonead-prompt-recall` 0.8.4 — Historial de entrada. Pulsa ↑ en un compositor vacío para recuperar la instrucción anterior.
- `dsh-nonead-universal-robots` 0.8.5 — Brazos robóticos UR. Controla brazos Universal Robots directamente en lenguaje natural, sin escribir scripts a mano.
- `dsh-nonead-ursim` 0.3.13 — Simulación UR. Programa el movimiento del brazo en un simulador sin conexión, para validar una trayectoria antes de tocar hardware real.
- `dsh-ppt-master` 1.0.8 — Generación de presentaciones. Produce diapositivas a partir del contenido facilitado.
- `dsh-remotion` 0.10.4 — Producción de vídeo. Renderiza vídeo desde un proyecto React dentro de DSH.
- `dsh-rewind-plugin` 0.19.2 — Rebobinado de la conversación. Retrocede la conversación en la misma ventana y restaura con ella los archivos del espacio de trabajo.
- `dsh-superagent` 0.1.0 — Prototipo de superagente. Vigila GitHub y Feishu, convierte las solicitudes autorizadas en tareas que se ejecutan en sesiones separadas y un panel web reúne lo que necesita a una persona (prototipo de investigación de DeepSeek, no un producto oficial).
- `dsh-univer-office` 0.4.0 — Documentos de Office. Integración de DSH y Univer para hojas de cálculo, documentos y presentaciones.

## 2.2.4 — 2026-10-31

Actualización de versión sin cambios funcionales:

- Versión: producto 2.2.3 → **2.2.4** (ambos espacios de trabajo de escritorio sincronizados).

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
