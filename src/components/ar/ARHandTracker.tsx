import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarks, HandMetrics, ExerciseId } from '../../types/rehab';
import { KinematicsProcessor, LM } from '../../utils/kinematics';
import { generateHandPose } from '../../utils/handSimulation';
import { Camera, CameraOff, Sparkles, RefreshCw, AlertCircle, Eye, Sliders } from 'lucide-react';

interface ARHandTrackerProps {
  exerciseId: ExerciseId;
  affectedSide: 'left' | 'right';
  targetPinchMm?: number;
  bloomThresholdPercent?: number;
  promptedFingerIndex?: number; // 2=index, 3=middle, 4=ring, 5=pinky
  onMetricsUpdate: (metrics: HandMetrics, landmarks: HandLandmarks | null) => void;
  showBiofeedbackOverlay?: boolean;
}

// MediaPipe Window typing
declare global {
  interface Window {
    Hands?: any;
    Camera?: any;
  }
}

export const ARHandTracker: React.FC<ARHandTrackerProps> = ({
  exerciseId,
  affectedSide,
  targetPinchMm = 28,
  bloomThresholdPercent = 70,
  promptedFingerIndex = 2,
  onMetricsUpdate,
  showBiofeedbackOverlay = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kinematicsRef = useRef<KinematicsProcessor>(new KinematicsProcessor());

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<HandMetrics | null>(null);
  const [handDetected, setHandDetected] = useState<boolean>(false);

  // Simulation controls state
  const [simPinch, setSimPinch] = useState<number>(0.2);
  const [simBloom, setSimBloom] = useState<number>(0.5);
  const [simWrist, setSimWrist] = useState<number>(0);
  const [simIsolatedFlex, setSimIsolatedFlex] = useState<number>(0.1);

  // Animation frame reference
  const animFrameRef = useRef<number | null>(null);
  const mediaPipeHandsRef = useRef<any>(null);
  const mediaPipeCamRef = useRef<any>(null);

  // Draw hand bones and nodes on canvas
  const drawHandAR = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: HandLandmarks,
      width: number,
      height: number,
      currentMetrics: HandMetrics
    ) => {
      ctx.clearRect(0, 0, width, height);

      // Skeleton bone connections
      const connections = [
        // Palm
        [LM.WRIST, LM.THUMB_CMC],
        [LM.WRIST, LM.INDEX_MCP],
        [LM.INDEX_MCP, LM.MIDDLE_MCP],
        [LM.MIDDLE_MCP, LM.RING_MCP],
        [LM.RING_MCP, LM.PINKY_MCP],
        [LM.WRIST, LM.PINKY_MCP],
        // Thumb
        [LM.THUMB_CMC, LM.THUMB_MCP],
        [LM.THUMB_MCP, LM.THUMB_IP],
        [LM.THUMB_IP, LM.THUMB_TIP],
        // Index
        [LM.INDEX_MCP, LM.INDEX_PIP],
        [LM.INDEX_PIP, LM.INDEX_DIP],
        [LM.INDEX_DIP, LM.INDEX_TIP],
        // Middle
        [LM.MIDDLE_MCP, LM.MIDDLE_PIP],
        [LM.MIDDLE_PIP, LM.MIDDLE_DIP],
        [LM.MIDDLE_DIP, LM.MIDDLE_TIP],
        // Ring
        [LM.RING_MCP, LM.RING_PIP],
        [LM.RING_PIP, LM.RING_DIP],
        [LM.RING_DIP, LM.RING_TIP],
        // Pinky
        [LM.PINKY_MCP, LM.PINKY_PIP],
        [LM.PINKY_PIP, LM.PINKY_DIP],
        [LM.PINKY_DIP, LM.PINKY_TIP],
      ];

      // Draw Bones
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      connections.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        if (!p1 || !p2) return;

        const x1 = p1.x * width;
        const y1 = p1.y * height;
        const x2 = p2.x * width;
        const y2 = p2.y * height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Highlight thumb and index for pinch exercise
        if (
          exerciseId === 'pinch_harvest' &&
          (i === LM.THUMB_IP || i === LM.THUMB_TIP || i === LM.INDEX_DIP || i === LM.INDEX_TIP)
        ) {
          ctx.strokeStyle = currentMetrics.isPinching ? 'rgba(34, 197, 94, 0.9)' : 'rgba(234, 179, 8, 0.9)';
          ctx.lineWidth = 4.5;
        } else {
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)'; // Glowing clinical teal
          ctx.lineWidth = 3;
        }
        ctx.stroke();
      });

      // Draw Joint Nodes
      landmarks.forEach((p, idx) => {
        const x = p.x * width;
        const y = p.y * height;

        ctx.beginPath();
        const isFingertip = [LM.THUMB_TIP, LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP].includes(idx);
        const radius = isFingertip ? 7 : 4;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);

        if (idx === LM.THUMB_TIP || idx === LM.INDEX_TIP) {
          ctx.fillStyle = currentMetrics.isPinching ? '#22c55e' : '#f59e0b';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
        } else if (isFingertip) {
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = '#14b8a6';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();
      });

      // Exercise specific AR overlays
      if (exerciseId === 'pinch_harvest') {
        // Pinch Aperture visual reticle
        const thumbTip = landmarks[LM.THUMB_TIP];
        const indexTip = landmarks[LM.INDEX_TIP];
        const mx = ((thumbTip.x + indexTip.x) / 2) * width;
        const my = ((thumbTip.y + indexTip.y) / 2) * height;

        ctx.beginPath();
        ctx.arc(mx, my, Math.max(12, currentMetrics.pinchAperture * 0.8), 0, 2 * Math.PI);
        ctx.strokeStyle = currentMetrics.isPinching ? '#22c55e' : 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label aperture in mm
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentMetrics.pinchAperture} mm`, mx, my - 16);
      } else if (exerciseId === 'lotus_bloom') {
        // Draw radiating aura based on hand open ratio
        const palmCenter = landmarks[LM.MIDDLE_MCP];
        const px = palmCenter.x * width;
        const py = palmCenter.y * height;
        const ratio = currentMetrics.handOpenRatio / 100;

        ctx.beginPath();
        ctx.arc(px, py, 40 + ratio * 60, 0, 2 * Math.PI);
        ctx.strokeStyle = ratio >= bloomThresholdPercent / 100 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(168, 85, 247, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Bloom: ${currentMetrics.handOpenRatio}%`, px, py + 5);
      } else if (exerciseId === 'wrist_glider') {
        // Wrist Angle Horizon Compass
        const wrist = landmarks[LM.WRIST];
        const wx = wrist.x * width;
        const wy = wrist.y * height;

        ctx.beginPath();
        ctx.moveTo(wx - 40, wy);
        ctx.lineTo(wx + 40, wy);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Wrist: ${currentMetrics.wristAngle}°`, wx, wy + 24);
      }
    },
    [exerciseId, bloomThresholdPercent]
  );

  // Initialize MediaPipe Hands
  const initMediaPipe = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!window.Hands || !window.Camera) {
      console.warn('MediaPipe Hands scripts loading or unavailable; activating interactive rehabilitation mode.');
      setIsSimulatedMode(true);
      return;
    }

    try {
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      hands.onResults((results: any) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          setHandDetected(true);
          const rawLandmarks: HandLandmarks = results.multiHandLandmarks[0];

          // Compute Kinematics
          const processedMetrics = kinematicsRef.current.processHand(rawLandmarks);
          setMetrics(processedMetrics);
          onMetricsUpdate(processedMetrics, rawLandmarks);

          drawHandAR(ctx, rawLandmarks, canvas.width, canvas.height, processedMetrics);
        } else {
          setHandDetected(false);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const empty = kinematicsRef.current.processHand([]);
          setMetrics(empty);
          onMetricsUpdate(empty, null);
        }
      });

      mediaPipeHandsRef.current = hands;

      // Start camera stream
      if (videoRef.current) {
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (mediaPipeHandsRef.current && videoRef.current) {
              await mediaPipeHandsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        await camera.start();
        mediaPipeCamRef.current = camera;
        setCameraActive(true);
        setCameraError(null);
      }
    } catch (err: any) {
      console.warn('Camera or MediaPipe initialization failed:', err);
      setCameraError(err.message || 'Camera permission denied or device busy');
      setIsSimulatedMode(true);
    }
  }, [drawHandAR, onMetricsUpdate]);

  // Simulated Rehabilitation Mode Loop
  useEffect(() => {
    if (!isSimulatedMode) return;

    let time = 0;
    const runSimLoop = () => {
      time += 0.03;
      if (!canvasRef.current) {
        animFrameRef.current = requestAnimationFrame(runSimLoop);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Generate anatomically structured simulated hand
      const landmarks = generateHandPose({
        hand: affectedSide,
        centerX: 0.5,
        centerY: 0.55,
        scale: 0.85,
        pinchAmount: simPinch,
        bloomAmount: simBloom,
        wristAngleDeg: simWrist,
        isolatedFingerFlexion: simIsolatedFlex,
        isolatedFingerIndex: promptedFingerIndex,
      });

      const processedMetrics = kinematicsRef.current.processHand(landmarks);
      setMetrics(processedMetrics);
      setHandDetected(true);
      onMetricsUpdate(processedMetrics, landmarks);

      drawHandAR(ctx, landmarks, canvas.width, canvas.height, processedMetrics);

      animFrameRef.current = requestAnimationFrame(runSimLoop);
    };

    animFrameRef.current = requestAnimationFrame(runSimLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isSimulatedMode,
    affectedSide,
    simPinch,
    simBloom,
    simWrist,
    simIsolatedFlex,
    promptedFingerIndex,
    drawHandAR,
    onMetricsUpdate,
  ]);

  // Initial Camera mount
  useEffect(() => {
    if (!isSimulatedMode) {
      initMediaPipe();
    }
    return () => {
      if (mediaPipeCamRef.current) {
        try {
          mediaPipeCamRef.current.stop();
        } catch {}
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [initMediaPipe, isSimulatedMode]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
      {/* Video & AR Canvas Viewport */}
      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-slate-950">
        {/* Real Webcam video */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive && !isSimulatedMode ? (isMirrored ? '-scale-x-100 opacity-80' : 'opacity-80') : 'opacity-0'
          }`}
        />

        {/* Ambient clinical grid background when in simulated mode */}
        {isSimulatedMode && (
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        )}

        {/* Augmented Reality Hand Skeleton Canvas */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className={`relative z-10 w-full h-full object-contain pointer-events-none transition-transform ${
            isMirrored && cameraActive && !isSimulatedMode ? '-scale-x-100' : ''
          }`}
        />

        {/* Real-Time Biofeedback HUD Overlays */}
        {showBiofeedbackOverlay && (
          <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between pointer-events-none">
            {/* Top Left: Kinematic Indicators */}
            <div className="flex flex-col gap-2">
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      handDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-semibold text-slate-300">
                    {handDetected
                      ? `${affectedSide.toUpperCase()} Hand Tracked`
                      : 'Show Hand to Camera'}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {isSimulatedMode ? '(Test Mode)' : '(Live AR)'}
                  </span>
                </div>

                {metrics && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400 mt-1">
                    <div>
                      Pinch Gap:{' '}
                      <span
                        className={`font-semibold ${
                          metrics.isPinching ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {metrics.pinchAperture}mm
                      </span>
                    </div>
                    <div>
                      Extension:{' '}
                      <span className="text-slate-200 font-semibold">
                        {metrics.avgFingerExtension}°
                      </span>
                    </div>
                    <div>
                      Open Bloom:{' '}
                      <span className="text-teal-400 font-semibold">
                        {metrics.handOpenRatio}%
                      </span>
                    </div>
                    <div>
                      Tremor Jerk:{' '}
                      <span
                        className={`font-semibold ${
                          metrics.tremorIndex > 4 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {metrics.tremorIndex} / 10
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Compensatory Movement Warning Toast */}
              {metrics?.compensationWarning && (
                <div className="bg-amber-950/90 border border-amber-600/70 text-amber-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-lg animate-bounce">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{metrics.compensationWarning}</span>
                </div>
              )}
            </div>

            {/* Top Right: View & Camera Controls */}
            <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/80 backdrop-blur-md border border-slate-700/60 p-1.5 rounded-xl shadow-lg">
              <button
                type="button"
                onClick={() => setIsMirrored(!isMirrored)}
                title="Mirror Camera View"
                className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                  isMirrored ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSimulatedMode) {
                    setIsSimulatedMode(false);
                    initMediaPipe();
                  } else {
                    setIsSimulatedMode(true);
                  }
                }}
                title={isSimulatedMode ? 'Switch to Live Webcam' : 'Switch to Calibration Test Hand'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  isSimulatedMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {isSimulatedMode ? (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Use Live Cam</span>
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Hand Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simulator Quick Slider Bar for testing in low-light / clinical evaluation */}
      {isSimulatedMode && (
        <div className="bg-slate-950/95 border-t border-slate-800/80 p-3 px-4 flex flex-wrap items-center justify-between gap-4 text-xs z-30">
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Biomechanical Simulator (Home Clinical Test Mode)</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {exerciseId === 'pinch_harvest' && (
              <label className="flex items-center gap-2 text-slate-300">
                <span>Pinch Aperture:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simPinch}
                  onChange={(e) => setSimPinch(parseFloat(e.target.value))}
                  className="w-24 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-slate-400 w-8">
                  {Math.round((1 - simPinch) * 45)}mm
                </span>
              </label>
            )}

            {exerciseId === 'lotus_bloom' && (
              <label className="flex items-center gap-2 text-slate-300">
                <span>Extension Spread:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simBloom}
                  onChange={(e) => setSimBloom(parseFloat(e.target.value))}
                  className="w-24 accent-teal-500 cursor-pointer"
                />
                <span className="font-mono text-teal-400 w-10">
                  {Math.round(simBloom * 100)}%
                </span>
              </label>
            )}

            {exerciseId === 'finger_isolation' && (
              <label className="flex items-center gap-2 text-slate-300">
                <span>Tap Flexion:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simIsolatedFlex}
                  onChange={(e) => setSimIsolatedFlex(parseFloat(e.target.value))}
                  className="w-24 accent-cyan-500 cursor-pointer"
                />
                <span className="font-mono text-cyan-400 w-8">
                  {Math.round(simIsolatedFlex * 100)}%
                </span>
              </label>
            )}

            {exerciseId === 'wrist_glider' && (
              <label className="flex items-center gap-2 text-slate-300">
                <span>Wrist Tilt:</span>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="2"
                  value={simWrist}
                  onChange={(e) => setSimWrist(parseInt(e.target.value))}
                  className="w-24 accent-sky-500 cursor-pointer"
                />
                <span className="font-mono text-sky-400 w-8">{simWrist}°</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
