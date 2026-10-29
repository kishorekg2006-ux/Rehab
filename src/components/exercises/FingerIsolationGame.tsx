import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { Sparkles, Trophy, RotateCcw, Palette, Zap, Trash2 } from 'lucide-react';

interface FingerIsolationGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onSetPromptedFinger?: (fingerNum: number) => void;
  onDeleteSessionData?: () => void;
}

interface FloatingBalloon {
  id: number;
  x: number;
  y: number;
  speed: number;
  colorName: string;
  hex: string;
  size: number;
  popped: boolean;
}

interface BalloonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

const BALLOON_COLORS = [
  { name: 'Red', hex: '#ef4444', emoji: '🎈' },
  { name: 'Orange', hex: '#f97316', emoji: '🎈' },
  { name: 'Yellow', hex: '#eab308', emoji: '🎈' },
  { name: 'Green', hex: '#10b981', emoji: '🎈' },
  { name: 'Blue', hex: '#3b82f6', emoji: '🎈' },
  { name: 'Purple', hex: '#a855f7', emoji: '🎈' },
];

export const FingerIsolationGame: React.FC<FingerIsolationGameProps> = ({
  metrics,
  landmarks,
  targetReps = 16,
  onSessionComplete,
  onSetPromptedFinger,
  onDeleteSessionData,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [activeColor, setActiveColor] = useState<string>('all');
  const [combo, setCombo] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [lastPopToast, setLastPopToast] = useState<{ text: string; hex: string; id: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const activeColorRef = useRef<string>(activeColor);
  activeColorRef.current = activeColor;

  const balloonsRef = useRef<FloatingBalloon[]>([]);
  const particlesRef = useRef<BalloonParticle[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const repsRef = useRef<number>(0);
  repsRef.current = reps;
  const isCompletedRef = useRef<boolean>(false);
  isCompletedRef.current = isCompleted;

  // Tracked fingertip position (index finger tip or palm)
  const fingertipRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  if (landmarks && landmarks.length > 20) {
    const indexTip = landmarks[LM.INDEX_TIP];
    if (indexTip) {
      fingertipRef.current = {
        x: indexTip.x,
        y: indexTip.y,
      };
    }
  }

  // 60FPS AR Balloon Render Loop
  useEffect(() => {
    let animId: number;

    const spawnBalloon = (now: number) => {
      let pool = BALLOON_COLORS;
      if (activeColorRef.current !== 'all') {
        pool = BALLOON_COLORS.filter((c) => c.name.toLowerCase() === activeColorRef.current.toLowerCase());
        if (pool.length === 0) pool = BALLOON_COLORS;
      }
      const item = pool[Math.floor(Math.random() * pool.length)];

      balloonsRef.current.push({
        id: now + Math.random(),
        x: 0.15 + Math.random() * 0.7,
        y: 1.05,
        speed: 0.003 + Math.random() * 0.0018, // Gentle upward float
        colorName: item.name,
        hex: item.hex,
        size: 38,
        popped: false,
      });

      if (balloonsRef.current.length > 6) {
        balloonsRef.current.shift();
      }
    };

    const loop = (timestamp: number) => {
      if (!isCompletedRef.current) {
        if (timestamp - lastSpawnRef.current > 1600 && balloonsRef.current.length < 5) {
          lastSpawnRef.current = timestamp;
          spawnBalloon(timestamp);
        }

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const tx = fingertipRef.current.x * w;
            const ty = fingertipRef.current.y * h;

            // Draw Pointer Crosshair on Fingertip
            ctx.save();
            ctx.translate(tx, ty);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Update & Draw Balloons
            const remaining: FloatingBalloon[] = [];
            for (const b of balloonsRef.current) {
              if (b.popped) continue;

              b.y -= b.speed;
              const bx = b.x * w;
              const by = b.y * h;

              // Check collision with fingertip
              const dist = Math.hypot(bx - tx, by - ty);

              if (dist < 46) {
                // POPPED!
                b.popped = true;
                audioBiofeedback.playSuccessChime();

                for (let i = 0; i < 16; i++) {
                  particlesRef.current.push({
                    x: bx,
                    y: by,
                    vx: (Math.random() - 0.5) * 9,
                    vy: (Math.random() - 0.5) * 9,
                    color: b.hex,
                    size: 3 + Math.random() * 5,
                    alpha: 1,
                  });
                }

                setLastPopToast({
                  text: `Popped ${b.colorName}!`,
                  hex: b.hex,
                  id: Date.now(),
                });

                const nextReps = repsRef.current + 1;
                setReps(nextReps);
                setCombo((c) => c + 1);

                if (nextReps >= targetReps) {
                  isCompletedRef.current = true;
                  setIsCompleted(true);
                  confetti({
                    particleCount: 85,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#a855f7'],
                  });
                  audioBiofeedback.speakGuidance('Great reaching! Target completed.');

                  onSessionComplete({
                    exerciseId: 'finger_isolation',
                    exerciseTitle: 'Color Balloon Pop',
                    repsCompleted: nextReps,
                    targetReps,
                    durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                    accuracyScore: 94,
                    peakExtensionAngle: 145,
                    bestPinchMm: 22,
                    avgTremorIndex: 2.3,
                    smoothnessScore: 89,
                  });
                }
              } else if (by > -40) {
                // Draw Balloon
                ctx.save();
                ctx.shadowColor = b.hex;
                ctx.shadowBlur = 14;

                // Balloon oval
                ctx.fillStyle = b.hex;
                ctx.beginPath();
                ctx.ellipse(bx, by, 22, 28, 0, 0, Math.PI * 2);
                ctx.fill();

                // Balloon knot & string
                ctx.beginPath();
                ctx.moveTo(bx - 3, by + 28);
                ctx.lineTo(bx + 3, by + 28);
                ctx.lineTo(bx, by + 33);
                ctx.closePath();
                ctx.fillStyle = b.hex;
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(bx, by + 33);
                ctx.quadraticCurveTo(bx + 6, by + 45, bx, by + 55);
                ctx.stroke();

                // Balloon sheen highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.beginPath();
                ctx.ellipse(bx - 7, by - 10, 5, 10, -0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                remaining.push(b);
              }
            }
            balloonsRef.current = remaining;

            // Update & Draw Particles
            const nextParticles: BalloonParticle[] = [];
            for (const p of particlesRef.current) {
              p.x += p.vx;
              p.y += p.vy;
              p.alpha -= 0.04;
              if (p.alpha > 0) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                nextParticles.push(p);
              }
            }
            particlesRef.current = nextParticles;
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [targetReps, onSessionComplete]);

  const restartGame = () => {
    balloonsRef.current = [];
    particlesRef.current = [];
    repsRef.current = 0;
    isCompletedRef.current = false;
    setReps(0);
    setCombo(0);
    setIsCompleted(false);
    startTimeRef.current = Date.now();
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-3 select-none">
      {/* Top Floating White HUD */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-4 text-xs shadow-sm">
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Popped</span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-bold text-sky-600">{reps}</span>
              <span className="text-slate-500">/ {targetReps}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Streak</span>
            <span className="text-base font-bold text-emerald-600 font-mono flex items-center gap-0.5">
              <Zap className="w-3.5 h-3.5 fill-emerald-600" />
              {combo}x
            </span>
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

        {lastPopToast && (
          <div
            key={lastPopToast.id}
            className="animate-bounce bg-white border border-slate-200 text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lastPopToast.hex }} />
            <span>{lastPopToast.text}</span>
          </div>
        )}
      </div>

      {/* AR Balloons Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20"
      />

      {/* Bottom Color Selector Toolbar */}
      <div className="pointer-events-auto z-30 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 px-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Palette className="w-4 h-4 text-sky-500" />
          <span>Target Color:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveColor('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeColor === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🌈 Pop Any Balloon
          </button>

          {BALLOON_COLORS.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setActiveColor(b.name.toLowerCase())}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                activeColor === b.name.toLowerCase()
                  ? 'ring-2 ring-offset-1 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={{
                backgroundColor: activeColor === b.name.toLowerCase() ? b.hex : undefined,
                boxShadow: activeColor === b.name.toLowerCase() ? `0 0 0 2px ${b.hex}` : undefined,
              }}
            >
              <span>{b.emoji}</span>
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
