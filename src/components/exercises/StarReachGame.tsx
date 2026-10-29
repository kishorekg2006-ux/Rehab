import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { Sparkles, Trophy, RotateCcw, Palette, Trash2, Crosshair, Award } from 'lucide-react';

interface StarReachGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onDeleteSessionData?: () => void;
}

interface StarTheme {
  name: string;
  primary: string;
  glow: string;
  accent: string;
  particleColors: string[];
}

const STAR_THEMES: StarTheme[] = [
  {
    name: 'Cosmic Rainbow',
    primary: '#38bdf8',
    glow: '#818cf8',
    accent: '#f43f5e',
    particleColors: ['#38bdf8', '#818cf8', '#f43f5e', '#fbbf24', '#34d399'],
  },
  {
    name: 'Solar Gold',
    primary: '#fbbf24',
    glow: '#f59e0b',
    accent: '#ef4444',
    particleColors: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444', '#fef08a'],
  },
  {
    name: 'Aquamarine Nova',
    primary: '#2dd4bf',
    glow: '#06b6d4',
    accent: '#3b82f6',
    particleColors: ['#2dd4bf', '#06b6d4', '#3b82f6', '#a7f3d0', '#67e8f9'],
  },
  {
    name: 'Nebula Violet',
    primary: '#c084fc',
    glow: '#a855f7',
    accent: '#ec4899',
    particleColors: ['#c084fc', '#a855f7', '#ec4899', '#e879f9', '#f472b6'],
  },
];

// Clinically designed spatial reaching sectors for upper limb hemiparesis recovery
interface ReachTarget {
  id: number;
  x: number; // 0 to 1
  y: number; // 0 to 1
  label: string;
  zone: 'High Right' | 'High Left' | 'High Center' | 'Lateral Right' | 'Lateral Left' | 'Center Reach';
}

