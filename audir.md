# Registro de decisiones y problemas

Este archivo recoge decisiones y correcciones que deben mantenerse durante el desarrollo de ScriptArc.

## Decisiones

- El repositorio clonado no tenía commits ni ramas publicadas en `origin`; se conservó su `.git` y se trabaja en `main`.
- Se usa pnpm porque fue el package manager del scaffold disponible. No mezclar npm o yarn ni generar locks alternativos.
- La interfaz parte del scaffold oficial de Tauri 2 con Vue 3, TypeScript estricto y Vite. Se quitó la pantalla de saludo de muestra.
- El Markdown escrito por el usuario es la fuente canónica. Texto pronunciable, tokens y renderizado son derivados y nunca deben sobrescribirlo.
- La interfaz base utiliza variables CSS y tipografía del sistema para seguir siendo simple y funcionar sin conexión.
- El guardado debe ser local. No añadir servicios remotos, cuentas, IA ni una base de datos.
- Los proyectos `.scriptarc` conservan texto y configuración como JSON versionado; se guarda un borrador local y los archivos elegidos por el usuario usan los diálogos Tauri.
- La grabación manual guarda un intervalo por token pronunciable. Cambiar el Markdown invalida esos tiempos para que no se asignen a palabras distintas; la puntuación sigue unida a su última palabra.
- En RECORD, cada avance mide la palabra actual; retroceder elimina solo los intervalos desde esa palabra y reinicia su cronómetro. El último avance completa la sesión, sin paso extra para su signo final.
- El cursor, el temporizador reanudable y el progreso pertenecen al composable de playback; la vista de texto solo presenta bloques y palabras, para que el formato Markdown no determine la unidad de avance.
- La vista mantiene todos los párrafos y centra suavemente la palabra activa; la barra de progreso busca por token y muestra tiempo usando las duraciones automáticas o grabadas.
- El parser de Markdown conserva los encabezados y los estilos inline como metadata por palabra; el signo de puntuación unido o separado por un espacio nunca crea un paso independiente.
- La conversión cardinal usa `n2words` con importaciones regionales `es` y `en`; su licencia MIT, módulos pequeños y cero dependencias permiten cubrir ambos idiomas sin mantener gramática numérica propia. Un adaptador local reconoce agrupadores y conserva la puntuación del token.
- El pacing automático mide la longitud de la pronunciación derivada (no el Markdown ni el rótulo numérico), escala con palabras por minuto, añade pausas de puntuación y limita cada palabra a 250–8000 ms para prevenir tiempos extremos.
- El tema y los valores predeterminados de idioma, ritmo y tamaño pertenecen al usuario; el proyecto conserva sus propios idioma, ritmo y tamaño. Los seis temas usan las mismas variables CSS; blanco es el valor inicial.
- Mantener organización pequeña por feature; evitar capas ceremoniales y dependencias que no resuelvan una necesidad del producto.

## Problemas encontrados y solución

- **El repositorio parecía vacío al clonarse.** `origin` no tenía refs publicadas. Se generó el scaffold de Tauri en una subcarpeta temporal y se copiaron sus archivos a la raíz, conservando `.git` en vez de reemplazar el clon.
- **El scaffold traía nombre, logos y saludo de ejemplo.** Se cambió el nombre a ScriptArc, se eliminó el comando de saludo y el plugin de apertura que no se usaba, y se preparó una pantalla inicial propia.
- **La primera edición de documentación esperaba texto distinto al README real del scaffold.** No se aplicó parcialmente. Se verificó el contenido presente y se reemplazó por los dos documentos solicitados: `README.md` y `audir.md`.
- **El plugin de sistema de archivos de Tauri exige permisos y scopes explícitos.** Se habilitaron únicamente lectura y escritura de texto; la app obtiene acceso a la ubicación elegida mediante los diálogos de abrir/guardar, sin dar acceso global a la carpeta del usuario.
- **El primer bloque de controles manuales dejó un fragmento duplicado al final de `App.vue`.** Vite notificó `Invalid end tag`; se quitó el fragmento residual y se volvió a comprobar lint, TypeScript, pruebas, build web y build de Tauri antes de publicar.
- **El directorio temporal `scriptarc-scaffold/` permanece en el disco y está ignorado por Git.** La política del entorno bloqueó su borrado recursivo. La raíz `E:\ScriptArc` es el único proyecto activo; no editar ni compilar el backup temporal. Se puede limpiar manualmente al terminar si se desea.

