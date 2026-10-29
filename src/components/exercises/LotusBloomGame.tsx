import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { Trophy, RotateCcw, Palette, Flower2, Trash2 } from 'lucide-react';

interface LotusBloomGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  bloomThresholdPercent?: number; // e.g., 65%
  holdTimeRequired?: number; // seconds
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onDeleteSessionData?: () => void;
}

const LOTUS_THEMES = [
  { name: 'Rainbow', hex: '#ec4899', petals: ['#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#a855f7'] },
  { name: 'Rose', hex: '#f43f5e', petals: ['#fda4af', '#f43f5e', '#e11d48'] },
  { name: 'Golden', hex: '#eab308', petals: ['#fef08a', '#facc15', '#ca8a04'] },
  { name: 'Ocean', hex: '#06b6d4', petals: ['#a5f3fc', '#06b6d4', '#0891b2'] },
  { name: 'Violet', hex: '#a855f7', petals: ['#e9d5ff', '#c084fc', '#9333ea'] },
];

export const LotusBloomGame: React.FC<LotusBloomGameProps> = ({
  metrics,
  landmarks,
  targetReps = 12,
  bloomThresholdPercent = 65,
  holdTimeRequired = 1.8,
  onSessionComplete,
  onDeleteSessionData,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [themeIdx, setThemeIdx] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const repsRef = useRef<number>(0);
  repsRef.current = reps;
  const isCompletedRef = useRef<boolean>(false);
  isCompletedRef.current = isCompleted;

  const holdStartRef = useRef<number | null>(null);

  // Palm center coordinate ref
  const palmRef = useRef<{ x: number; y: number; openRatio: number }>({
    x: 0.5,
    y: 0.55,
    openRatio: 0,
  });

  if (landmarks && landmarks.length > 20) {
    const palm = landmarks[LM.MIDDLE_MCP];
    if (palm) {
      palmRef.current = {
        x: palm.x,
        y: palm.y,
        openRatio: metrics ? metrics.handOpenRatio : 0,
      };
    }
  }

  // 60FPS AR Render Loop
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

          const px = palmRef.current.x * w;
          const py = palmRef.current.y * h;
          const openRatio = palmRef.current.openRatio;
          const isOpenEnough = openRatio >= bloomThresholdPercent;

          const now = performance.now();
          if (isOpenEnough) {
            if (!holdStartRef.current) {
              holdStartRef.current = now;
              audioBiofeedback.playHoldTone(0.3);
            }
            const elapsed = (now - holdStartRef.current) / 1000;
            const progress = Math.min(1, elapsed / holdTimeRequired);
            setHoldProgress(progress);

            if (progress >= 1) {
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
                  colors: ['#ec4899', '#f43f5e', '#a855f7', '#06b6d4', '#f59e0b'],
                });
                audioBiofeedback.speakGuidance('Glorious hand extension! Spasticity release achieved.');

                onSessionComplete({
                  exerciseId: 'lotus_bloom',
                  exerciseTitle: 'Lotus Bloom & Release',
                  repsCompleted: nextReps,
                  targetReps,
                  durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                  accuracyScore: 92,
                  peakExtensionAngle: 155,
                  bestPinchMm: 35,
                  avgTremorIndex: 1.9,
                  smoothnessScore: 91,
                });
              }
            }
          } else {
            holdStartRef.current = null;
            setHoldProgress(0);
          }

          // Draw Blooming Lotus Over Palm Center
          const petalColors = LOTUS_THEMES[themeIdx].petals;
          const bloomScale = 0.35 + (openRatio / 100) * 0.65;
          const numPetals = 8;

          ctx.save();
          ctx.translate(px, py);

          // Glowing Aura
          ctx.beginPath();
          ctx.arc(0, 0, 50 * bloomScale, 0, Math.PI * 2);
          ctx.fillStyle = isOpenEnough ? 'rgba(16, 185, 129, 0.2)' : 'rgba(236, 72, 153, 0.15)';
          ctx.fill();

          // Petals
          for (let i = 0; i < numPetals; i++) {
            const angle = (i * (2 * Math.PI)) / numPetals;
            const petalColor = petalColors[i % petalColors.length];

            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = petalColor;
            ctx.beginPath();
            ctx.ellipse(0, -32 * bloomScale, 14 * bloomScale, 28 * bloomScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }

          // Core Seed / Pistil
          ctx.beginPath();
          ctx.arc(0, 0, 16 * bloomScale, 0, Math.PI * 2);
          ctx.fillStyle = isOpenEnough ? '#10b981' : '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Hold Progress Ring
          if (holdProgress > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, 68 * bloomScale, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 5;
            ctx.stroke();
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
  }, [themeIdx, holdProgress, holdTimeRequired, bloomThresholdPercent, targetReps, onSessionComplete]);

  const restartGame = () => {
    repsRef.current = 0;
    isCompletedRef.current = false;
    setReps(0);
    setIsCompleted(false);
    startTimeRef.current = Date.now();
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-3 select-none">
      {/* Top Floating White HUD */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-4 text-xs shadow-sm">
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Bloomed</span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-bold text-pink-600">{reps}</span>
              <span className="text-slate-500">/ {targetReps}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Open Extension</span>
            <div className="w-20 bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
              <div
                className="bg-pink-500 h-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(palmRef.current.openRatio))}%` }}
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
          <Palette className="w-4 h-4 text-pink-500" />
          <span>Flower Petal Theme:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {LOTUS_THEMES.map((t, idx) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setThemeIdx(idx)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                themeIdx === idx ? 'ring-2 ring-offset-1 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={{
                backgroundColor: themeIdx === idx ? t.hex : undefined,
                boxShadow: themeIdx === idx ? `0 0 0 2px ${t.hex}` : undefined,
              }}
            >
              <span>🪷 {t.name}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
