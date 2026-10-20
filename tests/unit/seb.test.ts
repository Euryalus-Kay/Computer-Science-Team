import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildSebConfig, sebConfigKey, sebHash } from "@/lib/seb";
import { sebInfo } from "@/lib/lockdown";

describe("Safe Exam Browser", () => {
  const cfg = buildSebConfig({ startURL: "https://labcs.example/seb/launch?token=abc", quitURL: "https://labcs.example/seb/quit", quitPassword: "QX7K2M" });

  it("writes a gzipped plnd plist that SEB can open", () => {
    const raw = gunzipSync(cfg.file);
    expect(raw.subarray(0, 4).toString()).toBe("plnd");
    const xml = raw.subarray(4).toString();
    expect(xml).toContain("<key>startURL</key>");
    expect(xml).toContain("https://labcs.example/seb/launch?token=abc");
    expect(xml).toContain(createHash("sha256").update("QX7K2M").digest("hex"));
  });

  it("computes the config key from sorted settings without originatorVersion", () => {
    const key = sebConfigKey(cfg.dict);
    expect(key).toBe(cfg.configKey);
    expect(sebConfigKey({ ...cfg.dict, originatorVersion: "Other" })).toBe(key);
    expect(sebConfigKey({ ...cfg.dict, allowQuit: false })).not.toBe(key);
    // Insertion order doesn't matter.
    const reversed = Object.fromEntries(Object.entries(cfg.dict).reverse());
    expect(sebConfigKey(reversed)).toBe(key);
  });

  it("checks the config key hash a request carries", () => {
    const url = "https://labcs.example/api/attempts/a1/answer";
    const good = new Headers({ "user-agent": "Mozilla/5.0 SEB/3.8", "x-safeexambrowser-configkeyhash": sebHash(url, cfg.configKey) });
    const bad = new Headers({ "user-agent": "Mozilla/5.0 SEB/3.8", "x-safeexambrowser-configkeyhash": "0".repeat(64) });
    const noHash = new Headers({ "user-agent": "Mozilla/5.0 SEB/3.8" });
    const plain = new Headers({ "user-agent": "Mozilla/5.0 Chrome/141" });
    expect(sebInfo(good, url + "#x", cfg.configKey)).toEqual({ ok: true, verified: true });
    expect(sebInfo(bad, url, cfg.configKey).ok).toBe(false);
    expect(sebInfo(noHash, url, cfg.configKey)).toEqual({ ok: true, verified: false });
    expect(sebInfo(plain, url, cfg.configKey).ok).toBe(false);
  });
});
