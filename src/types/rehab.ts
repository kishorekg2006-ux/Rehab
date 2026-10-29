export interface LandmarkPoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z?: number;
}

export type HandLandmarks = LandmarkPoint[];

export interface FingerAngles {
  thumb: number;   // In degrees (0 - 90)
  index: number;   // In degrees (0 - 180)
  middle: number;  // In degrees (0 - 180)
  ring: number;    // In degrees (0 - 180)
  pinky: number;   // In degrees (0 - 180)
}

export interface HandMetrics {
  pinchAperture: number; // distance between thumb tip and index tip in mm (approx)
  isPinching: boolean;
  pinchPurity: number; // 0-100% how clean the pinch is
  pinchHoldDuration: number; // ms
  fingerExtensionAngles: FingerAngles;
  avgFingerExtension: number; // average degrees of all fingers
  handOpenRatio: number; // 0 - 100%
  wristAngle: number; // -90° to +90° (flexion/extension)
  wristDeviation: number; // radial / ulnar deviation
  tremorIndex: number; // 0 - 10 scale (lower is smoother)
  smoothnessScore: number; // 0 - 100%
  compensationWarning: string | null;
  detectedHand: 'left' | 'right' | null;
}

export type ExerciseId = 'fruit_catcher' | 'pinch_harvest' | 'finger_isolation' | 'lotus_bloom' | 'wrist_glider';

export type FruitColorTheme = 'all' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export interface FallingFruit {
  id: number;
  x: number; // 0-1
  y: number; // 0-1
  speed: number;
  colorName: string;
  themeColor: FruitColorTheme;
  hex: string;
  glowColor: string;
  name: string;
  emoji: string;
  size: number;
  caught: boolean;
}

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  category:
    | 'Gross Grasp & Hand Coordination'
    | 'Fine Motor & Pinch'
    | 'Finger Isolation & Dexterity'
    | 'Extensor Tone & Spasticity'
    | 'Wrist Stability & ROM'
    | 'Spatial Reach & Upper Limb Extension';
  clinicalGoal: string;
  description: string;
  instructions: string[];
  recommendedReps: number;
  durationTargetMinutes: number;
  iconName: string;
  focusMuscles: string;
}

export interface ExerciseSettings {
  targetReps: number;
  pinchThresholdMm: number;
  holdTimeSeconds: number;
  bloomOpenThreshold: number; // percentage (e.g. 70%)
  wristAngleTargetDeg: number;
  restReminderInterval: number; // reps before encouraging relaxation
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  exerciseId: ExerciseId;
  exerciseTitle: string;
  durationSeconds: number;
  repsCompleted: number;
  targetReps: number;
  accuracyScore: number; // 0-100%
  peakExtensionAngle: number;
  bestPinchMm: number;
  avgTremorIndex: number;
  smoothnessScore: number;
  affectedHand: 'left' | 'right';
  therapistFeedback?: string;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  phoneNumber?: string;
  condition?: string; // Type of disease / disorder / case
  affectedSide: 'left' | 'right';
  strokeDate?: string;
  brunnstromStage: 2 | 3 | 4 | 5 | 6; // Clinical stroke recovery stage
  dailyTargetSessions: number;
  streakDays: number;
  totalTherapyMinutes: number;
  prescriptions: Record<ExerciseId, {
    enabled: boolean;
    targetReps: number;
    difficulty: 'gentle' | 'standard' | 'challenge';
    customHoldTime: number;
  }>;
  therapistNotes: string;
}

