import React, { useState, useEffect, useRef } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { LM } from '../../utils/kinematics';
import { CheckCircle2, Clock, Trophy, RotateCcw, AlertTriangle } from 'lucide-react';

interface PinchHarvestGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  holdTimeRequired: number; // in seconds
  pinchThresholdMm: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
}

interface TargetFruit {
  id: number;
  x: number; // 0 - 1
  y: number; // 0 - 1
  name: string;
  color: string;
}

export const PinchHarvestGame: React.FC<PinchHarvestGameProps> = ({
  metrics,
  landmarks,
  targetReps = 15,
  holdTimeRequired = 1.2,
  pinchThresholdMm = 30,
  onSessionComplete,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [state, setState] = useState<'seeking' | 'holding' | 'carrying' | 'completed'>('seeking');
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 1
  const [currentFruit, setCurrentFruit] = useState<TargetFruit>({
    id: 1,
    x: 0.5,
    y: 0.38,
    name: 'Golden Pear',
    color: '#eab308',
  });
  const [feedbackMsg, setFeedbackMsg] = useState<string>('Bring thumb and index finger to the fruit');
  const [startTime] = useState<number>(Date.now());
  const [bestPinch, setBestPinch] = useState<number>(99);
  const [tremorSamples, setTremorSamples] = useState<number[]>([]);

  const holdStartRef = useRef<number | null>(null);

  // Generate new target position within functional stroke reach zone
  const spawnNextFruit = () => {
    const fruits = [
      { name: 'Golden Pear', color: '#eab308' },
      { name: 'Ruby Apple', color: '#f43f5e' },
      { name: 'Emerald Fig', color: '#10b981' },
      { name: 'Sapphire Plum', color: '#6366f1' },
    ];
    const chosen = fruits[Math.floor(Math.random() * fruits.length)];
    // Random position in ergonomic upper/middle field
    const rx = 0.35 + Math.random() * 0.3;
    const ry = 0.3 + Math.random() * 0.25;

    setCurrentFruit({
      id: Date.now(),
      x: rx,
      y: ry,
      name: chosen.name,
      color: chosen.color,
    });
    setState('seeking');
    setHoldProgress(0);
    holdStartRef.current = null;
    setFeedbackMsg('Target the next fruit with your fingertips');
  };

  // Main game loop driven by incoming hand metrics
  useEffect(() => {
    if (!metrics || !landmarks || state === 'completed') return;

    // Track best pinch aperture
    if (metrics.pinchAperture > 0 && metrics.pinchAperture < bestPinch) {
      setBestPinch(metrics.pinchAperture);
    }
    if (metrics.tremorIndex) {
      setTremorSamples((prev) => [...prev.slice(-40), metrics.tremorIndex]);
    }

    const thumbTip = landmarks[LM.THUMB_TIP];
    const indexTip = landmarks[LM.INDEX_TIP];
    const pinchMidX = (thumbTip.x + indexTip.x) / 2;
    const pinchMidY = (thumbTip.y + indexTip.y) / 2;

    const distToFruit = Math.hypot(pinchMidX - currentFruit.x, pinchMidY - currentFruit.y);
    const isOverFruit = distToFruit < 0.14; // in target reach radius
    const isPinching = metrics.pinchAperture <= pinchThresholdMm;

    const now = performance.now();

    if (state === 'seeking') {
      if (isOverFruit && isPinching) {
        setState('holding');
        holdStartRef.current = now;
        audioBiofeedback.playHoldTone(0.2);
        setFeedbackMsg('Hold pinch steady...');
      } else if (isOverFruit) {
        setFeedbackMsg('Close thumb and index tips together');
      } else {
        setFeedbackMsg('Move your hand toward the target fruit');
      }
    } else if (state === 'holding') {
      if (!isPinching) {
        // Lost pinch early
        setState('seeking');
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedbackMsg('Pinch released too early. Try again!');
        return;
      }

      if (holdStartRef.current) {
        const elapsed = (now - holdStartRef.current) / 1000;
        const progress = Math.min(1, elapsed / holdTimeRequired);
        setHoldProgress(progress);
        audioBiofeedback.playHoldTone(progress);

        if (progress >= 1) {
          setState('carrying');
          holdStartRef.current = null;
          audioBiofeedback.playSuccessChime();
          setFeedbackMsg('Fruit grasped! Now open your hand to harvest');
        }
      }
    } else if (state === 'carrying') {
      // Releasing requires opening aperture > 45mm to combat flexor spasticity!
      if (metrics.pinchAperture >= 42 || metrics.handOpenRatio > 55) {
        audioBiofeedback.playSuccessChime();
        const nextReps = reps + 1;
        setReps(nextReps);

        if (nextReps >= targetReps) {
          setState('completed');
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
          audioBiofeedback.speakGuidance('Target achieved! Excellent fine motor pinch control.');

          const avgTremor =
            tremorSamples.length > 0
              ? tremorSamples.reduce((a, b) => a + b, 0) / tremorSamples.length
              : metrics.tremorIndex;

          onSessionComplete({
            exerciseId: 'pinch_harvest',
            exerciseTitle: 'Pinch & Harvest',
            repsCompleted: nextReps,
            targetReps,
            durationSeconds: Math.round((Date.now() - startTime) / 1000),
            accuracyScore: Math.min(100, Math.round(90 - avgTremor * 3)),
            bestPinchMm: Math.round(bestPinch),
            peakExtensionAngle: metrics.avgFingerExtension,
            avgTremorIndex: Math.round(avgTremor * 10) / 10,
            smoothnessScore: metrics.smoothnessScore,
          });
        } else {
          spawnNextFruit();
        }
      } else {
        setFeedbackMsg('Open your fingers wide to drop fruit in basket');
      }
    }
  }, [metrics, landmarks, state, currentFruit, reps, targetReps, holdTimeRequired, pinchThresholdMm, bestPinch, tremorSamples, startTime, onSessionComplete]);

  return (
    <div className="flex flex-col gap-3">
      {/* Game HUD Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Progress</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-amber-400 font-mono">{reps}</span>
              <span className="text-slate-500 font-mono">/ {targetReps} reps</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-xs text-slate-400 font-medium block">Pinch Aperture</span>
            <span className="text-lg font-semibold font-mono text-slate-200">
              {metrics ? `${metrics.pinchAperture} mm` : '--'}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          <div className="hidden sm:block">
            <span className="text-xs text-slate-400 font-medium block">Best Pincer Grip</span>
            <span className="text-lg font-semibold font-mono text-emerald-400">
              {bestPinch < 90 ? `${bestPinch} mm` : '--'}
            </span>
          </div>
        </div>

        {/* Real-time isometric hold meter */}
        <div className="flex items-center gap-3">
          <div className="w-36">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Isometric Hold</span>
              <span className="font-mono">{Math.round(holdProgress * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75 rounded-full"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Target & Feedback Overlay Notice */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: currentFruit.color }}
          />
          <span className="text-sm font-medium text-slate-200">{feedbackMsg}</span>
        </div>

        {state === 'completed' && (
          <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Set Finished
          </span>
        )}
      </div>
    </div>
  );
};
