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

export function downloadUrl(asset: keyof typeof ASSETS) {
  return `https://github.com/${releaseRepo()}/releases/latest/download/${ASSETS[asset]}`;
}
