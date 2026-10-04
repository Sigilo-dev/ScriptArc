import type { Language } from "./types";

const UI_TEXT = {
  es: {
    settings: "Configuración", preferences: "Preferencias", customizeReading: "Personaliza tu lectura", closeSettings: "Cerrar configuración",
    theme: "Tema", interfaceLanguage: "Idioma de la interfaz", speakingLanguage: "Idioma automático predeterminado", spanish: "Español", english: "English",
    automaticPace: "Ritmo automático predeterminado", wordsPerMinute: "palabras/min", countdown: "Cuenta regresiva", noCountdown: "Sin cuenta regresiva",
    seconds: "segundos", hideControls: "Ocultar controles al dejar de mover el cursor", defaultFontSize: "Tamaño de letra predeterminado", pixels: "px",
    themeWhite: "Blanco", themeGray: "Gris", themeOrange: "Naranja", themeBlue: "Azul", themePink: "Rosa", themeBlack: "Negro",
    home: "ScriptArc inicio", brand: "ScriptArc", editorAria: "Editor de guion", prompter: "Teleprompter", eyebrow: "Tu próximo guion empieza aquí",
    startup: "Preparando ScriptArc…", unsavedProject: "Proyecto nuevo", projectPace: "Ritmo de este guion",
    writeClearly: "Escribe con claridad.", readConfidently: "Lee con confianza.", untitledScript: "Guion sin título", automatic: "Automático", manual: "Manual",
    newProject: "Nuevo", openProject: "Abrir proyecto", save: "Guardar", saveAs: "Guardar como…", numberLanguage: "Idioma para leer los números",
    start: "Empezar", editorHint: "Pega o escribe tu texto; tus palabras siempre se quedan contigo.", footer: "Hecho para que tus ideas fluyan.",
    editorButton: "← Editor", autoMode: "Modo automático", manualMode: "Modo manual", recording: "Grabando", preparingRecording: "Preparando grabación",
    startingSoon: "Comenzamos en", skip: "Saltar", skipCountdownWith: "Saltar con", emptyPrompter: "Vuelve al editor y coloca tu texto.",
    play: "Play", pause: "Pausa",
    elapsed: "Tiempo transcurrido", readingProgress: "Progreso de lectura", remaining: "Tiempo restante", advanceWord: "Avanzar palabra",
    retreatWord: "Retroceder", recordingReady: "Grabación lista para revisar o reproducir; RECORD vuelve a empezar.",
    startRecordingHint: "Pulsa RECORD y avanza con", restart: "Reiniciar", previousWord: "Palabra anterior", nextWord: "Siguiente palabra",
    decreaseFont: "Reducir tamaño de letra", increaseFont: "Aumentar tamaño de letra", fullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa",
    fullscreenShortcut: "Pantalla completa (Esc)", exitFullscreenShortcut: "Salir de pantalla completa (Esc)", record: "● RECORD", rerecord: "● REGRABAR",
    stopRecording: "■ DETENER", controls: "Controles del teleprompter", unsavedTitle: "Cambios sin guardar",
    unsavedDescription: "¿Quieres guardar los cambios de {name} antes de continuar?", cancel: "Cancelar", discard: "No guardar",
    saveNotice: "Proyecto guardado.", openNotice: "Proyecto abierto: {title}", restoreTitle: "Recuperar proyecto",
    restorePrompt: "Se encontró una sesión recuperable con cambios que no se guardaron. ¿Quieres restaurarla?",
    recoveryRestored: "Sesión recuperada. Guarda el proyecto para conservar los cambios.", recoveryUnavailable: "No se pudo guardar la recuperación local; guarda el proyecto para proteger tus cambios.",
    preferencesUnavailable: "No se pudieron guardar las preferencias en este dispositivo.", recoverySaveFailed: "No se pudo guardar la recuperación local; guarda el proyecto para proteger tus cambios.",
    manualTimingsDiscarded: "El texto cambió; se eliminaron los tiempos manuales para no asignarlos a otras palabras.",
    recordingStarted: "Grabando.",
    recordingDone: "Ritmo manual grabado. Puedes revisar, reproducir o volver a grabar.",
    recordingStopped: "Grabación detenida. Puedes revisar, editar o reproducir el ritmo registrado.",
    recordFirst: "Graba primero tu ritmo con el botón RECORD.",
    noProjectOpen: "No se pudo abrir el proyecto.", saveFailed: "No se pudo guardar el proyecto.", prepareFailed: "No se pudo preparar la sesión local.",
    invalidPrompterText: "Vuelve al editor y coloca tu texto.", fullscreenError: "El sistema no permitió cambiar a pantalla completa.",
    keyArrowRight: "Flecha derecha", keyArrowLeft: "Flecha izquierda", keySpace: "Barra espaciadora",
    markdownToolbar: "Formato Markdown", insertHeading: "Insertar título", heading: "Título", insertBold: "Insertar negrita", bold: "Negrita",
    insertItalic: "Insertar cursiva", italic: "Cursiva", insertStrike: "Insertar tachado", strikethrough: "Tachado",
    markdownText: "Texto en Markdown", scriptPlaceholder: "Coloca tu texto aquí...", settingsPanel: "Preferencias de lectura",
  },
  en: {
    settings: "Settings", preferences: "Preferences", customizeReading: "Customize your reading", closeSettings: "Close settings",
    theme: "Theme", interfaceLanguage: "Interface language", speakingLanguage: "Default number language", spanish: "Español", english: "English",
    automaticPace: "Default automatic pace", wordsPerMinute: "words/min", countdown: "Countdown", noCountdown: "No countdown",
    seconds: "seconds", hideControls: "Hide controls when the pointer stops moving", defaultFontSize: "Default text size", pixels: "px",
    themeWhite: "White", themeGray: "Gray", themeOrange: "Orange", themeBlue: "Blue", themePink: "Pink", themeBlack: "Pure black",
    home: "ScriptArc home", brand: "ScriptArc", editorAria: "Script editor", prompter: "Teleprompter", eyebrow: "Your next script starts here",
    startup: "Preparing ScriptArc…", unsavedProject: "New project", projectPace: "Pace for this script",
    writeClearly: "Write with clarity.", readConfidently: "Read with confidence.", untitledScript: "Untitled script", automatic: "Automatic", manual: "Manual",
    newProject: "New", openProject: "Open project", save: "Save", saveAs: "Save as…", numberLanguage: "Language for reading numbers",
    start: "Start", editorHint: "Paste or write your text; your words stay yours.", footer: "Made for your ideas to flow.",
    editorButton: "← Editor", autoMode: "Automatic mode", manualMode: "Manual mode", recording: "Recording", preparingRecording: "Getting ready to record",
    startingSoon: "Starting in", skip: "Skip", skipCountdownWith: "Skip with", emptyPrompter: "Return to the editor and add your text.",
    play: "Play", pause: "Pause",
    elapsed: "Elapsed time", readingProgress: "Reading progress", remaining: "Time remaining", advanceWord: "Advance word",
    retreatWord: "Go back", recordingReady: "Recording ready to review or play; RECORD starts again.",
    startRecordingHint: "Press RECORD, then advance with", restart: "Restart", previousWord: "Previous word", nextWord: "Next word",
    decreaseFont: "Decrease text size", increaseFont: "Increase text size", fullscreen: "Fullscreen", exitFullscreen: "Exit fullscreen",
    fullscreenShortcut: "Fullscreen (Esc)", exitFullscreenShortcut: "Exit fullscreen (Esc)", record: "● RECORD", rerecord: "● RECORD AGAIN",
    stopRecording: "■ STOP", controls: "Teleprompter controls", unsavedTitle: "Unsaved changes",
    unsavedDescription: "Would you like to save changes to {name} before continuing?", cancel: "Cancel", discard: "Discard",
    saveNotice: "Project saved.", openNotice: "Project opened: {title}", restoreTitle: "Restore project",
    restorePrompt: "A recoverable session with unsaved changes was found. Would you like to restore it?",
    recoveryRestored: "Session restored. Save the project to keep the changes.", recoveryUnavailable: "Could not save local recovery; save the project to protect your changes.",
    preferencesUnavailable: "Could not save preferences on this device.", recoverySaveFailed: "Could not save local recovery; save the project to protect your changes.",
    manualTimingsDiscarded: "The text changed; manual timings were cleared so they are not assigned to different words.",
    recordingStarted: "Recording.",
    recordingDone: "Manual pace recorded. You can review, play, or record again.",
    recordingStopped: "Recording stopped. You can review, edit, or play the saved pace.",
    recordFirst: "Record your pace first with the RECORD button.",
    noProjectOpen: "Could not open the project.", saveFailed: "Could not save the project.", prepareFailed: "Could not prepare the local session.",
    invalidPrompterText: "Return to the editor and add your text.", fullscreenError: "The system could not enter fullscreen.",
    keyArrowRight: "Right arrow", keyArrowLeft: "Left arrow", keySpace: "Space bar",
    markdownToolbar: "Markdown formatting", insertHeading: "Insert heading", heading: "Heading", insertBold: "Insert bold", bold: "Bold",
    insertItalic: "Insert italic", italic: "Italic", insertStrike: "Insert strikethrough", strikethrough: "Strikethrough",
    markdownText: "Markdown text", scriptPlaceholder: "Place your text here...", settingsPanel: "Reading preferences",
  },
} as const satisfies Record<Language, Record<string, string>>;

