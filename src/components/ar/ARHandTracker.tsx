import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarks, HandMetrics, ExerciseId } from '../../types/rehab';
import { KinematicsProcessor, LM, determinePhysicalHand } from '../../utils/kinematics';
import { generateHandPose } from '../../utils/handSimulation';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  Sliders,
  Sparkles,
  Eye,
  Shield,
  Maximize2,
  Minimize2,
  Maximize,
  ArrowLeftRight,
  Hand,
  Clock,
} from 'lucide-react';

interface ARHandTrackerProps {
  exerciseId: ExerciseId;
  affectedSide: 'left' | 'right';
  targetHandMode?: 'auto' | 'right' | 'left';
  onHandModeChange?: (mode: 'auto' | 'right' | 'left') => void;
  monitorSize?: 'small' | 'large';
  onToggleMonitorSize?: () => void;
  targetPinchMm?: number;
  bloomThresholdPercent?: number;
  promptedFingerIndex?: number;
  onMetricsUpdate: (metrics: HandMetrics, landmarks: HandLandmarks | null) => void;
  showBiofeedbackOverlay?: boolean;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    Hands?: any;
    Camera?: any;
  }
}

export const ARHandTracker: React.FC<ARHandTrackerProps> = ({
  exerciseId,
  affectedSide,
  targetHandMode = 'auto',
  onHandModeChange,
  monitorSize = 'large',
  onToggleMonitorSize,
  targetPinchMm = 28,
  bloomThresholdPercent = 70,
  promptedFingerIndex = 2,
  onMetricsUpdate,
  showBiofeedbackOverlay = true,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kinematicsRef = useRef<KinematicsProcessor>(new KinematicsProcessor());

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [invertChirality, setInvertChirality] = useState<boolean>(false);
  const [handMode, setHandMode] = useState<'auto' | 'right' | 'left'>(targetHandMode);
  const [detectedChirality, setDetectedChirality] = useState<'left' | 'right'>('right');
  const [hudMetrics, setHudMetrics] = useState<HandMetrics | null>(null);
  const [handDetected, setHandDetected] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState<number>(0);

  // Active rehabilitation exercise timer
  useEffect(() => {
    setSessionElapsedSeconds(0);
    const interval = setInterval(() => {
      setSessionElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [exerciseId]);

  // Sync handMode from props if controlled
  useEffect(() => {
    if (targetHandMode) {
      setHandMode(targetHandMode);
    }
  }, [targetHandMode]);

  const handleSelectHandMode = (mode: 'auto' | 'right' | 'left') => {
    setHandMode(mode);
    if (onHandModeChange) {
      onHandModeChange(mode);
    }
  };

  // Interactive Biomechanical simulation state (used when camera is off or in test mode)
  const [simPinch, setSimPinch] = useState<number>(0.2);
  const [simBloom, setSimBloom] = useState<number>(0.5);
  const [simWrist, setSimWrist] = useState<number>(0);
  const [simIsolatedFlex, setSimIsolatedFlex] = useState<number>(0.1);

  // High performance refs
  const smoothedLandmarksRef = useRef<HandLandmarks | null>(null);
  const isProcessingFrameRef = useRef<boolean>(false);
  const mediaPipeHandsRef = useRef<any>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastStateEmitTimeRef = useRef<number>(0);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Draw 21-joint skeletal hand on AR overlay with high-contrast, colorful aesthetics
  const drawHandAR = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: HandLandmarks,
      width: number,
      height: number,
      currentMetrics: HandMetrics,
      handSide: 'left' | 'right'
    ) => {
      ctx.clearRect(0, 0, width, height);

      const connections = [
        [LM.WRIST, LM.THUMB_CMC],
        [LM.WRIST, LM.INDEX_MCP],
        [LM.INDEX_MCP, LM.MIDDLE_MCP],
        [LM.MIDDLE_MCP, LM.RING_MCP],
        [LM.RING_MCP, LM.PINKY_MCP],
        [LM.WRIST, LM.PINKY_MCP],
        [LM.THUMB_CMC, LM.THUMB_MCP],
        [LM.THUMB_MCP, LM.THUMB_IP],
        [LM.THUMB_IP, LM.THUMB_TIP],
        [LM.INDEX_MCP, LM.INDEX_PIP],
        [LM.INDEX_PIP, LM.INDEX_DIP],
        [LM.INDEX_DIP, LM.INDEX_TIP],
        [LM.MIDDLE_MCP, LM.MIDDLE_PIP],
        [LM.MIDDLE_PIP, LM.MIDDLE_DIP],
        [LM.MIDDLE_DIP, LM.MIDDLE_TIP],
        [LM.RING_MCP, LM.RING_PIP],
        [LM.RING_PIP, LM.RING_DIP],
        [LM.RING_DIP, LM.RING_TIP],
        [LM.PINKY_MCP, LM.PINKY_PIP],
        [LM.PINKY_PIP, LM.PINKY_DIP],
        [LM.PINKY_DIP, LM.PINKY_TIP],
      ];

      // Draw Bones with vibrant colors
      ctx.lineWidth = 4.5;
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

        if (
          exerciseId === 'pinch_harvest' &&
          (i === LM.THUMB_IP || i === LM.THUMB_TIP || i === LM.INDEX_DIP || i === LM.INDEX_TIP)
        ) {
          ctx.strokeStyle = currentMetrics.isPinching ? '#10b981' : '#f59e0b';
          ctx.lineWidth = 5.5;
        } else {
          // Dynamic color based on detected hand: Amber for Right, Cyan for Left
          ctx.strokeStyle = handSide === 'right' ? '#f59e0b' : '#06b6d4';
          ctx.lineWidth = 4;
        }
        ctx.stroke();
      });

      // Draw Joint Nodes
      landmarks.forEach((p, idx) => {
        const x = p.x * width;
        const y = p.y * height;

        ctx.beginPath();
        const isFingertip = [LM.THUMB_TIP, LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP].includes(idx);
        const radius = isFingertip ? 8 : 4.5;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);

        if (idx === LM.THUMB_TIP || idx === LM.INDEX_TIP) {
          ctx.fillStyle = currentMetrics.isPinching ? '#10b981' : '#f59e0b';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
        } else if (isFingertip) {
          ctx.fillStyle = handSide === 'right' ? '#fbbf24' : '#38bdf8';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
        } else {
          ctx.fillStyle = handSide === 'right' ? '#d97706' : '#0284c7';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
        }
        ctx.fill();
        ctx.stroke();
      });

      // Draw Explicit Hand Chirality Tag directly on AR Canvas
      const wrist = landmarks[LM.WRIST];
      if (wrist) {
        const wx = wrist.x * width;
        const wy = Math.min(height - 24, Math.max(30, wrist.y * height + 36));
        const isRight = handSide === 'right';
        const label = isRight ? '🖐️ RIGHT HAND' : '🤚 LEFT HAND';
        const badgeColor = isRight ? '#f59e0b' : '#0284c7';

        ctx.save();
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(label).width;
        const badgeW = textWidth + 20;
        const badgeH = 24;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(wx - badgeW / 2, wy - 16, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, wx, wy);
        ctx.restore();
      }

      // Exercise-specific AR kinematic overlays
      if (exerciseId === 'pinch_harvest') {
        const thumbTip = landmarks[LM.THUMB_TIP];
        const indexTip = landmarks[LM.INDEX_TIP];
        if (thumbTip && indexTip) {
          const mx = ((thumbTip.x + indexTip.x) / 2) * width;
          const my = ((thumbTip.y + indexTip.y) / 2) * height;

          ctx.beginPath();
          ctx.arc(mx, my, Math.max(14, currentMetrics.pinchAperture * 0.85), 0, 2 * Math.PI);
          ctx.strokeStyle = currentMetrics.isPinching ? '#10b981' : '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${currentMetrics.pinchAperture} mm`, mx, my - 16);
        }
      } else if (exerciseId === 'lotus_bloom') {
        const palmCenter = landmarks[LM.MIDDLE_MCP];
        if (palmCenter) {
          const px = palmCenter.x * width;
          const py = palmCenter.y * height;
          const ratio = currentMetrics.handOpenRatio / 100;

          ctx.beginPath();
          ctx.arc(px, py, 40 + ratio * 60, 0, 2 * Math.PI);
          ctx.strokeStyle = ratio >= bloomThresholdPercent / 100 ? '#10b981' : '#a855f7';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Bloom: ${currentMetrics.handOpenRatio}%`, px, py + 4);
        }
      } else if (exerciseId === 'wrist_glider') {
        const wristPoint = landmarks[LM.WRIST];
        if (wristPoint) {
          const wx = wristPoint.x * width;
          const wy = wristPoint.y * height;

          ctx.beginPath();
          ctx.moveTo(wx - 40, wy);
          ctx.lineTo(wx + 40, wy);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Wrist: ${currentMetrics.wristAngle}°`, wx, wy + 24);
        }
      }
    },
    [exerciseId, bloomThresholdPercent]
  );

  // Initialize MediaPipe Hands & Native Camera Stream
  const initCameraAndTracking = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setCameraError(null);

    // 1. Get webcam stream with strict 640x480 resolution (ultra lightweight, 60fps)
    try {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      videoStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setIsSimulatedMode(false);
      }
    } catch (err: any) {
      console.warn('Webcam stream unavailable, switching to test hand mode:', err);
      setCameraError('Camera access unavailable. Using interactive test hand simulation.');
      setIsSimulatedMode(true);
      return;
    }

    // 2. Initialize MediaPipe Hands with ModelComplexity 0 (Fastest, zero lag)
    if (!window.Hands) {
      console.warn('MediaPipe Hands library not loaded yet; fallback to simulated hand.');
      setIsSimulatedMode(true);
      return;
    }

    try {
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      // Track up to 2 hands to handle both left/right seamlessly
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // Identify physical handedness for each detected hand
          const detectedList = results.multiHandLandmarks.map((lm: any, idx: number) => {
            const rawLabel = results.multiHandedness?.[idx]?.label;
            const physical = determinePhysicalHand(rawLabel, lm, isMirrored, invertChirality);
            return {
              index: idx,
              landmarks: lm,
              physical,
              score: results.multiHandedness?.[idx]?.score || 0.5,
            };
          });

          // Select which hand to track based on user mode
          let chosen = detectedList[0];
          if (handMode === 'right') {
            const rightMatch = detectedList.find((h: any) => h.physical === 'right');
            if (rightMatch) chosen = rightMatch;
          } else if (handMode === 'left') {
            const leftMatch = detectedList.find((h: any) => h.physical === 'left');
            if (leftMatch) chosen = leftMatch;
          }

          const currentPhysicalHand = chosen.physical;
          setDetectedChirality(currentPhysicalHand);
          setHandDetected(true);

          const rawLandmarks: HandLandmarks = chosen.landmarks;

          // Mirror correction so coordinates match the camera visual space 1:1
          const adjustedLandmarks: HandLandmarks = rawLandmarks.map((p) => ({
            x: isMirrored ? 1 - p.x : p.x,
            y: p.y,
            z: p.z,
          }));

          // EMA smoothing (alpha = 0.8) for immediate zero-lag response with zero jitter
          let finalLandmarks = adjustedLandmarks;
          if (smoothedLandmarksRef.current && smoothedLandmarksRef.current.length === 21) {
            const alpha = 0.8;
            finalLandmarks = adjustedLandmarks.map((pt, i) => {
              const prev = smoothedLandmarksRef.current![i];
              return {
                x: prev.x * (1 - alpha) + pt.x * alpha,
                y: prev.y * (1 - alpha) + pt.y * alpha,
                z: (prev.z || 0) * (1 - alpha) + (pt.z || 0) * alpha,
              };
            });
          }
          smoothedLandmarksRef.current = finalLandmarks;

          // Compute Kinematics with confirmed physical hand chirality
          const processedMetrics = kinematicsRef.current.processHand(
            finalLandmarks,
            performance.now(),
            currentPhysicalHand
          );

          // Render AR Skeleton
          drawHandAR(ctx, finalLandmarks, canvas.width, canvas.height, processedMetrics, currentPhysicalHand);

          // Emit to React components
          const now = performance.now();
          if (now - lastStateEmitTimeRef.current > 180) {
            lastStateEmitTimeRef.current = now;
            setHudMetrics(processedMetrics);
            onMetricsUpdate(processedMetrics, finalLandmarks);
          } else {
            onMetricsUpdate(processedMetrics, finalLandmarks);
          }
        } else {
          setHandDetected(false);
          smoothedLandmarksRef.current = null;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const empty = kinematicsRef.current.processHand([]);
          const now = performance.now();
          if (now - lastStateEmitTimeRef.current > 250) {
            lastStateEmitTimeRef.current = now;
            setHudMetrics(empty);
            onMetricsUpdate(empty, null);
          }
        }
      });

      mediaPipeHandsRef.current = hands;

      // Native Zero-Lag Frame Processing Loop with Lock
      let isLoopRunning = true;

      const processVideoFrame = async () => {
        if (!isLoopRunning) return;

        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          !isProcessingFrameRef.current &&
          mediaPipeHandsRef.current
        ) {
          isProcessingFrameRef.current = true;
          try {
            await mediaPipeHandsRef.current.send({ image: videoRef.current });
          } catch {
            // Transient frame skip
          } finally {
            isProcessingFrameRef.current = false;
          }
        }

        if (isLoopRunning) {
          animFrameRef.current = requestAnimationFrame(processVideoFrame);
        }
      };

      animFrameRef.current = requestAnimationFrame(processVideoFrame);
    } catch (err) {
      console.warn('Error setting up MediaPipe Hands:', err);
      setIsSimulatedMode(true);
    }
  }, [drawHandAR, isMirrored, invertChirality, handMode, onMetricsUpdate]);

  // Simulated Rehabilitation Mode Loop (Smooth 60fps fallback for testing)
  useEffect(() => {
    if (!isSimulatedMode) return;

    let simAnimId: number;

    const runSimLoop = () => {
      if (!canvasRef.current) {
        simAnimId = requestAnimationFrame(runSimLoop);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const activeSimHand = handMode === 'auto' ? affectedSide : handMode;

      const landmarks = generateHandPose({
        hand: activeSimHand,
        centerX: 0.5,
        centerY: 0.55,
        scale: 0.85,
        pinchAmount: simPinch,
        bloomAmount: simBloom,
        wristAngleDeg: simWrist,
        isolatedFingerFlexion: simIsolatedFlex,
        isolatedFingerIndex: promptedFingerIndex,
      });

      const processedMetrics = kinematicsRef.current.processHand(landmarks, performance.now(), activeSimHand);
      setHandDetected(true);
      setDetectedChirality(activeSimHand);

      drawHandAR(ctx, landmarks, canvas.width, canvas.height, processedMetrics, activeSimHand);

      const now = performance.now();
      if (now - lastStateEmitTimeRef.current > 180) {
        lastStateEmitTimeRef.current = now;
        setHudMetrics(processedMetrics);
        onMetricsUpdate(processedMetrics, landmarks);
      } else {
        onMetricsUpdate(processedMetrics, landmarks);
      }

      simAnimId = requestAnimationFrame(runSimLoop);
    };

    simAnimId = requestAnimationFrame(runSimLoop);

    return () => {
      cancelAnimationFrame(simAnimId);
    };
  }, [
    isSimulatedMode,
    affectedSide,
    handMode,
    simPinch,
    simBloom,
    simWrist,
    simIsolatedFlex,
    promptedFingerIndex,
    drawHandAR,
    onMetricsUpdate,
  ]);

  // Mount camera on load
  useEffect(() => {
    initCameraAndTracking();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaPipeHandsRef.current) {
        try {
          mediaPipeHandsRef.current.close();
        } catch {}
      }
    };
  }, [initCameraAndTracking]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-3xl overflow-hidden border-2 border-indigo-200/80 bg-white shadow-xl shadow-indigo-500/10 flex flex-col justify-between transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none max-h-screen' : ''
      }`}
    >
      {/* Top Monitor Control Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/60 p-2.5 px-4 flex flex-wrap items-center justify-between gap-2.5 text-white z-30">
        {/* Left: Hand Selection & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl p-1">
            <span className="text-[11px] font-bold text-slate-300 px-1.5 flex items-center gap-1">
              <Hand className="w-3.5 h-3.5 text-indigo-400" /> Hand:
            </span>
            <button
              type="button"
              onClick={() => handleSelectHandMode('auto')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                handMode === 'auto'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              Auto ⚡
            </button>
            <button
              type="button"
              onClick={() => handleSelectHandMode('right')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                handMode === 'right'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              Right 🖐️
            </button>
            <button
              type="button"
              onClick={() => handleSelectHandMode('left')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                handMode === 'left'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              Left 🤚
            </button>
          </div>

          {/* Quick Chirality Flip Button */}
          <button
            type="button"
            onClick={() => setInvertChirality((prev) => !prev)}
            title="Invert Left/Right detection if your camera is backwards"
            className={`px-2 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
              invertChirality
                ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Flip L/R</span>
          </button>
        </div>

        {/* Right: Camera Monitor Size & View Options */}
        <div className="flex items-center gap-2">
          {/* Active Rehab Session Timer */}
          <div
            className="flex items-center gap-1.5 bg-slate-800/90 border border-teal-500/40 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-teal-300 shadow-xs"
            title="Active Exercise Session Timer"
          >
            <Clock className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
            <span>
              {Math.floor(sessionElapsedSeconds / 60)
                .toString()
                .padStart(2, '0')}
              :{(sessionElapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Monitor Size Toggle (Large vs Small) */}
          {onToggleMonitorSize && (
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1">
              <button
                type="button"
                onClick={onToggleMonitorSize}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  monitorSize === 'large'
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Large Monitor</span>
              </button>
              <button
                type="button"
                onClick={onToggleMonitorSize}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  monitorSize === 'small'
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Small</span>
              </button>
            </div>
          )}

          {/* Mirror Video Toggle */}
          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            title={isMirrored ? 'Disable Mirroring' : 'Enable Mirroring'}
            className={`p-1.5 px-2 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all ${
              isMirrored
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mirror</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 px-2 bg-slate-800/60 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Maximize className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>

          {/* Live vs Test Mode */}
          <button
            type="button"
            onClick={() => {
              if (isSimulatedMode) {
                setIsSimulatedMode(false);
                initCameraAndTracking();
              } else {
                setIsSimulatedMode(true);
              }
            }}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              isSimulatedMode
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}
          >
            {isSimulatedMode ? (
              <>
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Mode</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Camera Live</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video & AR Canvas Viewport - Adaptive Size based on Large/Small Monitor Mode */}
      <div
        className={`relative w-full mx-auto flex items-center justify-center overflow-hidden bg-slate-950 transition-all duration-300 ${
          isFullscreen
            ? 'h-full flex-1'
            : monitorSize === 'large'
            ? 'aspect-[16/10] sm:aspect-[16/9] min-h-[460px] max-h-[660px]'
            : 'aspect-[4/3] max-h-[500px]'
        }`}
      >
        {/* Real Webcam video with mirror transformation */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            cameraActive && !isSimulatedMode
              ? isMirrored
                ? '-scale-x-100 opacity-95'
                : 'opacity-95'
              : 'opacity-0'
          }`}
        />

        {/* Ambient Grid for Test Mode */}
        {isSimulatedMode && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white mb-3 shadow-lg shadow-amber-500/20 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <h4 className="text-white text-lg font-bold">Interactive Biomechanical Test Hand</h4>
            <p className="text-slate-300 text-xs max-w-sm mt-1">
              Move the sliders below to test hand movements, pinch actions, flower blooming, and fruit catching.
            </p>
          </div>
        )}

        {/* Augmented Reality Hand Skeleton Canvas - 1:1 Pixel Match with Video */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />

        {/* Interactive AR Game Layer: Virtual Objects Overlay Directly on the Camera Feed! */}
        {children && (
          <div className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-hidden">
            {children}
          </div>
        )}

        {/* Real-Time Biofeedback HUD: Vivid Colorful Badges */}
        {showBiofeedbackOverlay && (
          <div className="absolute top-3 left-3 right-3 z-30 flex items-start justify-between pointer-events-none">
            {/* Top Left: Kinematic Indicators & Detected Hand Banner */}
            <div className="flex flex-col gap-2">
              <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2.5 px-3.5 text-xs text-slate-800 shadow-md pointer-events-auto">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      handDetected ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {/* Distinctive Colorful Chirality Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                      detectedChirality === 'right'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                    }`}
                  >
                    {detectedChirality === 'right' ? '🖐️ Right Hand' : '🤚 Left Hand'}
                  </span>

                  <span className="font-bold text-slate-900 text-xs">
                    {handDetected ? 'Tracking Active' : 'Waiting for Hand...'}
                  </span>
                </div>

                {hudMetrics && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600 mt-1 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pinch:</span>
                      <span className="font-bold text-emerald-600 ml-1.5">{hudMetrics.pinchAperture}mm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Extension:</span>
                      <span className="font-bold text-teal-600 ml-1.5">{hudMetrics.avgFingerExtension}°</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Bloom:</span>
                      <span className="font-bold text-sky-600 ml-1.5">{hudMetrics.handOpenRatio}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Stability:</span>
                      <span className="font-bold text-indigo-600 ml-1.5">{hudMetrics.smoothnessScore}%</span>
                    </div>
                  </div>
                )}
              </div>

              {hudMetrics?.compensationWarning && (
                <div className="bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-md font-bold">
                  <AlertCircle className="w-4 h-4 text-white shrink-0" />
                  <span>{hudMetrics.compensationWarning}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Camera Guidance & Calibration Bottom Bar */}
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50/50 to-slate-50 border-t border-slate-200 p-3 px-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Eye className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            {handDetected
              ? `Currently tracking ${detectedChirality.toUpperCase()} hand. Move freely to interact with targets!`
              : 'Hold up your hand facing the camera (~0.5m - 1m distance).'}
          </span>
        </div>

        {/* Interactive Sliders when in Simulated Mode */}
        {isSimulatedMode ? (
          <div className="flex flex-wrap items-center gap-4">
            {exerciseId === 'fruit_catcher' && (
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Hand Basket Position:</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={simBloom}
                  onChange={(e) => setSimBloom(parseFloat(e.target.value))}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </label>
            )}

            {exerciseId === 'pinch_harvest' && (
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Pinch Aperture:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simPinch}
                  onChange={(e) => setSimPinch(parseFloat(e.target.value))}
                  className="w-28 accent-emerald-500 cursor-pointer"
                />
                <span className="font-mono text-emerald-700 font-bold w-9">
                  {Math.round((1 - simPinch) * 45)}mm
                </span>
              </label>
            )}

            {exerciseId === 'lotus_bloom' && (
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Finger Spread:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simBloom}
                  onChange={(e) => setSimBloom(parseFloat(e.target.value))}
                  className="w-28 accent-teal-500 cursor-pointer"
                />
                <span className="font-mono text-teal-700 font-bold w-9">
                  {Math.round(simBloom * 100)}%
                </span>
              </label>
            )}

            {exerciseId === 'wrist_glider' && (
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Wrist Angle:</span>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="2"
                  value={simWrist}
                  onChange={(e) => setSimWrist(parseInt(e.target.value))}
                  className="w-28 accent-sky-500 cursor-pointer"
                />
                <span className="font-mono text-sky-700 font-bold w-8">{simWrist}°</span>
              </label>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Real-time local processing · 60 FPS zero-lag · Private camera stream</span>
          </div>
        )}
      </div>
    </div>
  );
};
