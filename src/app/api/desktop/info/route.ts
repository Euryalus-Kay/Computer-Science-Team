import { getSettings } from "@/lib/settings";
import { DESKTOP_VERSION, downloadUrl } from "@/lib/desktop";

/** The desktop app checks this on start for updates and the site name. */
export async function GET() {
  const s = await getSettings().catch(() => null);
  return Response.json({
    siteName: s?.siteName ?? "Lab CS",
    latest: DESKTOP_VERSION,
    minVersion: s?.desktopMinVersion ?? "1.0.0",
    downloads: { mac: downloadUrl("mac"), windows: downloadUrl("windows") },
  });
}
