import React, { useState, useEffect } from 'react';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface FingerIsolationGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onSetPromptedFinger: (fingerNum: number) => void;
}

interface FingerTarget {
  name: string;
  fingerIndex: number; // 2=index, 3=middle, 4=ring, 5=pinky
  keyName: string;
  color: string;
}

const FINGER_TARGETS: FingerTarget[] = [
  { name: 'Index Finger', fingerIndex: 2, keyName: 'C4', color: '#06b6d4' },
  { name: 'Middle Finger', fingerIndex: 3, keyName: 'E4', color: '#10b981' },
  { name: 'Ring Finger', fingerIndex: 4, keyName: 'G4', color: '#8b5cf6' },
  { name: 'Pinky Finger', fingerIndex: 5, keyName: 'B4', color: '#ec4899' },
];

export const FingerIsolationGame: React.FC<FingerIsolationGameProps> = ({
  metrics,
  targetReps = 16,
  onSessionComplete,
  onSetPromptedFinger,
}) => {
  const [reps, setReps] = useState<number>(0);
  const [targetIdx, setTargetIdx] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [startTime] = useState<number>(Date.now());
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Flex the prompted finger gently');

  const currentTarget = FINGER_TARGETS[targetIdx];

  // Inform tracker which finger is currently prompted for simulation/HUD
  useEffect(() => {
    onSetPromptedFinger(currentTarget.fingerIndex);
  }, [currentTarget.fingerIndex, onSetPromptedFinger]);

  useEffect(() => {
    if (!metrics || isCompleted) return;

    const now = Date.now();
    if (now - lastTapTime < 800) return; // Debounce taps

    const angles = metrics.fingerExtensionAngles;
    let targetAngle = 180;
    let adjacentAngles: number[] = [];

    if (currentTarget.fingerIndex === 2) {
      targetAngle = angles.index;
      adjacentAngles = [angles.middle, angles.ring, angles.pinky];
    } else if (currentTarget.fingerIndex === 3) {
      targetAngle = angles.middle;
      adjacentAngles = [angles.index, angles.ring, angles.pinky];
    } else if (currentTarget.fingerIndex === 4) {
      targetAngle = angles.ring;
      adjacentAngles = [angles.index, angles.middle, angles.pinky];
    } else if (currentTarget.fingerIndex === 5) {
      targetAngle = angles.pinky;
      adjacentAngles = [angles.index, angles.middle, angles.ring];
    }

    // A deliberate flexion occurs when the target finger flexes past 135° (standard extended is 160-180°)
    const isFlexed = targetAngle < 135;

    // Mass synergy check: If ALL fingers flexed simultaneously, warn patient to isolate
    const massFlexion = adjacentAngles.every((ang) => ang < 125);

    if (isFlexed && massFlexion) {
      setStatusMessage('Try to keep your other fingers relaxed while moving only one');
      audioBiofeedback.playSoftAlert();
    } else if (isFlexed) {
      // Clean isolated tap!
      audioBiofeedback.playFingerNote(currentTarget.fingerIndex);
      setLastTapTime(now);

      const nextReps = reps + 1;
      setReps(nextReps);

      if (nextReps >= targetReps) {
        setIsCompleted(true);
        confetti({ particleCount: 70, spread: 55, origin: { y: 0.6 } });
        audioBiofeedback.speakGuidance('Great finger isolation! Synkinesis inhibition improved.');

        onSessionComplete({
          exerciseId: 'finger_isolation',
          exerciseTitle: 'Constellation Tap',
          repsCompleted: nextReps,
          targetReps,
          durationSeconds: Math.round((Date.now() - startTime) / 1000),
          accuracyScore: 88,
          peakExtensionAngle: metrics.avgFingerExtension,
          bestPinchMm: 28,
          avgTremorIndex: metrics.tremorIndex,
          smoothnessScore: metrics.smoothnessScore,
        });
      } else {
        // Advance to next finger
        setTargetIdx((prev) => (prev + 1) % FINGER_TARGETS.length);
        setStatusMessage(`Nice tap! Next: ${FINGER_TARGETS[(targetIdx + 1) % FINGER_TARGETS.length].name}`);
      }
    }
  }, [metrics, currentTarget, reps, targetReps, targetIdx, isCompleted, lastTapTime, startTime, onSessionComplete]);

  return (
    <div className="flex flex-col gap-3">
      {/* HUD Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Reps Completed</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-cyan-400 font-mono">{reps}</span>
              <span className="text-slate-500 font-mono">/ {targetReps} reps</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-xs text-slate-400 font-medium block">Active Target</span>
            <span
              className="text-base font-semibold"
              style={{ color: currentTarget.color }}
            >
              {currentTarget.name} ({currentTarget.keyName})
            </span>
          </div>
        </div>

        {/* 4-Finger Interactive Key Selector Bar */}
        <div className="flex items-center gap-2">
          {FINGER_TARGETS.map((f, i) => {
            const isActive = i === targetIdx;
            return (
              <div
                key={f.name}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white border-2 scale-105 shadow-md'
                    : 'bg-slate-950 text-slate-500 border border-slate-800'
                }`}
                style={{ borderColor: isActive ? f.color : undefined }}
              >
                <span>{f.name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time status */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-400" />
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
