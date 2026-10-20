export type Severity = "info" | "low" | "medium" | "high";

export type ClientEvent = { type: string; at?: number; itemId?: string | null; data?: Record<string, unknown> };

export const EVENT_TYPES = new Set([
  "start",
  "resume",
  "visibility_hidden",
  "visibility_visible",
  "blur",
  "focus",
  "fullscreen_enter",
  "fullscreen_exit",
  "paste",
  "copy",
  "cut",
  "contextmenu",
  "devtools",
  "resize",
  "multi_screen",
  "reload",
  "unload",
  "shortcut",
  "idle",
  "print",
  "camera_on",
  "camera_off",
  "camera_denied",
  "camera_no_face",
  "camera_multi_face",
  "camera_look_away",
  "camera_phone",
  "desktop_blur",
  "desktop_focus",
  "desktop_display_change",
  "desktop_clipboard",
  "desktop_apps",
  "desktop_quit_attempt",
  "seb_detected",
  "tock_run",
  "submit",
]);

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Severity is decided here, never trusted from the browser. */
export function severityOf(e: ClientEvent): Severity {
  const d = e.data ?? {};
  switch (e.type) {
    case "visibility_visible":
    case "focus":
    case "desktop_focus": {
      const away = n(d.awayMs);
      if (away >= 20_000) return "high";
      if (away >= 5_000) return "medium";
      return away >= 1_500 ? "low" : "info";
    }
    case "visibility_hidden":
    case "desktop_blur":
      return "medium";
    case "blur":
      return "low";
    case "paste": {
      const c = n(d.chars);
      if (c >= 200) return "high";
      if (c >= 40) return "medium";
      return "low";
    }
    case "fullscreen_exit":
    case "devtools":
    case "multi_screen":
    case "desktop_display_change":
    case "camera_multi_face":
    case "camera_phone":
    case "desktop_clipboard":
      return "high";
    case "desktop_apps":
      return Array.isArray(d.apps) && d.apps.length ? "high" : "info";
    case "camera_no_face":
    case "camera_look_away":
    case "camera_denied":
    case "camera_off":
    case "desktop_quit_attempt":
    case "reload":
      return "medium";
    case "resize":
      return d.small ? "medium" : "info";
    case "copy":
    case "cut":
    case "contextmenu":
    case "shortcut":
    case "print":
      return "low";
    case "idle":
      return n(d.ms) >= 180_000 ? "low" : "info";
    default:
      return "info";
  }
}

export const EVENT_LABEL: Record<string, string> = {
  start: "Started",
  resume: "Opened the test again",
  visibility_hidden: "Left the tab",
  visibility_visible: "Came back to the tab",
  blur: "Switched to another window",
  focus: "Came back from another window",
  fullscreen_enter: "Entered full screen",
  fullscreen_exit: "Left full screen",
  paste: "Pasted text",
  copy: "Copied text",
  cut: "Cut text",
  contextmenu: "Right-clicked",
  devtools: "Developer tools likely open",
  resize: "Resized the window",
  multi_screen: "Second screen detected",
  reload: "Reloaded the page",
  unload: "Closed or left the page",
  shortcut: "Used a blocked shortcut",
  idle: "No activity",
  print: "Tried to print",
  camera_on: "Camera check on",
  camera_off: "Camera turned off",
  camera_denied: "Camera permission denied",
  camera_no_face: "No face in view",
  camera_multi_face: "More than one face in view",
  camera_look_away: "Looked away for a while",
  camera_phone: "Phone seen on camera",
  desktop_blur: "Switched away from the app",
  desktop_focus: "Returned to the app",
  desktop_display_change: "Display connected or removed",
  desktop_clipboard: "Clipboard changed outside the app",
  desktop_apps: "Flagged apps running",
  desktop_quit_attempt: "Tried to quit the app",
  seb_detected: "Safe Exam Browser verified",
  tock_run: "Ran Tock code",
  submit: "Submitted",
  playground_run: "Ran code in the Playground during the test",
  problem_run: "Ran a practice problem during the test",
  problem_submit: "Submitted a practice problem during the test",
  session_mismatch: "Lockdown session used outside the app",
  second_device: "Signed in from a second device",
  ip_change: "Network address changed",
};
