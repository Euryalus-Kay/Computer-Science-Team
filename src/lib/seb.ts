import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

type SebValue = string | boolean | number;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function plist(dict: Record<string, SebValue>): string {
  const body = Object.entries(dict)
    .map(([k, v]) => {
      const val = typeof v === "boolean" ? (v ? "<true/>" : "<false/>") : typeof v === "number" ? `<integer>${v}</integer>` : `<string>${esc(v)}</string>`;
      return `\t<key>${esc(k)}</key>\n\t${val}`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n`;
}

/**
 * SEB's Config Key: SHA-256 of the settings as compact JSON, keys sorted, no
 * escaping, originatorVersion left out (matches SEB's DataProcessor/Json code).
 */
export function sebConfigKey(dict: Record<string, SebValue>): string {
  const keys = Object.keys(dict)
    .filter((k) => k.toLowerCase() !== "originatorversion")
    .sort((a, b) => a.localeCompare(b, "en"));
  const json = "{" + keys.map((k) => `"${k}":${typeof dict[k] === "string" ? `"${dict[k]}"` : String(dict[k])}`).join(",") + "}";
  return createHash("sha256").update(json, "utf8").digest("hex");
}

export function sebHash(url: string, configKey: string): string {
  return createHash("sha256").update(url.split("#")[0] + configKey, "utf8").digest("hex");
}

export function buildSebConfig(opts: { startURL: string; quitURL: string; quitPassword: string }) {
  const dict: Record<string, SebValue> = {
    originatorVersion: "LabCS_1.0",
    startURL: opts.startURL,
    quitURL: opts.quitURL,
    quitURLConfirm: false,
    sendBrowserExamKey: true,
    browserViewMode: 1,
    allowQuit: true,
    hashedQuitPassword: createHash("sha256").update(opts.quitPassword, "utf8").digest("hex"),
    examSessionClearCookiesOnStart: true,
    configPurpose: 0,
    allowSpellCheck: false,
    allowDictionaryLookup: false,
    showReloadButton: true,
    browserWindowAllowReload: true,
  };
  const xml = plist(dict);
  const file = gzipSync(Buffer.concat([Buffer.from("plnd", "utf8"), Buffer.from(xml, "utf8")]));
  return { dict, xml, file, configKey: sebConfigKey(dict) };
}
