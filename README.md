# ScriptArc

ScriptArc es un teleprompter de escritorio, ligero y configurable. Escribes un guion en Markdown, eliges lectura automática o manual y lo lees con una interfaz limpia que mantiene la atención en las palabras.

El proyecto está pensado para ser abierto y modificable. La aplicación guarda los guiones en el dispositivo y no requiere cuentas, nube ni servicios externos. El repositorio todavía no declara una licencia; se debe añadir una antes de redistribuir el código como software con licencia abierta.

## Tecnologías

- Vue 3 y TypeScript para la interfaz.
- Vite para desarrollo y compilación web.
- Tauri 2 y Rust para la aplicación de escritorio.
- pnpm para instalar dependencias y ejecutar tareas.
- Vitest para pruebas de utilidades.

## Uso

1. Abre ScriptArc y pega o escribe el guion en el editor.
2. Elige **Automático** para que la aplicación calcule el ritmo, o **Manual** para registrar tu ritmo al avanzar palabra por palabra.
3. Lee el texto en la pantalla del teleprompter. Usa las flechas para avanzar o retroceder y **Esc** para volver al editor.
4. Guarda o abre un proyecto local con extensión `.scriptarc` para continuar más tarde. En la app de escritorio se usa el selector nativo de archivos; la vista web permite abrir y descargar proyectos.
5. Selecciona un tema desde la configuración.

El editor conserva Markdown como texto fuente. Los encabezados y formatos en negrita, cursiva o tachado se interpretan para la lectura; no se pronuncian los símbolos Markdown.

## Ejecutar como desarrollador

Se necesita Node.js, pnpm y Rust con los requisitos de escritorio de Tauri para Windows.

```powershell
cd E:\ScriptArc
pnpm install
pnpm tauri dev
```

`pnpm dev` inicia solo la vista web de desarrollo.

## Editar y generar una versión

1. Edita los componentes y utilidades dentro de `src/`; Tauri y sus permisos se configuran en `src-tauri/`.
2. Comprueba los cambios:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

3. Genera la aplicación de escritorio:

```powershell
pnpm tauri build
```

El instalador y otros artefactos de Windows se generan en `src-tauri/target/release/bundle/`.
