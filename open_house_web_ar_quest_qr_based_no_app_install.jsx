import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Open House Web AR Quest
 * ---------------------------------------------------------------
 * What this is:
 *  - A single-page web app that runs in the browser (no login, no app install)
 *  - Uses the device camera to scan QR codes placed around your school
 *  - Each valid scan checks off an objective on the quest list
 *  - When all objectives are complete, a prize screen appears for staff to verify
 *
 * How to deploy:
 *  - Drop this component into a React app (Vite/Next/Create React App)
 *  - Serve over HTTPS (required for camera access on mobile)
 *  - Edit STATIONS below and print matching QR codes for each station
 *
 * QR code content format:
 *  - Default expects a string like:  OPENHOUSE:STATION_ID
 *    e.g. OPENHOUSE:LIBRARY or OPENHOUSE:SCI-LAB
 *  - You can change the validator in validatePayload()
 *
 * Printing QR codes:
 *  - Use any QR generator to encode the exact text values you set in STATIONS[].code
 *  - Make them at least 8–10 cm across for easy scanning on mobile
 *
 * Anti-cheat notes:
 *  - This is a lightweight, offline-friendly experience. For more robust validation,
 *    host codes that resolve to short-lived signed URLs and verify server-side.
 */

// 1) Configure your quest stops here
const STATIONS: { id: string; name: string; code: string; hint?: string }[] = [
  { id: "ENTRANCE", name: "Main Entrance", code: "OPENHOUSE:ENTRANCE", hint: "Start here" },
  { id: "LIBRARY", name: "School Library", code: "OPENHOUSE:LIBRARY", hint: "Find the quiet thinkers" },
  { id: "GYM", name: "Gymnasium", code: "OPENHOUSE:GYM", hint: "Where the action happens" },
  { id: "SCI-LAB", name: "Science Lab", code: "OPENHOUSE:SCI-LAB", hint: "Bubbling beakers ahead" },
  { id: "ART", name: "Art Studio", code: "OPENHOUSE:ART", hint: "Color and canvas" },
  { id: "COUNSEL", name: "Student Services", code: "OPENHOUSE:COUNSEL", hint: "Future planning" },
];

// 2) LocalStorage keys
const LS_KEY_PROGRESS = "ohq_progress_v1";
const LS_KEY_COMPLETED = "ohq_completed_v1";

// 3) Optional: restrict accepted barcode formats (we use QR only by default)
const BARCODE_FORMATS = ["qr_code"]; // BarcodeDetector format strings

// Types
type ScanBox = { x: number; y: number; width: number; height: number } | null;

