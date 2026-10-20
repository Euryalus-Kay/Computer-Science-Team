"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const OBJECT_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";

type Status = "starting" | "on" | "denied" | "error";

/**
 * On-device camera check. Face and phone detection run in the browser with
 * MediaPipe; no image or video ever leaves the computer. Only alerts are reported.
 */
export function CameraMonitor({ onEvent }: { onEvent: (type: string, data?: Record<string, unknown>) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [face, setFace] = useState<"ok" | "none" | "many" | "away">("ok");
  const [collapsed, setCollapsed] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const last: Record<string, number> = {};
    const since: Record<string, number | null> = { none: null, many: null, away: null };
    let phoneHits = 0;
    const report = (type: string, data?: Record<string, unknown>) => {
      const t = Date.now();
      if (t - (last[type] ?? 0) < 20_000) return;
      last[type] = t;
      cb.current(type, data);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
      } catch {
        if (!stopped) {
          setStatus("denied");
          cb.current("camera_denied");
        }
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setStatus("error");
        cb.current("camera_off");
      });
      try {
        const { FilesetResolver, FaceDetector, ObjectDetector } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(WASM);
        const faces = await FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: FACE_MODEL },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.55,
        });
        const objects = await ObjectDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: OBJECT_MODEL },
          runningMode: "VIDEO",
          scoreThreshold: 0.45,
          categoryAllowlist: ["cell phone"],
        }).catch(() => null);
        if (stopped) return;
        setStatus("on");
        cb.current("camera_on");
        let tick = 0;
        timer = setInterval(() => {
          const v = video.current;
          if (!v || v.readyState < 2 || document.hidden) return;
          const now = performance.now();
          const res = faces.detectForVideo(v, now);
          const n = res.detections.length;
          let state: "ok" | "none" | "many" | "away" = n === 0 ? "none" : n > 1 ? "many" : "ok";
          if (n === 1) {
            const k = res.detections[0].keypoints;
            // keypoints: right eye, left eye, nose tip, mouth, right ear, left ear
            if (k.length >= 3) {
              const midX = (k[0].x + k[1].x) / 2;
              const eye = Math.abs(k[1].x - k[0].x) || 0.001;
              if (Math.abs(k[2].x - midX) / eye > 0.42) state = "away";
            }
          }
          setFace(state);
          const t = Date.now();
          for (const key of ["none", "many", "away"] as const) {
            if (state === key) since[key] ??= t;
            else since[key] = null;
          }
          if (since.none && t - since.none > 4000) report("camera_no_face", { ms: t - since.none });
          if (since.many && t - since.many > 1500) report("camera_multi_face", { faces: n });
          if (since.away && t - since.away > 5000) report("camera_look_away", { ms: t - since.away });
          if (objects && tick++ % 3 === 0) {
            const o = objects.detectForVideo(v, now + 1);
            phoneHits = o.detections.length ? phoneHits + 1 : 0;
            if (phoneHits >= 2) report("camera_phone", { score: Math.round((o.detections[0]?.categories[0]?.score ?? 0) * 100) });
          }
        }, 650);
      } catch {
        if (!stopped) {
          setStatus("error");
          cb.current("camera_off", { reason: "model" });
        }
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const label =
    status === "denied"
      ? "Camera blocked"
      : status === "error"
        ? "Camera off"
        : status === "starting"
          ? "Starting camera"
          : face === "none"
            ? "No face in view"
            : face === "many"
              ? "More than one face"
              : face === "away"
                ? "Face the screen"
                : "Camera check on";
  const ok = status === "on" && face === "ok";
  return (
    <div className="fixed right-4 bottom-4 z-40 w-[176px] overflow-hidden rounded-xl border border-line bg-panel shadow-pop">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          {status === "denied" || status === "error" ? <VideoOff className="size-3.5 text-red" /> : <Video className="size-3.5 text-ink-3" />}
          <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-accent" : status === "starting" ? "bg-ink-4" : "bg-amber")} />
          <span className="truncate">{label}</span>
        </span>
        <button onClick={() => setCollapsed((c) => !c)} className="text-ink-4 hover:text-ink" aria-label={collapsed ? "Show camera" : "Hide camera"}>
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>
      <video ref={video} muted playsInline className={cn("w-full -scale-x-100 bg-black", collapsed ? "h-0" : "aspect-[4/3]")} />
      {!collapsed && <div className="px-2.5 py-1.5 text-[10.5px] leading-tight text-ink-4">Video stays on this computer. Only alerts are saved.</div>}
    </div>
  );
}
