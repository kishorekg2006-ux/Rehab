import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { Flower2, CheckCircle2 } from 'lucide-react';

interface LotusBloomGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  bloomThresholdPercent?: number; // e.g., 65-75%
  holdTimeRequired?: number; // seconds to hold open
  onSessionComplete: (record: Partial<SessionRecord>) => void;
}

export const LotusBloomGame: React.FC<LotusBloomGameProps> = ({
  metrics,
  targetReps = 12,
  bloomThresholdPercent = 65,
  holdTimeRequired = 2.0,
  onSessionComplete,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [phase, setPhase] = useState<'open_stretch' | 'holding_open' | 'relaxing' | 'completed'>('open_stretch');
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [peakExtension, setPeakExtension] = useState<number>(110);
  const [statusMessage, setStatusMessage] = useState<string>('Spread all five fingers as wide as you can');
  const [startTime] = useState<number>(Date.now());

  const holdStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!metrics || phase === 'completed') return;

    if (metrics.avgFingerExtension > peakExtension) {
      setPeakExtension(metrics.avgFingerExtension);
    }

    const openRatio = metrics.handOpenRatio;
    const isOpenEnough = openRatio >= bloomThresholdPercent;
    const now = performance.now();

    if (phase === 'open_stretch') {
      if (isOpenEnough) {
        setPhase('holding_open');
        holdStartRef.current = now;
        audioBiofeedback.playHoldTone(0.3);
        setStatusMessage('Lotus blooming! Hold fingers extended wide...');
      } else {
        setStatusMessage(`Open fingers wider (Current: ${openRatio}%, Target: ${bloomThresholdPercent}%)`);
      }
    } else if (phase === 'holding_open') {
      if (!isOpenEnough) {
        // Hand closed too soon
        setPhase('open_stretch');
        holdStartRef.current = null;
        setHoldProgress(0);
        setStatusMessage('Stretch released early. Try to open wide again!');
        return;
      }

      if (holdStartRef.current) {
        const elapsed = (now - holdStartRef.current) / 1000;
        const progress = Math.min(1, elapsed / holdTimeRequired);
        setHoldProgress(progress);
        audioBiofeedback.playHoldTone(progress);

        if (progress >= 1) {
          setPhase('relaxing');
          holdStartRef.current = null;
          audioBiofeedback.playSuccessChime();
          setStatusMessage('Full bloom achieved! Now relax your hand to complete rep.');
        }
      }
    } else if (phase === 'relaxing') {
      // Return to resting position (open ratio < 45%)
      if (openRatio <= 45) {
        const nextReps = reps + 1;
        setReps(nextReps);

        if (nextReps >= targetReps) {
          setPhase('completed');
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
          audioBiofeedback.speakGuidance('Incredible stretch! Spastic flexor tone reduced.');

          onSessionComplete({
            exerciseId: 'lotus_bloom',
            exerciseTitle: 'Lotus Bloom & Release',
            repsCompleted: nextReps,
            targetReps,
            durationSeconds: Math.round((Date.now() - startTime) / 1000),
            accuracyScore: 92,
            peakExtensionAngle: Math.round(peakExtension),
            bestPinchMm: 30,
            avgTremorIndex: metrics.tremorIndex,
            smoothnessScore: metrics.smoothnessScore,
          });
        } else {
          setPhase('open_stretch');
          setHoldProgress(0);
          setStatusMessage('Ready for next rep: Open your hand wide again');
        }
      }
    }
  }, [metrics, phase, reps, targetReps, bloomThresholdPercent, holdTimeRequired, peakExtension, startTime, onSessionComplete]);

  return (
    <div className="flex flex-col gap-3">
      {/* HUD Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Reps</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-teal-400 font-mono">{reps}</span>
              <span className="text-slate-500 font-mono">/ {targetReps} reps</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-xs text-slate-400 font-medium block">Hand Open Ratio</span>
            <span className="text-lg font-semibold font-mono text-slate-200">
              {metrics ? `${metrics.handOpenRatio}%` : '--'}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          <div className="hidden sm:block">
            <span className="text-xs text-slate-400 font-medium block">Peak Active Extension</span>
            <span className="text-lg font-semibold font-mono text-teal-300">
              {Math.round(peakExtension)}°
            </span>
          </div>
        </div>

        {/* Lotus Bloom Hold Progress */}
        <div className="w-40">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Sustained Stretch</span>
            <span className="font-mono">{Math.round(holdProgress * 100)}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 transition-all duration-75 rounded-full"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Flower2 className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-medium text-slate-200">{statusMessage}</span>
        </div>

        {phase === 'completed' && (
          <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Exercise Complete
          </span>
        )}
      </div>
    </div>
  );
};
