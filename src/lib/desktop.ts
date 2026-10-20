export const DESKTOP_VERSION = "1.0.0";

export function releaseRepo() {
  return process.env.DESKTOP_RELEASE_REPO || "Euryalus-Kay/Computer-Science-Team";
}

export const ASSETS = {
  mac: "LabCS-mac.dmg",
  "mac-zip": "LabCS-mac.zip",
  windows: "LabCS-windows-setup.exe",
  "windows-zip": "LabCS-windows.zip",
  linux: "LabCS-linux.AppImage",
} as const;

/** DESKTOP_DOWNLOAD_BASE serves the installers from somewhere other than GitHub releases. */
export function downloadUrl(asset: keyof typeof ASSETS) {
  const base = process.env.DESKTOP_DOWNLOAD_BASE?.replace(/\/+$/, "");
  if (base) return `${base}/${ASSETS[asset]}`;
  return `https://github.com/${releaseRepo()}/releases/latest/download/${ASSETS[asset]}`;
}