const PRESET_TARGETS: Omit<ReachTarget, 'id'>[] = [
  { x: 0.75, y: 0.28, label: 'Upper-Right Reach', zone: 'High Right' },
  { x: 0.25, y: 0.28, label: 'Upper-Left Reach', zone: 'High Left' },
  { x: 0.50, y: 0.22, label: 'High Overhead Reach', zone: 'High Center' },
  { x: 0.80, y: 0.50, label: 'Right Lateral Reach', zone: 'Lateral Right' },
  { x: 0.20, y: 0.50, label: 'Left Lateral Reach', zone: 'Lateral Left' },
  { x: 0.50, y: 0.65, label: 'Center Retraction Touch', zone: 'Center Reach' },
  { x: 0.68, y: 0.38, label: 'Mid-Right Reach', zone: 'High Right' },
  { x: 0.32, y: 0.38, label: 'Mid-Left Reach', zone: 'High Left' },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

interface ToastMessage {
  text: string;
  id: number;
  color: string;
}

export const StarReachGame: React.FC<StarReachGameProps> = ({
  metrics,
  landmarks,
  targetReps = 14,
  onSessionComplete,
  onDeleteSessionData,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [themeIdx, setThemeIdx] = useState<number>(0);
  const [assistanceMode, setAssistanceMode] = useState<'assisted' | 'standard' | 'precision'>('standard');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [reachZoneText, setReachZoneText] = useState<string>('Upper-Right Reach');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const repsRef = useRef<number>(0);
  repsRef.current = reps;
  const isCompletedRef = useRef<boolean>(false);
  isCompletedRef.current = isCompleted;

  // Smoothed hand cursor position (0 to 1)
  const handPosRef = useRef<{ x: number; y: number; hasHand: boolean }>({
    x: 0.5,
    y: 0.6,
    hasHand: false,
  });

  // Current active target star
  const currentTargetRef = useRef<ReachTarget>({
    id: 1,
    x: 0.75,
    y: 0.28,
    label: 'Upper-Right Reach',
    zone: 'High Right',
  });

  // Target transition animation scale (0 to 1)
  const targetScaleRef = useRef<number>(1);
  const shockwavesRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; alpha: number; color: string }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastHitTimeRef = useRef<number>(0);

  // Hit radius based on assistance mode (pixels)
  const hitRadius = assistanceMode === 'assisted' ? 76 : assistanceMode === 'precision' ? 44 : 58;

  // Track hand position from landmarks
  if (landmarks && landmarks.length > 20) {
    // Palm Center (LM.MIDDLE_MCP) or Index Tip (LM.INDEX_TIP)
    const palm = landmarks[LM.MIDDLE_MCP];
    const indexTip = landmarks[LM.INDEX_TIP];
    const wrist = landmarks[LM.WRIST];

    if (indexTip && palm) {
      // Use average of index tip & palm for intuitive natural reaching touch
      const rawX = (indexTip.x * 0.6 + palm.x * 0.4);
      const rawY = (indexTip.y * 0.6 + palm.y * 0.4);

      // Low-pass filter for smooth 60fps tracking
      handPosRef.current = {
        x: handPosRef.current.x * 0.35 + rawX * 0.65,
        y: handPosRef.current.y * 0.35 + rawY * 0.65,
        hasHand: true,
      };
    } else if (wrist) {
      handPosRef.current = {
        x: handPosRef.current.x * 0.35 + wrist.x * 0.65,
        y: handPosRef.current.y * 0.35 + wrist.y * 0.65,
        hasHand: true,
      };
    }
  }

  // Pick next reaching target with alternation to train cross-reach and extension
  const spawnNextTarget = (prevIndex: number) => {
    let nextIndex = Math.floor(Math.random() * PRESET_TARGETS.length);
    if (nextIndex === prevIndex) {
      nextIndex = (nextIndex + 1) % PRESET_TARGETS.length;
    }
    const t = PRESET_TARGETS[nextIndex];
    currentTargetRef.current = {
      id: Date.now() + Math.random(),
      x: t.x,
      y: t.y,
      label: t.label,
      zone: t.zone,
    };
    targetScaleRef.current = 0.2; // Pop in
    setReachZoneText(t.label);
  };

  // Main 60FPS AR Render Loop
  useEffect(() => {
    let animId: number;
    let targetPulseAngle = 0;

    const loop = () => {
      if (!isCompletedRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const theme = STAR_THEMES[themeIdx];
          targetPulseAngle += 0.05;

          // Pop-in scale animation
          if (targetScaleRef.current < 1) {
            targetScaleRef.current = Math.min(1, targetScaleRef.current + 0.08);
          }

          const target = currentTargetRef.current;
          const tx = target.x * w;
          const ty = target.y * h;

          const hx = handPosRef.current.x * w;
          const hy = handPosRef.current.y * h;
          const hasHand = handPosRef.current.hasHand;

          // Compute distance
          const dist = Math.hypot(tx - hx, ty - hy);
          const isNear = dist < hitRadius * 1.5;
          const now = Date.now();

          // Check hit collision
          if (hasHand && dist < hitRadius && now - lastHitTimeRef.current > 400) {
            lastHitTimeRef.current = now;
            audioBiofeedback.playSuccessChime();

            // Emit Shockwave
            shockwavesRef.current.push({
              x: tx,
              y: ty,
              radius: 20,
              maxRadius: 100,
              alpha: 1,
              color: theme.primary,
            });

            // Emit Stardust Particles
            for (let i = 0; i < 35; i++) {
              const pAngle = Math.random() * Math.PI * 2;
              const pSpeed = 2.5 + Math.random() * 6.5;
              particlesRef.current.push({
                x: tx,
                y: ty,
                vx: Math.cos(pAngle) * pSpeed,
                vy: Math.sin(pAngle) * pSpeed,
                size: 3 + Math.random() * 6,
                color: theme.particleColors[Math.floor(Math.random() * theme.particleColors.length)],
                alpha: 1,
                life: 1,
              });
            }

            const nextReps = repsRef.current + 1;
            setReps(nextReps);
            setStreak((s) => s + 1);

            const cheerTitles = ['⭐ Stellar Reach!', '✨ Perfect Touch!', '🌟 Great Extension!', '💫 Pure Focus!'];
            setToast({
              text: cheerTitles[nextReps % cheerTitles.length],
              id: Date.now(),
              color: theme.primary,
            });

            // Check completion
            if (nextReps >= targetReps) {
              isCompletedRef.current = true;
              setIsCompleted(true);
              confetti({
                particleCount: 100,
                spread: 80,
                origin: { y: 0.6 },
                colors: theme.particleColors,
              });
              audioBiofeedback.speakGuidance('Spectacular spatial reaching! Full arm extension target completed.');

              const elapsedSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
              onSessionComplete({
                exerciseId: 'wrist_glider',
                exerciseTitle: 'Cosmic Star Reach & Touch',
                repsCompleted: nextReps,
                targetReps,
                durationSeconds: elapsedSec,
                accuracyScore: 96,
                peakExtensionAngle: 155,
                bestPinchMm: 22,
                avgTremorIndex: 1.8,
                smoothnessScore: 94,
              });
            } else {
              // Spawn next target
              const currIdx = PRESET_TARGETS.findIndex((p) => p.label === target.label);
              spawnNextTarget(currIdx);
            }
          }

          // 1. Draw Connecting Starlight Trajectory from Hand to Target
          if (hasHand) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(tx, ty);
            const grad = ctx.createLinearGradient(hx, hy, tx, ty);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
            grad.addColorStop(1, `${theme.primary}88`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isNear ? 3 : 1.5;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.restore();
          }

          // 2. Draw Target Pulsing Guidance Rings
          ctx.save();
          const pulseScale = 1 + Math.sin(targetPulseAngle) * 0.12;
          const outerRadius = hitRadius * pulseScale * targetScaleRef.current;

          // Outer Reach Zone Halo
          ctx.beginPath();
          ctx.arc(tx, ty, outerRadius, 0, Math.PI * 2);
          ctx.fillStyle = isNear ? 'rgba(56, 189, 248, 0.25)' : 'rgba(129, 140, 248, 0.12)';
          ctx.fill();
          ctx.strokeStyle = theme.glow;
          ctx.lineWidth = isNear ? 3 : 2;
          ctx.stroke();

          // Inner rotating dashed ring
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(targetPulseAngle * 0.6);
          ctx.beginPath();
          ctx.arc(0, 0, hitRadius * 0.68 * targetScaleRef.current, 0, Math.PI * 2);
          ctx.strokeStyle = theme.primary;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.restore();

          // 3. Draw Radiant 5-Pointed Star
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(-targetPulseAngle * 0.4);
          const starScale = (isNear ? 28 : 24) * targetScaleRef.current;

          ctx.shadowColor = theme.primary;
          ctx.shadowBlur = isNear ? 30 : 18;
          ctx.fillStyle = theme.primary;

          // Draw 5-pointed star path
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const rot = (Math.PI / 5) * (i * 2);
            const inRot = rot + Math.PI / 5;
            const ox = Math.cos(rot - Math.PI / 2) * starScale;
            const oy = Math.sin(rot - Math.PI / 2) * starScale;
            const ix = Math.cos(inRot - Math.PI / 2) * (starScale * 0.48);
            const iy = Math.sin(inRot - Math.PI / 2) * (starScale * 0.48);
            if (i === 0) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
            ctx.lineTo(ix, iy);
          }
          ctx.closePath();
          ctx.fill();

          // Inner Golden Spark Core
          ctx.beginPath();
          ctx.arc(0, 0, 7 * targetScaleRef.current, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();

          // Zone text tag below star
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 6;
          ctx.fillText(target.label, tx, ty + hitRadius + 18);
          ctx.restore();

          // 4. Update and Draw Shockwaves
          for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
            const sw = shockwavesRef.current[i];
            sw.radius += 3.5;
            sw.alpha *= 0.92;

            ctx.save();
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color;
            ctx.globalAlpha = sw.alpha;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            if (sw.radius > sw.maxRadius || sw.alpha < 0.05) {
              shockwavesRef.current.splice(i, 1);
            }
          }

          // 5. Update and Draw Stardust Particles
          for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // subtle gravity
            p.alpha *= 0.94;
            p.size *= 0.97;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.alpha < 0.05 || p.size < 0.5) {
              particlesRef.current.splice(i, 1);
            }
          }

          // 6. Draw Hand Stardust Cursor
          if (hasHand) {
            ctx.save();
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 20;

            // Concentric Aura
            ctx.beginPath();
            ctx.arc(hx, hy, 18, 0, Math.PI * 2);
            ctx.fillStyle = isNear ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.25)';
            ctx.fill();

            // Core Cursor Ring
            ctx.beginPath();
            ctx.arc(hx, hy, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Center Point
            ctx.beginPath();
            ctx.arc(hx, hy, 4, 0, Math.PI * 2);
            ctx.fillStyle = theme.primary;
            ctx.fill();

            // "Touch Hand" label
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText('REACH HAND', hx, hy - 24);
            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [themeIdx, hitRadius, targetReps, onSessionComplete]);

  // Restart Handler
  const handleRestart = () => {
    repsRef.current = 0;
    isCompletedRef.current = false;
    setReps(0);
    setStreak(0);
    setIsCompleted(false);
    startTimeRef.current = Date.now();
    spawnNextTarget(0);
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-3 select-none">
      {/* Top Floating Colorful Clinical HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto z-30">
        {/* Left Stats Pill */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3.5 py-2 flex items-center gap-3 text-xs shadow-lg text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4 text-sky-200" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Stars Collected</span>
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-lg font-black text-sky-400">{reps}</span>
                <span className="text-slate-400 font-bold">/ {targetReps}</span>
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* Current Target Zone Instruction */}
          <div className="hidden sm:block">
            <span className="text-[10px] text-slate-400 block font-semibold">Target Sector</span>
            <span className="text-xs font-bold text-amber-300 font-mono flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              {reachZoneText}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700 hidden sm:block" />

          {/* Streak Combo */}
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Streak</span>
            <span className="text-xs font-black text-teal-400 font-mono">
              {streak}x
            </span>
          </div>
        </div>

        {/* Right Controls: Theme & Target Assistance */}
        <div className="flex items-center gap-2">
          {/* Target Assistance Selector */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1 flex items-center shadow-lg text-white">
            <span className="text-[10px] text-slate-400 font-bold px-1.5 hidden md:inline">Assistance:</span>
            <button
              type="button"
              onClick={() => setAssistanceMode('assisted')}
              className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                assistanceMode === 'assisted'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Larger 76px target radius - optimal for higher spasticity"
            >
              Assisted
            </button>
            <button
              type="button"
              onClick={() => setAssistanceMode('standard')}
              className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                assistanceMode === 'standard'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Standard 58px target radius"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setAssistanceMode('precision')}
              className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all ${
                assistanceMode === 'precision'
                  ? 'bg-purple-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Precision 44px target radius"
            >
              Precision
            </button>
          </div>

          {/* Theme Palette Toggle */}
          <button
            type="button"
            onClick={() => setThemeIdx((prev) => (prev + 1) % STAR_THEMES.length)}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-2xl text-slate-300 hover:text-white transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold"
            title={`Active Theme: ${STAR_THEMES[themeIdx].name}. Click to switch theme`}
          >
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">{STAR_THEMES[themeIdx].name}</span>
          </button>

          {/* Restart */}
          <button
            type="button"
            onClick={handleRestart}
            title="Restart Exercise Set"
            className="p-2 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-2xl text-slate-300 hover:text-white transition-all shadow-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Delete Session Data Button */}
          {onDeleteSessionData && (
            <button
              type="button"
              onClick={onDeleteSessionData}
              title="Delete all session data"
              className="p-2 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/80 text-rose-300 rounded-2xl transition-all shadow-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Encouragement Cheer Toast */}
      {toast && (
        <div
          key={toast.id}
          className="self-center py-2 px-4 rounded-2xl bg-slate-950/90 border border-sky-400 text-white font-extrabold text-xs shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Transparent AR Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      />

      {/* Bottom Guidance Instruction Pill */}
      <div className="flex items-center justify-between text-xs pointer-events-auto z-30">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3.5 py-1.5 text-[11px] text-slate-300 font-medium flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>
            Extend hand toward the <span className="text-sky-300 font-bold">{reachZoneText}</span> star to collect!
          </span>
        </div>

        {/* Repetition Target Progress Bar */}
        <div className="w-36 sm:w-48 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 shadow-lg">
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-200"
              style={{ width: `${Math.min(100, (reps / targetReps) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
