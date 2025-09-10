import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------
// Configure quest stops here
// ---------------------------
/*
const STATIONS = [
  { id: "ENTRANCE", name: "Main Entrance", code: "OPENHOUSE:ENTRANCE", hint: "Start here" },
  { id: "LIBRARY", name: "School Library", code: "OPENHOUSE:LIBRARY", hint: "Find the quiet thinkers" },
  { id: "GYM", name: "Gymnasium", code: "OPENHOUSE:GYM", hint: "Where the action happens" },
  { id: "SCI-LAB", name: "Science Lab", code: "OPENHOUSE:SCI-LAB", hint: "Bubbling beakers ahead" },
  { id: "ART", name: "Art Studio", code: "OPENHOUSE:ART", hint: "Color and canvas" },
  { id: "COUNSEL", name: "Student Services", code: "OPENHOUSE:COUNSEL", hint: "Future planning" },
];
*/
const STATIONS = [
  { id: "ENTRANCE", name: "Main Entrance", code: "OPENHOUSE:ENTRANCE", hint: "Start here" },
  { id: "LIBRARY", name: "School Library", code: "OPENHOUSE:LIBRARY", hint: "Find the quiet thinkers" },
  { id: "GYM", name: "Gymnasium", code: "OPENHOUSE:GYM", hint: "Where the action happens" },
];

// ---------------------------
// LocalStorage keys
// ---------------------------
const LS_KEY_PROGRESS = "ohq_progress_v1";
const LS_KEY_COMPLETED = "ohq_completed_v1";

// ---------------------------
// Optional barcode formats
// ---------------------------
const BARCODE_FORMATS = ["qr_code"];

// ---------------------------
// Main Component
// ---------------------------
export default function OpenHouseAR() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [granted, setGranted] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(true);
  const [lastPayload, setLastPayload] = useState(null);
  const [box, setBox] = useState(null);
  const [justScanned, setJustScanned] = useState(null);
  const [usingDetector, setUsingDetector] = useState(false);
  const [completeAt, setCompleteAt] = useState(() => {
    const saved = localStorage.getItem(LS_KEY_COMPLETED);
    return saved ? Number(saved) : null;
  });

  // Progress state (station.id -> boolean)
  let [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem(LS_KEY_PROGRESS);
    if (saved) return JSON.parse(saved);
    const init = {};
    STATIONS.forEach((s) => (init[s.id] = false));
    return init;
  });

  const completedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress]
  );
  const allDone = completedCount === STATIONS.length;

  // ---------------------------
  // Camera + Scanner initialization
  // ---------------------------
  useEffect(() => {
    let stop = false;
    let zxingReader = null;

    async function startCamera() {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 1280, height: 720 },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setGranted(true);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Camera access failed. Allow permissions and reload.");
        setGranted(false);
      }
    }

    // Use native BarcodeDetector if available
    async function loopBarcodeDetector() {
      if (!videoRef.current) return;
      const hasDetector = typeof window !== "undefined" && window.BarcodeDetector;
      if (!hasDetector) return;
      const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      setUsingDetector(true);

      const tick = async () => {
        if (stop || !active) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0].rawValue || "";
              const rect = barcodes[0].boundingBox || null;
              onDetected(raw, rect);
            }
          }
        } catch (e) {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // Fallback using ZXing
    async function loopZXing() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        zxingReader = new BrowserMultiFormatReader();
        const tick = async () => {
          if (stop || !active) return;
          try {
            const result = await zxingReader.decodeOnceFromVideoElement(videoRef.current);
            if (result?.getText) onDetected(result.getText(), null);
          } catch (e) {}
          setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        setError("Scanner library failed to load. Try a newer browser.");
      }
    }

    startCamera().then(() => {
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
      const stream = videoRef.current?.srcObject;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  // ---------------------------
  // Draw bounding box overlay
  // ---------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    let raf = 0;

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

    draw();
    return () => cancelAnimationFrame(raf);
  }, [box]);

  // ---------------------------
  // Handle QR code detection
  // ---------------------------
  function onDetected(payload, rect) {
    setLastPayload(payload);
    if (rect) setBox(rect);

    const match = validatePayload(payload);
    if (!match) return;

    const id = match.id;
    if (!progress[id]) {
      const updated = { ...progress, [id]: true };
      //setProgress(updated);
      markStationAsComplete(id, setProgress);
      console.log("progress:", progress, "updated:", updated);
      //localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify(progress));

      // Tiny confetti effect
      setJustScanned(id);
      setTimeout(() => setJustScanned(null), 1500);

      const done = Object.values(updated).every(Boolean);
      if (done && !completeAt) {
        const now = Date.now();
        setCompleteAt(now);
        localStorage.setItem(LS_KEY_COMPLETED, String(now));
      }
    }
  }

  // ---------------------------
  // Validate QR code payload
  // ---------------------------
  function validatePayload(payload) {
    if (!payload) return null;
    const normalized = payload.replace(/\\:/g, ":").trim(); // handle escaped colon
    const station = STATIONS.find(
      (s) => s.code.trim().toUpperCase() === normalized.toUpperCase()
    );
    return station ? { id: station.id } : null;
  }

  function markStationAsComplete(stationId, setProgress) {
    setProgress(prev => {
      // create a new object by copying the previous state
      const updated = { 
        ...prev, 
        [stationId]: true  // mark this station as complete
      };

      // persist to localStorage
      localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify(updated));

      return updated; // return the new state
    });
  }


  // ---------------------------
  // Reset progress
  // ---------------------------
  function resetProgress() {
    const cleared = {};
    STATIONS.forEach((s) => (cleared[s.id] = false));
    setProgress(cleared);
    setCompleteAt(null);
    localStorage.removeItem(LS_KEY_PROGRESS);
    localStorage.removeItem(LS_KEY_COMPLETED);
    setJustScanned(null);
  }

  // ---------------------------
  // Completion token
  // ---------------------------
  const completionToken = useMemo(() => {
    if (!completeAt) return "";
    const pad = (n) => n.toString().padStart(2, "0");
    const d = new Date(completeAt);
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const ids = STATIONS.map((s) => s.id[0]).join("");
    const check = (Array.from(ids + stamp).reduce((a, c) => a + c.charCodeAt(0), 0) % 997)
      .toString(36)
      .toUpperCase();
    return `OHQ-${check}-${d.getTime().toString(36).toUpperCase()}`;
  }, [completeAt]);

  // ---------------------------
  // JSX Rendering
  // ---------------------------
  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">Open House AR Quest</h1>

      {/* Camera feed with overlay */}
      <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden border border-zinc-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      {/* Progress list */}
      <ul className="space-y-2 max-w-md mx-auto">
        {STATIONS.map((s) => (
          <li
            key={s.id}
            className={`p-2 rounded-lg flex justify-between items-center ${
              progress[s.id] ? "bg-green-600" : "bg-zinc-800"
            }`}
          >
            <span>{s.name}</span>
            {progress[s.id] && <span>✅</span>}
          </li>
        ))}
      </ul>

      {/* Completion message */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 bg-green-700 rounded-lg text-center max-w-md mx-auto"
          >
            <p className="font-semibold">Quest Complete!</p>
            <p className="text-sm break-all">{completionToken}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiny confetti animation */}
      <AnimatePresence>
        {justScanned && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/20" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset button */}
      <div className="text-center">
        <button onClick={resetProgress} className="px-4 py-2 bg-red-600 rounded-lg">
          Reset Progress
        </button>
      </div>

      {/* Error messages */}
      {error && <p className="text-red-400 text-center">{error}</p>}
    </div>
  );
}
