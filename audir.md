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
- Las preferencias del tema, idioma, ritmo y tamaño pertenecen al proyecto y se guardan localmente. Los seis temas usan las mismas variables CSS; blanco es el valor inicial.
- Mantener organización pequeña por feature; evitar capas ceremoniales y dependencias que no resuelvan una necesidad del producto.

## Problemas encontrados y solución

- **El repositorio parecía vacío al clonarse.** `origin` no tenía refs publicadas. Se generó el scaffold de Tauri en una subcarpeta temporal y se copiaron sus archivos a la raíz, conservando `.git` en vez de reemplazar el clon.
- **El scaffold traía nombre, logos y saludo de ejemplo.** Se cambió el nombre a ScriptArc, se eliminó el comando de saludo y el plugin de apertura que no se usaba, y se preparó una pantalla inicial propia.
- **La primera edición de documentación esperaba texto distinto al README real del scaffold.** No se aplicó parcialmente. Se verificó el contenido presente y se reemplazó por los dos documentos solicitados: `README.md` y `audir.md`.
- **El plugin de sistema de archivos de Tauri exige permisos y scopes explícitos.** Se habilitaron únicamente lectura y escritura de texto; la app obtiene acceso a la ubicación elegida mediante los diálogos de abrir/guardar, sin dar acceso global a la carpeta del usuario.
- **El primer bloque de controles manuales dejó un fragmento duplicado al final de `App.vue`.** Vite notificó `Invalid end tag`; se quitó el fragmento residual y se volvió a comprobar lint, TypeScript, pruebas, build web y build de Tauri antes de publicar.
- **El directorio temporal `scriptarc-scaffold/` permanece en el disco y está ignorado por Git.** La política del entorno bloqueó su borrado recursivo. La raíz `E:\ScriptArc` es el único proyecto activo; no editar ni compilar el backup temporal. Se puede limpiar manualmente al terminar si se desea.

## Reglas para las siguientes features

- Antes de editar, revisar `git status` y conservar los cambios que ya existan.
- Ejecutar validaciones pertinentes, revisar el diff completo y hacer commits pequeños en inglés, con Conventional Commits en minúsculas.
- No introducir estilos remotos obligatorios: la aplicación debe ser usable sin red.
- Registrar aquí una decisión o una causa/solución cuando evite repetir un error concreto; no convertirlo en una bitácora de tareas rutinarias.