export default function OpenHouseAR() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [box, setBox] = useState<ScanBox>(null);
  const [justScanned, setJustScanned] = useState<string | null>(null);
  const [usingDetector, setUsingDetector] = useState<boolean>(false);
  const [completeAt, setCompleteAt] = useState<number | null>(() => {
    const saved = localStorage.getItem(LS_KEY_COMPLETED);
    return saved ? Number(saved) : null;
  });

  // Progress state (a map of station.id -> boolean)
  const [progress, setProgress] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(LS_KEY_PROGRESS);
    if (saved) return JSON.parse(saved);
    const init: Record<string, boolean> = {};
    STATIONS.forEach((s) => (init[s.id] = false));
    return init;
  });

  const completedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress]
  );
  const allDone = completedCount === STATIONS.length;

  // Initialize camera + scanner
  useEffect(() => {
    let stop = false;
    let zxingReader: any = null;

    async function startCamera() {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setGranted(true);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            "Camera access failed. Please allow camera permissions and reload."
        );
        setGranted(false);
      }
    }

    async function loopBarcodeDetector() {
      if (!videoRef.current) return;
      const video = videoRef.current;
      // @ts-ignore
      const hasDetector = typeof window !== "undefined" && window.BarcodeDetector;

      if (!hasDetector) return;
      // @ts-ignore
      const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      setUsingDetector(true);

      const tick = async () => {
        if (stop || !active) return;
        try {
          if (video.readyState >= 2) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0) {
              const best = barcodes[0];
              const raw = best.rawValue || "";
              const box = best.boundingBox
                ? {
                    x: best.boundingBox.x,
                    y: best.boundingBox.y,
                    width: best.boundingBox.width,
                    height: best.boundingBox.height,
                  }
                : null;
              if (raw) onDetected(raw, box);
            }
          }
        } catch (e) {
          // Some browsers throw if detector saturated; ignore and continue
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    async function loopZXing() {
      // Fallback using @zxing/browser (dynamic import to keep bundle small)
      try {
        const { BrowserMultiFormatReader } = await import(
          /* webpackChunkName: "zxing" */ "@zxing/browser"
        );
        zxingReader = new BrowserMultiFormatReader();
        const tick = async () => {
          if (stop || !active) return;
          try {
            const result = await zxingReader.decodeOnceFromVideoElement(
              videoRef.current as HTMLVideoElement
            );
            if (result?.getText) {
              onDetected(result.getText(), null);
            }
          } catch (e) {
            // Ignore timeouts/errors, keep trying
          }
          setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        setError("Scanner library failed to load. Try a newer browser.");
      }
    }

    startCamera().then(() => {
      // Prefer native BarcodeDetector if available; fallback to ZXing
      // @ts-ignore
      if (typeof window !== "undefined" && window.BarcodeDetector) {
        loopBarcodeDetector();
      } else {
        setUsingDetector(false);
        loopZXing();
      }
    });

    return () => {
      stop = true;
      if (zxingReader?.reset) zxingReader.reset();
      const stream = (videoRef.current?.srcObject as MediaStream) || null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  // Draw bounding box overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let raf = 0;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      if (!ctx || !video) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (box) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#22c55e"; // green
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [box]);

  function onDetected(payload: string, rect: ScanBox) {
    setLastPayload(payload);
    if (rect) setBox(rect);

    const match = validatePayload(payload);
    if (!match) return;

    const id = match.id;
    if (!progress[id]) {
      const updated = { ...progress, [id]: true };
      setProgress(updated);
      localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify(updated));
      // Confetti ping
      setJustScanned(id);
      setTimeout(() => setJustScanned(null), 1500);

      // Completion time capture
      const done = Object.values(updated).every(Boolean);
      if (done && !completeAt) {
        const now = Date.now();
        setCompleteAt(now);
        localStorage.setItem(LS_KEY_COMPLETED, String(now));
      }
    }
  }

  function validatePayload(payload: string): { id: string } | null {
    // Accept exact matches of STATIONS[].code (e.g., "OPENHOUSE:LIBRARY")
    const station = STATIONS.find((s) => s.code.trim() === payload.trim());
    return station ? { id: station.id } : null;
  }

  function resetProgress() {
    const cleared: Record<string, boolean> = {};
    STATIONS.forEach((s) => (cleared[s.id] = false));
    setProgress(cleared);
    setCompleteAt(null);
    localStorage.removeItem(LS_KEY_PROGRESS);
    localStorage.removeItem(LS_KEY_COMPLETED);
    setJustScanned(null);
  }

  // Simple completion token (human-readable). For stronger verification,
  // mint server-side tokens.
  const completionToken = useMemo(() => {
    if (!completeAt) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date(completeAt);
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const ids = STATIONS.map((s) => s.id[0]).join("");
    // weak checksum
    const check = (Array.from(ids + stamp).reduce((a, c) => a + c.charCodeAt(0), 0) % 997).toString(36).toUpperCase();
    return `OHQ-${check}-${d.getTime().toString(36).toUpperCase()}`;
  }, [completeAt]);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 backdrop-blur bg-zinc-900/70 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-400 text-black font-bold">AR</span>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Open House AR Quest</h1>
              <p className="text-xs text-zinc-400">No login • No app install • Scan QR codes to complete the trail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActive((a) => !a)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
            >
              {active ? "Pause Camera" : "Resume Camera"}
            </button>
            <button
              onClick={resetProgress}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Camera + overlay */}
      <section className="relative max-w-5xl mx-auto px-4 pt-4">
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${active ? "opacity-100" : "opacity-40"}`}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Scan hint */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-300">
            <span>
              {granted === false && "Camera blocked. Allow access in browser settings."}
              {granted && (usingDetector ? "Scanning (native detector)…" : "Scanning (ZXing)…")}
              {!granted && granted !== false && "Requesting camera…"}
            </span>
            {lastPayload && (
              <span className="truncate max-w-[50%] text-zinc-400">Last: {lastPayload}</span>
            )}
          </div>

          {/* Confetti ping */}
          <AnimatePresence>
            {justScanned && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/10" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold shadow">
                  Scanned: {STATIONS.find((s) => s.id === justScanned)?.name}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="mt-2 text-amber-400 text-sm">{error}</p>
        )}
      </section>

      {/* Progress */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Quest</h2>
          <div className="text-sm text-zinc-400">
            {completedCount}/{STATIONS.length} completed
          </div>
        </div>

        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-lime-400"
            style={{ width: `${(completedCount / STATIONS.length) * 100}%` }}
          />
        </div>

        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STATIONS.map((s) => (
            <li
              key={s.id}
              className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex items-start gap-3"
            >
              <div
                className={`h-6 w-6 rounded-full mt-0.5 flex items-center justify-center text-xs font-bold ${
                  progress[s.id]
                    ? "bg-emerald-400 text-black"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {progress[s.id] ? "✓" : ""}
              </div>
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                {s.hint && (
                  <div className="text-xs text-zinc-400 mt-0.5">Hint: {s.hint}</div>
                )}
                <div className="text-[10px] text-zinc-500 mt-1 select-all">Code: {s.code}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Demo helper for testing without printed codes */}
        <details className="mt-4 text-sm text-zinc-400">
          <summary className="cursor-pointer">Testing: simulate a scan (for organisers)</summary>
          <div className="mt-2 flex gap-2 flex-wrap">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onDetected(s.code, null)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              >
                Scan {s.id}
              </button>
            ))}
          </div>
        </details>
      </section>

      {/* Completion screen */}
      <AnimatePresence>
        {allDone && (
          <motion.section
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40"
          >
            <div className="max-w-5xl mx-auto px-4 pb-6">
              <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-400 text-black font-bold flex items-center justify-center">✓</div>
                  <div className="flex-1">
                    <div className="font-semibold">Quest Complete!</div>
                    <div className="text-sm text-emerald-200/80">
                      Show this to a staff member to collect your prize.
                    </div>
                  </div>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="px-3 py-1.5 rounded-xl bg-emerald-400 text-black font-semibold"
                  >
                    Back to top
                  </button>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <div className="text-zinc-400">Finished at</div>
                    <div className="text-white text-lg font-mono">
                      {new Date(completeAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <div className="text-zinc-400">Completion code</div>
                    <div className="text-white text-lg font-mono select-all">{completionToken}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <footer className="max-w-5xl mx-auto px-4 py-10 text-xs text-zinc-500">
        <p>
          Tip: If scanning is slow, add more light or bring the camera closer to the QR code.
          This app prefers the rear camera and works best over HTTPS.
        </p>
      </footer>
    </div>
  );
}