export type UiTextKey = keyof typeof UI_TEXT.es;

export function translate(language: Language, key: UiTextKey, values: Record<string, string | number> = {}): string {
  let result: string = UI_TEXT[language][key];
  for (const [name, value] of Object.entries(values)) result = result.split(`{${name}}`).join(String(value));
  return result;
}

const PROJECT_ERROR_TRANSLATIONS: Record<string, string> = {
  "El archivo no contiene un proyecto ScriptArc válido.": "This file does not contain a valid ScriptArc project.",
  "El proyecto debe ser un objeto JSON.": "The project must be a JSON object.",
  "El proyecto antiguo no incluye Markdown válido.": "The older project does not contain valid Markdown.",
  "El proyecto de versión 1 no contiene sus campos principales.": "The version 1 project is missing required fields.",
  "El proyecto no contiene sus campos principales.": "The project is missing required fields.",
  "El proyecto tiene fechas no válidas.": "The project dates are invalid.",
  "El proyecto contiene fechas mal formadas.": "The project contains malformed dates.",
  "La configuración del proyecto no es válida.": "The project settings are invalid.",
  "Los tiempos manuales del proyecto no son válidos.": "The project's manual timings are invalid.",
  "Los tiempos manuales tienen índices duplicados o fuera de rango.": "Manual timings contain duplicate or out-of-range indexes.",
  "La posición guardada no coincide con las palabras del guion.": "The saved reading position does not match the script words.",
  "Los tiempos manuales no coinciden con las palabras del guion.": "Manual timings do not match the script words.",
  "El idioma automático del proyecto no es válido.": "The project's automatic language is invalid.",
  "Los valores de ritmo y presentación deben ser positivos.": "Pacing and display settings must be positive.",
  "Los valores de configuración deben ser números finitos.": "Settings must contain finite numbers.",
  "El proyecto tiene tiempos manuales que no coinciden con las palabras actuales. El archivo no se abrió.": "The project's manual timings do not match the current script words. The file was not opened.",
};

export function translateErrorMessage(message: string, language: Language): string {
  if (language === "es") return message;
  const futureVersion = /Este proyecto fue creado con una versión futura incompatible \((\d+)\)\. Actualiza ScriptArc para abrirlo\./u.exec(message);
  if (futureVersion) return `This project uses an incompatible future format version (${futureVersion[1]}). Update ScriptArc to open it.`;
  const unsupportedVersion = /^La versión del proyecto no está soportada: (.+)\.$/u.exec(message);
  if (unsupportedVersion) return `Unsupported project format version: ${unsupportedVersion[1]}.`;
  return PROJECT_ERROR_TRANSLATIONS[message] ?? message;
}
