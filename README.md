# ScriptArc

Free and open-source desktop teleprompter with automatic word-level pacing, manual timing recording, Markdown scripts and configurable themes.

## Download for Windows

**You do not need to compile ScriptArc to use it.** Go to [Latest Release](https://github.com/Sigilo-dev/ScriptArc/releases/latest) and choose either:

- **Portable:** download `ScriptArc-vX.Y.Z-windows-x64-portable.zip`, extract it, open the `ScriptArc` folder and run `ScriptArc.exe`.
- **Setup:** download `ScriptArc-vX.Y.Z-windows-x64-setup.exe` for the standard Windows installation experience.

The portable app needs no developer tools. Both options use the Microsoft Edge WebView2 runtime. Windows 10 version 1803 and later and Windows 11 normally include it; the setup installer downloads the WebView2 bootstrapper if it is missing, so an internet connection may be needed during installation.

The portable ZIP contains the runnable application and its license/readme. It is **not** the source-code ZIP attached automatically by GitHub.

## What it includes

- Automatic word-level pacing in Spanish and English, including number-aware spoken timing.
- Interface available in Spanish and English, switchable from the first screen.
- Manual timing recording and playback controls.
- Markdown scripts with headings, emphasis, links and punctuation-aware word steps.
- Versioned `.scriptarc` project files, local recovery, six preset themes and a fully customizable saved palette.
- Fullscreen reading, adjustable text size and keyboard controls.
- Windows desktop app, portable release ZIP and standard setup installer.

## Built with

Vue 3 and TypeScript power the interface, Vite builds the frontend, Tauri 2 and Rust provide the Windows desktop shell, and pnpm manages dependencies. Vitest runs the unit tests.

## Use ScriptArc

1. Paste or write a Markdown script in the editor. Change the interface language at any time with **ES / EN** in the top bar.
2. Choose **Automatic** for generated timing or **Manual** to record your pace. In manual mode, read the highlighted word and press **→** or **Space** when you finish each word; stop to review the recorded timings.
3. In the teleprompter, use **Space** to play/pause, **← / →** to move by word, **Home / End** to seek, and **Esc** to leave fullscreen. Press **Esc** again to return to the editor.
4. Use **Save**, **Save as…** or **Open project** to continue later from a `.scriptarc` file. The project stores reading position and timings; changes are recovered locally if the app closes unexpectedly.
5. Open settings to choose the interface and number languages, customize all theme colors, set speed and text size, and adjust the countdown and control visibility. Preferences are saved locally.

## Develop and build

On Windows, install Node.js, pnpm, Rust, Microsoft C++ Build Tools and the WebView2 runtime. Then:

```powershell
git clone https://github.com/Sigilo-dev/ScriptArc.git
cd ScriptArc
pnpm install
pnpm tauri dev
```

Edit the Vue/TypeScript files under `src/` and desktop configuration under `src-tauri/`. Editing source code does not change an existing executable; build a new one from that source:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm tauri build --bundles nsis
```

The setup installer is written to `src-tauri/target/release/bundle/nsis/`. Run `scripts\build-portable.bat` to build and package a local portable ZIP under `dist-release/`. `scripts\dev.bat` is a convenience launcher for developers; it is not the application.

To publish a version, update the matching version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, validate with `pnpm check:version`, then push the tag:

```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
```

GitHub Actions validates the tag and creates the setup installer and portable ZIP in a GitHub Release. Normal pushes and pull requests run CI but do not publish a release.

The main code lives in `src/`, grouped by editor, teleprompter, project and settings features. Tauri configuration, Rust entry points and app icons live in `src-tauri/`; packaging and version scripts live in `scripts/`.

## License

ScriptArc is free and open source under the [MIT License](LICENSE).
