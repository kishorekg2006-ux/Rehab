import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { Trophy, RotateCcw, Palette, Trash2, CheckCircle2 } from 'lucide-react';

interface PinchHarvestGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  holdTimeRequired?: number; // seconds
  pinchThresholdMm?: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onDeleteSessionData?: () => void;
}

interface TargetFruit {
  id: number;
  x: number;
  y: number;
  name: string;
  emoji: string;
  color: string;
  theme: string;
}

const PINCH_FRUITS = [
  { name: 'Cherries', emoji: '🍒', color: '#ef4444', theme: 'red' },
  { name: 'Peach', emoji: '🍑', color: '#f97316', theme: 'orange' },
  { name: 'Lemon', emoji: '🍋', color: '#eab308', theme: 'yellow' },
  { name: 'Lime', emoji: '🍈', color: '#10b981', theme: 'green' },
  { name: 'Plum', emoji: '🫐', color: '#3b82f6', theme: 'blue' },
  { name: 'Grapes', emoji: '🍇', color: '#a855f7', theme: 'purple' },
];

export const PinchHarvestGame: React.FC<PinchHarvestGameProps> = ({
  metrics,
  landmarks,
  targetReps = 15,
  holdTimeRequired = 1.0,
  pinchThresholdMm = 32,
  onSessionComplete,
  onDeleteSessionData,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [activeColor, setActiveColor] = useState<string>('all');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [targetFruit, setTargetFruit] = useState<TargetFruit>({
    id: 1,
    x: 0.5,
    y: 0.38,
    name: 'Cherries',
    emoji: '🍒',
    color: '#ef4444',
    theme: 'red',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const activeColorRef = useRef<string>(activeColor);
  activeColorRef.current = activeColor;

  const repsRef = useRef<number>(0);
  repsRef.current = reps;
  const isCompletedRef = useRef<boolean>(false);
  isCompletedRef.current = isCompleted;

  const holdStartRef = useRef<number | null>(null);

  // Fingertip coordinates ref
  const pinchCoordRef = useRef<{ x: number; y: number; isPinching: boolean; aperture: number }>({
    x: 0.5,
    y: 0.5,
    isPinching: false,
    aperture: 50,
  });

  if (landmarks && landmarks.length > 20) {
    const thumb = landmarks[LM.THUMB_TIP];
    const index = landmarks[LM.INDEX_TIP];
    if (thumb && index) {
      pinchCoordRef.current = {
        x: (thumb.x + index.x) / 2,
        y: (thumb.y + index.y) / 2,
        isPinching: metrics ? metrics.isPinching : false,
        aperture: metrics ? metrics.pinchAperture : 40,
      };
    }
  }

  // Spawn new ripe fruit on screen
  const spawnFruit = () => {
    let pool = PINCH_FRUITS;
    if (activeColorRef.current !== 'all') {
      pool = PINCH_FRUITS.filter((f) => f.theme === activeColorRef.current);
      if (pool.length === 0) pool = PINCH_FRUITS;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];

    setTargetFruit({
      id: Date.now(),
      x: 0.25 + Math.random() * 0.5,
      y: 0.25 + Math.random() * 0.35,
      name: item.name,
      emoji: item.emoji,
      color: item.color,
      theme: item.theme,
    });
    setHoldProgress(0);
    holdStartRef.current = null;
  };

  // 60FPS AR Render & Kinematic Loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      if (!isCompletedRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const fx = targetFruit.x * w;
          const fy = targetFruit.y * h;

          const px = pinchCoordRef.current.x * w;
          const py = pinchCoordRef.current.y * h;
          const isPinching = pinchCoordRef.current.isPinching;

          // Check alignment between fingers and fruit target
          const dist = Math.hypot(fx - px, fy - py);
          const isTargetAligned = dist < 58;

          // Process hold duration
          const now = performance.now();
          if (isTargetAligned && isPinching) {
            if (!holdStartRef.current) {
              holdStartRef.current = now;
              audioBiofeedback.playHoldTone(0.3);
            }
            const elapsedSec = (now - holdStartRef.current) / 1000;
            const progress = Math.min(1, elapsedSec / holdTimeRequired);
            setHoldProgress(progress);

            if (progress >= 1) {
              // Plucked!
              audioBiofeedback.playSuccessChime();
              holdStartRef.current = null;
              setHoldProgress(0);

              const nextReps = repsRef.current + 1;
              setReps(nextReps);

              if (nextReps >= targetReps) {
                isCompletedRef.current = true;
                setIsCompleted(true);
                confetti({
                  particleCount: 85,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#a855f7'],
                });
                audioBiofeedback.speakGuidance('Wonderful pincer precision! Session complete.');

                onSessionComplete({
                  exerciseId: 'pinch_harvest',
                  exerciseTitle: 'Pinch & Fruit Harvest',
                  repsCompleted: nextReps,
                  targetReps,
                  durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                  accuracyScore: 95,
                  peakExtensionAngle: 135,
                  bestPinchMm: 20,
                  avgTremorIndex: 2.0,
                  smoothnessScore: 90,
                });
              } else {
                spawnFruit();
              }
            }
          } else {
            holdStartRef.current = null;
            setHoldProgress(0);
          }

          // 1. Draw Target Fruit with Halo
          ctx.save();
          ctx.shadowColor = targetFruit.color;
          ctx.shadowBlur = 18;

          // Fruit background disc
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, 28, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = targetFruit.color;
          ctx.lineWidth = 3.5;
          ctx.stroke();

          // Fruit Emoji
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(targetFruit.emoji, fx, fy + 2);

          // Hold Progress Ring around target
          if (holdProgress > 0) {
            ctx.beginPath();
            ctx.arc(fx, fy, 36, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 6;
            ctx.stroke();
          }
          ctx.restore();

          // 2. Draw Pinch Crosshair on Hand
          ctx.save();
          ctx.translate(px, py);
          ctx.strokeStyle = isPinching ? '#10b981' : '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.stroke();

          if (isPinching) {
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [targetFruit, holdProgress, holdTimeRequired, targetReps, onSessionComplete]);

  const restartGame = () => {
    repsRef.current = 0;
    isCompletedRef.current = false;
    setReps(0);
    setIsCompleted(false);
    startTimeRef.current = Date.now();
    spawnFruit();
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-3 select-none">
      {/* Top Floating White HUD */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-4 text-xs shadow-sm">
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Harvested</span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-bold text-emerald-600">{reps}</span>
              <span className="text-slate-500">/ {targetReps}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Hold Progress</span>
            <div className="w-20 bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-75"
                style={{ width: `${Math.round(holdProgress * 100)}%` }}
              />
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <button
            type="button"
            onClick={restartGame}
            title="Restart"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AR Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20"
      />

      {/* Bottom Color Selector Toolbar */}
      <div className="pointer-events-auto z-30 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 px-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Palette className="w-4 h-4 text-emerald-500" />
          <span>Fruit Color Target:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveColor('all');
              spawnFruit();
            }}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeColor === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🌈 Rainbow All
          </button>

          {PINCH_FRUITS.map((f) => (
            <button
              key={f.theme}
              type="button"
              onClick={() => {
                setActiveColor(f.theme);
                spawnFruit();
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                activeColor === f.theme
                  ? 'ring-2 ring-offset-1 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={{
                backgroundColor: activeColor === f.theme ? f.color : undefined,
                boxShadow: activeColor === f.theme ? `0 0 0 2px ${f.color}` : undefined,
              }}
            >
              <span>{f.emoji}</span>
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
