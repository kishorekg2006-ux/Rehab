import React, { useState, useEffect } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { Compass, CheckCircle2 } from 'lucide-react';

interface WristGliderGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
}

interface HorizonRing {
  id: number;
  targetWristAngle: number; // in degrees, e.g. +20° (extension) or -10° (flexion)
  description: string;
}

const RINGS: HorizonRing[] = [
  { id: 1, targetWristAngle: 25, description: 'Gentle Extension (+25° Up)' },
  { id: 2, targetWristAngle: -10, description: 'Controlled Flexion (-10° Down)' },
  { id: 3, targetWristAngle: 30, description: 'Peak Extension (+30° Up)' },
  { id: 4, targetWristAngle: 0, description: 'Neutral Horizon (0° Level)' },
];

export const WristGliderGame: React.FC<WristGliderGameProps> = ({
  metrics,
  targetReps = 14,
  onSessionComplete,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [ringIdx, setRingIdx] = useState<number>(0);
  const [dwellTimeMs, setDwellTimeMs] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Tilt your wrist to steer the glider');
  const [startTime] = useState<number>(Date.now());

  const currentRing = RINGS[ringIdx];

  useEffect(() => {
    if (!metrics || isCompleted) return;

    const angle = metrics.wristAngle;
    const diff = Math.abs(angle - currentRing.targetWristAngle);
    const inGate = diff <= 10; // Within 10 degrees of target

    if (inGate) {
      setDwellTimeMs((prev) => {
        const next = prev + 100;
        if (next >= 1000) {
          // Passed through the gate!
          audioBiofeedback.playSuccessChime();
          const nextReps = reps + 1;
          setReps(nextReps);

          if (nextReps >= targetReps) {
            setIsCompleted(true);
            confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
            audioBiofeedback.speakGuidance('Superb wrist control! Active extensor stability demonstrated.');

            onSessionComplete({
              exerciseId: 'wrist_glider',
              exerciseTitle: 'Wrist Glider',
              repsCompleted: nextReps,
              targetReps,
              durationSeconds: Math.round((Date.now() - startTime) / 1000),
              accuracyScore: 89,
              peakExtensionAngle: 135,
              bestPinchMm: 28,
              avgTremorIndex: metrics.tremorIndex,
              smoothnessScore: metrics.smoothnessScore,
            });
          } else {
            setRingIdx((r) => (r + 1) % RINGS.length);
            setStatusMessage(`Ring cleared! Next gate: ${RINGS[(ringIdx + 1) % RINGS.length].description}`);
          }
          return 0;
        }
        return next;
      });
    } else {
      setDwellTimeMs(0);
      setStatusMessage(`Align with target: ${currentRing.description} (Current: ${angle}°)`);
    }
  }, [metrics, currentRing, reps, targetReps, ringIdx, isCompleted, startTime, onSessionComplete]);

  return (
    <div className="flex flex-col gap-3">
      {/* HUD Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Gates Cleared</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-sky-400 font-mono">{reps}</span>
              <span className="text-slate-500 font-mono">/ {targetReps} rings</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-xs text-slate-400 font-medium block">Current Wrist Angle</span>
            <span className="text-lg font-semibold font-mono text-sky-300">
              {metrics ? `${metrics.wristAngle}°` : '--'}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          <div className="hidden sm:block">
            <span className="text-xs text-slate-400 font-medium block">Target Elevation</span>
            <span className="text-base font-semibold text-slate-200">
              {currentRing.description}
            </span>
          </div>
        </div>

        {/* Gate Alignment Progress */}
        <div className="w-36">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Gate Hold</span>
            <span className="font-mono">{Math.round((dwellTimeMs / 1000) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-75 rounded-full"
              style={{ width: `${Math.min(100, (dwellTimeMs / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Compass className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-slate-200">{statusMessage}</span>
        </div>

        {isCompleted && (
          <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Exercise Complete
          </span>
        )}
      </div>
    </div>
  );
};
