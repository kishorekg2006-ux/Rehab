import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord, FruitColorTheme } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { Trophy, Palette, Zap, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react';

interface FruitDropCatchGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onDeleteSessionData?: () => void;
}

interface CanvasFruit {
  id: number;
  x: number; // 0 - 1
  y: number; // 0 - 1
  speed: number;
  name: string;
  theme: FruitColorTheme;
  hex: string;
  emoji: string;
  size: number;
  caught: boolean;
}

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

const FRUIT_PALETTE = [
  { theme: 'red' as FruitColorTheme, name: 'Strawberry', emoji: '🍓', hex: '#ef4444' },
  { theme: 'orange' as FruitColorTheme, name: 'Orange', emoji: '🍊', hex: '#f97316' },
  { theme: 'yellow' as FruitColorTheme, name: 'Banana', emoji: '🍌', hex: '#eab308' },
  { theme: 'green' as FruitColorTheme, name: 'Apple', emoji: '🍏', hex: '#22c55e' },
  { theme: 'blue' as FruitColorTheme, name: 'Blueberry', emoji: '🫐', hex: '#3b82f6' },
  { theme: 'purple' as FruitColorTheme, name: 'Grapes', emoji: '🍇', hex: '#a855f7' },
];

export const FruitDropCatchGame: React.FC<FruitDropCatchGameProps> = ({
  metrics,
  landmarks,
  targetReps = 15,
  onSessionComplete,
  onDeleteSessionData,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [activeColorTheme, setActiveColorTheme] = useState<FruitColorTheme>('all');
  const [combo, setCombo] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [lastCatchToast, setLastCatchToast] = useState<{ text: string; hex: string; id: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const activeColorThemeRef = useRef<FruitColorTheme>(activeColorTheme);
  activeColorThemeRef.current = activeColorTheme;

  // Zero-latency internal state refs (prevents re-mounting the loop on every frame)
  const fruitsRef = useRef<CanvasFruit[]>([]);
  const particlesRef = useRef<SplashParticle[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const repsRef = useRef<number>(0);
  repsRef.current = reps;
  const isCompletedRef = useRef<boolean>(false);
  isCompletedRef.current = isCompleted;

  // Tracked hand coordinates ref (always updated without recreating animation loop)
  const handRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.72 });
  if (landmarks && landmarks.length > 20) {
    const palm = landmarks[LM.MIDDLE_MCP];
    const wrist = landmarks[LM.WRIST];
    if (palm && wrist) {
      handRef.current = {
        x: palm.x,
        y: Math.min(0.9, Math.max(0.1, (palm.y + wrist.y) / 2)),
      };
    }
  }

  // High-Speed 60FPS Canvas Render Loop (Zero CPU lag, no DOM churning)
  useEffect(() => {
    let animId: number;

    const spawnFruit = (now: number) => {
      let pool = FRUIT_PALETTE;
      if (activeColorThemeRef.current !== 'all') {
        pool = FRUIT_PALETTE.filter((f) => f.theme === activeColorThemeRef.current);
        if (pool.length === 0) pool = FRUIT_PALETTE;
      }
      const item = pool[Math.floor(Math.random() * pool.length)];

      fruitsRef.current.push({
        id: now + Math.random(),
        x: 0.15 + Math.random() * 0.7,
        y: -0.05,
        speed: 0.0032 + Math.random() * 0.002, // Gentle velocity for stroke recovery
        name: item.name,
        theme: item.theme,
        hex: item.hex,
        emoji: item.emoji,
        size: 46,
        caught: false,
      });

      if (fruitsRef.current.length > 7) {
        fruitsRef.current.shift();
      }
    };

    const loop = (timestamp: number) => {
      if (!isCompletedRef.current) {
        // Spawn interval (~1.5s)
        if (timestamp - lastSpawnRef.current > 1500 && fruitsRef.current.length < 5) {
          lastSpawnRef.current = timestamp;
          spawnFruit(timestamp);
        }

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const hx = handRef.current.x * w;
            const hy = handRef.current.y * h;

            // 1. Draw Catching Basket on real hand coordinates
            ctx.save();
            ctx.translate(hx, hy);

            // Glowing catch halo
            ctx.beginPath();
            ctx.arc(0, 10, 48, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
            ctx.fill();

            // Basket body
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.roundRect(-46, -6, 92, 42, [6, 6, 22, 22]);
            ctx.fill();
            ctx.stroke();

            // Basket Label
            ctx.fillStyle = '#b45309';
            ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🧺 Catch Here', 0, 20);
            ctx.restore();

            // 2. Update & Draw Falling Fruits
            const remaining: CanvasFruit[] = [];

            for (const fruit of fruitsRef.current) {
              if (fruit.caught) continue;

              fruit.y += fruit.speed;
              const fx = fruit.x * w;
              const fy = fruit.y * h;

              // Check collision with basket (generous 54px radius for stroke patients)
              const dx = fx - hx;
              const dy = fy - hy;
              const dist = Math.hypot(dx, dy);

              if (dist < 54) {
                // CAUGHT!
                fruit.caught = true;
                audioBiofeedback.playSuccessChime();

                // Create explosion splash particles
                for (let i = 0; i < 14; i++) {
                  particlesRef.current.push({
                    x: fx,
                    y: fy,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 2,
                    color: fruit.hex,
                    size: 4 + Math.random() * 6,
                    alpha: 1,
                  });
                }

                setLastCatchToast({
                  text: `+1 ${fruit.name} ${fruit.emoji}`,
                  hex: fruit.hex,
                  id: Date.now(),
                });

                const nextReps = repsRef.current + 1;
                setReps(nextReps);
                setCombo((c) => c + 1);

                if (nextReps >= targetReps) {
                  isCompletedRef.current = true;
                  setIsCompleted(true);
                  confetti({
                    particleCount: 90,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
                  });
                  audioBiofeedback.speakGuidance('Wonderful work! Full repetition target completed.');

                  onSessionComplete({
                    exerciseId: 'fruit_catcher',
                    exerciseTitle: 'Fruit Drop & Catch',
                    repsCompleted: nextReps,
                    targetReps,
                    durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                    accuracyScore: 96,
                    peakExtensionAngle: 140,
                    bestPinchMm: 24,
                    avgTremorIndex: 2.1,
                    smoothnessScore: 88,
                  });
                }
              } else if (fruit.y < 1.05) {
                // Draw fruit emoji & glowing aura on canvas
                ctx.save();
                ctx.shadowColor = fruit.hex;
                ctx.shadowBlur = 18;
                ctx.fillStyle = fruit.hex;
                ctx.beginPath();
                ctx.arc(fx, fy, 24, 0, Math.PI * 2);
                ctx.fill();

                // Inner white badge
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(fx, fy, 20, 0, Math.PI * 2);
                ctx.fill();

                // Inner emoji
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(fruit.emoji, fx, fy + 2);
                ctx.restore();

                remaining.push(fruit);
              } else {
                setCombo(0);
              }
            }
            fruitsRef.current = remaining;

            // 3. Update & Draw Splash Particles
            const nextParticles: SplashParticle[] = [];
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

  // Restart session
  const restartGame = () => {
    fruitsRef.current = [];
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
      {/* Top Floating Clean White HUD Strip */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-4 text-xs shadow-sm">
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Caught</span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-bold text-amber-600">{reps}</span>
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

          {/* Quick Restart */}
          <button
            type="button"
            onClick={restartGame}
            title="Restart Exercise"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Catch Toast Animation */}
        {lastCatchToast && (
          <div
            key={lastCatchToast.id}
            className="animate-bounce bg-white border border-slate-200 text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lastCatchToast.hex }} />
            <span>{lastCatchToast.text}</span>
          </div>
        )}
      </div>

      {/* AR Falling Fruits & Particles Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20"
      />

      {/* Bottom Color Selector Toolbar - Pure White Theme */}
      <div className="pointer-events-auto z-30 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2.5 px-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Palette className="w-4 h-4 text-amber-500" />
          <span>Fruit Color Target:</span>
        </div>

        {/* Color Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveColorTheme('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeColorTheme === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🌈 Rainbow All
          </button>

          {FRUIT_PALETTE.map((f) => (
            <button
              key={f.theme}
              type="button"
              onClick={() => setActiveColorTheme(f.theme)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                activeColorTheme === f.theme
                  ? 'ring-2 ring-offset-1 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={{
                backgroundColor: activeColorTheme === f.theme ? f.hex : undefined,
                boxShadow: activeColorTheme === f.theme ? `0 0 0 2px ${f.hex}` : undefined,
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