## Decisiones y problemas añadidos durante la fase de distribución

- **Los proyectos y las preferencias estaban mezclados.** Se subió el formato `.scriptarc` a la versión 2: ritmo/idioma y tamaño efectivo siguen al guion, mientras tema, valores predeterminados, cuenta regresiva y ocultación de controles se guardan como preferencias locales del usuario. La versión 1 se migra al abrirse, para no perder guiones existentes.
- **El borrador local se abría sin que el usuario pudiera elegir.** La recuperación ahora se guarda aparte del archivo `.scriptarc`, restaura con una pregunta y conserva su huella de guardado anterior. Nunca escribe un borrador sobre el archivo real. Los cambios sin guardar ofrecen Guardar, No guardar y Cancelar antes de reemplazar o cerrar.
- **La posición de lectura no estaba en el proyecto.** El formato v2 ahora guarda el índice de la palabra para poder reanudar después de cerrar y volver a abrir. Cambiar el Markdown reinicia esa posición y elimina los tiempos manuales, porque ambos índices dejarían de corresponder.
- **Los JSON podían estar bien formados pero no corresponder al guion.** La validación comprueba campos, idioma, límites, fechas, índices únicos y que cada tiempo manual apunte a una palabra existente. Las versiones futuras se identifican aparte para que no se sobrescriban accidentalmente.
- **El ritmo acumulaba retraso si el event loop tardaba en despertar.** El scheduler avanza contra vencimientos absolutos y recupera palabras vencidas en un único callback, en lugar de sumar retraso en cada `setTimeout`. Sigue habiendo un solo timeout y un solo intervalo de reloj, y se cancelan al pausar o desmontar.
- **El prototipo deshabilitaba CSP en Tauri.** El frontend nunca ejecuta HTML Markdown (`v-html` no se usa), se omiten etiquetas HTML raw y Tauri ahora limita los orígenes de scripts, imágenes y conexiones. Se conserva `unsafe-inline` para estilos inline dinámicos de Vue; no se permiten scripts remotos.
- **El icono seguía siendo el arte de muestra del scaffold.** Se creó `src-tauri/icons/scriptarc.svg` como fuente, y `pnpm tauri icon` genera los formatos de escritorio usados por el bundle. `mainBinaryName` alinea el ejecutable con `ScriptArc.exe` aunque el crate de Cargo se llame `scriptarc`.
- **Tauri depende del WebView2 del sistema.** El portable no empaqueta un runtime de ~180 MB: está dirigido a Windows moderno que ya lo incluye. El instalador NSIS conserva el modo oficial `downloadBootstrapper`, que instala WebView2 si falta y puede requerir internet.
- **Un portable no es un bundle portable oficial de Tauri.** El ZIP se arma a partir del `.exe` Windows ya compilado más `README.txt` y `LICENSE.txt`, se inspecciona para confirmar exactamente esos tres archivos y no se sube al repositorio. La acción de Tauri crea el setup y GitHub Actions adjunta el ZIP a la misma Release.
- **Un tag erróneo podía publicar una versión distinta de la configurada.** `scripts/check-version.mjs` contrasta paquete, Tauri y Cargo, y en tags exige que `vX.Y.Z` corresponda al SemVer del proyecto antes de crear la Release.
- **No se debía repetir el build solo para comprimir el portable.** El script compartido acepta `-SkipBuild`: el workflow lo usa después de que `tauri-action` termina el build, mientras el launcher local conserva el flujo completo de build y compresión.
- **Los controles llamados “predeterminados” estaban cambiando también el proyecto abierto.** Esto mezclaba preferencias globales con configuración persistida en `.scriptarc`; ahora esos controles solo guardan preferencias locales y el selector Automático edita el idioma y el ritmo del guion actual.
