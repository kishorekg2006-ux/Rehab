import { PatientProfile, SessionRecord, ExerciseId } from '../types/rehab';

const STORAGE_KEY_PROFILE = 'neurohand_patient_profile_v1';
const STORAGE_KEY_SESSIONS = 'neurohand_patient_sessions_v1';

export const INITIAL_PATIENT_PROFILE: PatientProfile = {
  id: 'pt-8821',
  fullName: 'Eleanor Vance',
  affectedSide: 'right',
  strokeDate: '2026-04-12',
  brunnstromStage: 4, // Stage 4: Spasticity begins to decline, isolated movements emerging
  dailyTargetSessions: 3,
  streakDays: 6,
  totalTherapyMinutes: 142,
  prescriptions: {
    pinch_harvest: {
      enabled: true,
      targetReps: 15,
      difficulty: 'standard',
      customHoldTime: 1.2,
    },
    finger_isolation: {
      enabled: true,
      targetReps: 16,
      difficulty: 'gentle',
      customHoldTime: 0.8,
    },
    lotus_bloom: {
      enabled: true,
      targetReps: 12,
      difficulty: 'standard',
      customHoldTime: 2.0,
    },
    wrist_glider: {
      enabled: true,
      targetReps: 14,
      difficulty: 'standard',
      customHoldTime: 1.5,
    },
  },
  therapistNotes:
    'Patient exhibits mild-to-moderate flexor hypertonia in right finger flexors. Good voluntary shoulder and elbow control. Primary focus is isolated index/thumb opposition and active MCP/PIP extension past 130° without compensatory shoulder hike.',
};

// Seed 7 days of previous realistic clinical sessions showing genuine neuroplasticity recovery curves
export const SEED_SESSIONS: SessionRecord[] = [
  {
    id: 'sess-101',
    timestamp: Date.now() - 6 * 86400000,
    exerciseId: 'lotus_bloom',
    exerciseTitle: 'Lotus Bloom & Release',
    durationSeconds: 240,
    repsCompleted: 10,
    targetReps: 12,
    accuracyScore: 68,
    peakExtensionAngle: 118,
    bestPinchMm: 38,
    avgTremorIndex: 4.2,
    smoothnessScore: 65,
    affectedHand: 'right',
    therapistFeedback: 'Good effort. Noted mild fatigue after rep 7.',
  },
  {
    id: 'sess-102',
    timestamp: Date.now() - 5 * 86400000,
    exerciseId: 'pinch_harvest',
    exerciseTitle: 'Pinch & Harvest',
    durationSeconds: 280,
    repsCompleted: 12,
    targetReps: 15,
    accuracyScore: 72,
    peakExtensionAngle: 122,
    bestPinchMm: 32,
    avgTremorIndex: 3.8,
    smoothnessScore: 71,
    affectedHand: 'right',
    therapistFeedback: 'Pinch grasp timing improving.',
  },
  {
    id: 'sess-103',
    timestamp: Date.now() - 4 * 86400000,
    exerciseId: 'finger_isolation',
    exerciseTitle: 'Constellation Tap',
    durationSeconds: 310,
    repsCompleted: 14,
    targetReps: 16,
    accuracyScore: 76,
    peakExtensionAngle: 128,
    bestPinchMm: 29,
    avgTremorIndex: 3.4,
    smoothnessScore: 75,
    affectedHand: 'right',
    therapistFeedback: 'Index and middle isolation showing strong activation.',
  },
  {
    id: 'sess-104',
    timestamp: Date.now() - 3 * 86400000,
    exerciseId: 'wrist_glider',
    exerciseTitle: 'Wrist Glider',
    durationSeconds: 300,
    repsCompleted: 14,
    targetReps: 14,
    accuracyScore: 82,
    peakExtensionAngle: 132,
    bestPinchMm: 27,
    avgTremorIndex: 2.9,
    smoothnessScore: 80,
    affectedHand: 'right',
    therapistFeedback: 'Smooth flight path. Minimal compensatory shoulder elevation.',
  },
  {
    id: 'sess-105',
    timestamp: Date.now() - 2 * 86400000,
    exerciseId: 'lotus_bloom',
    exerciseTitle: 'Lotus Bloom & Release',
    durationSeconds: 260,
    repsCompleted: 12,
    targetReps: 12,
    accuracyScore: 85,
    peakExtensionAngle: 142,
    bestPinchMm: 26,
    avgTremorIndex: 2.6,
    smoothnessScore: 84,
    affectedHand: 'right',
    therapistFeedback: 'Peak extension crossed 140°! Significant spasticity reduction.',
  },
  {
    id: 'sess-106',
    timestamp: Date.now() - 1 * 86400000,
    exerciseId: 'pinch_harvest',
    exerciseTitle: 'Pinch & Harvest',
    durationSeconds: 320,
    repsCompleted: 15,
    targetReps: 15,
    accuracyScore: 90,
    peakExtensionAngle: 148,
    bestPinchMm: 24,
    avgTremorIndex: 2.2,
    smoothnessScore: 88,
    affectedHand: 'right',
    therapistFeedback: 'Excellent pincer aperture and sustained isometric hold.',
  },
];

export function loadPatientProfile(): PatientProfile {
  if (typeof window === 'undefined') return INITIAL_PATIENT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load patient profile from storage', e);
  }
  return INITIAL_PATIENT_PROFILE;
}

export function savePatientProfile(profile: PatientProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save patient profile to storage', e);
  }
}

export function loadSessionRecords(): SessionRecord[] {
  if (typeof window === 'undefined') return SEED_SESSIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load sessions from storage', e);
  }
  return SEED_SESSIONS;
}

export function saveSessionRecord(session: SessionRecord): SessionRecord[] {
  const current = loadSessionRecords();
  const updated = [session, ...current];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
      // Also update total therapy minutes in profile
      const profile = loadPatientProfile();
      profile.totalTherapyMinutes += Math.round(session.durationSeconds / 60);
      savePatientProfile(profile);
    } catch (e) {
      console.error('Failed to save session record to storage', e);
    }
  }
  return updated;
}
