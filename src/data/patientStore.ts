import { PatientProfile, SessionRecord, ExerciseId } from '../types/rehab';

const STORAGE_KEY_PROFILE = 'neurohand_patient_profile_v1';
const STORAGE_KEY_SESSIONS = 'neurohand_patient_sessions_v1';

export const INITIAL_BASELINE_SESSIONS: SessionRecord[] = [
  {
    id: 'sess-baseline-01',
    timestamp: Date.now() - 2 * 86400000,
    exerciseId: 'fruit_catcher',
    exerciseTitle: 'Fruit Drop & Catch',
    durationSeconds: 240, // 4 mins
    repsCompleted: 15,
    targetReps: 15,
    accuracyScore: 92,
    peakExtensionAngle: 132,
    bestPinchMm: 28,
    avgTremorIndex: 2.8,
    smoothnessScore: 84,
    affectedHand: 'right',
    therapistFeedback: 'Target reached with good motor control.',
  },
  {
    id: 'sess-baseline-02',
    timestamp: Date.now() - 1 * 86400000,
    exerciseId: 'pinch_harvest',
    exerciseTitle: 'Pinch & Fruit Harvest',
    durationSeconds: 220, // 3m 40s
    repsCompleted: 15,
    targetReps: 15,
    accuracyScore: 94,
    peakExtensionAngle: 138,
    bestPinchMm: 24,
    avgTremorIndex: 2.3,
    smoothnessScore: 88,
    affectedHand: 'right',
    therapistFeedback: 'Isometric pinch hold held steadily.',
  },
];

export const INITIAL_PATIENT_PROFILE: PatientProfile = {
  id: 'pt-8821',
  fullName: 'Eleanor Vance',
  phoneNumber: '+1 (555) 839-2019',
  condition: 'Stroke / Hemiparesis',
  affectedSide: 'right',
  strokeDate: '2026-04-12',
  brunnstromStage: 4, // Stage 4: Spasticity declines, selective finger movement emerging
  dailyTargetSessions: 3,
  streakDays: 4,
  totalTherapyMinutes: 8, // Accurately matches 240s + 220s = 460s (8 mins) baseline
  prescriptions: {
    fruit_catcher: {
      enabled: true,
      targetReps: 15,
      difficulty: 'standard',
      customHoldTime: 0.5,
    },
    pinch_harvest: {
      enabled: true,
      targetReps: 15,
      difficulty: 'standard',
      customHoldTime: 1.0,
    },
    finger_isolation: {
      enabled: true,
      targetReps: 16,
      difficulty: 'standard',
      customHoldTime: 0.8,
    },
    lotus_bloom: {
      enabled: true,
      targetReps: 12,
      difficulty: 'standard',
      customHoldTime: 1.8,
    },
    wrist_glider: {
      enabled: true,
      targetReps: 14,
      difficulty: 'standard',
      customHoldTime: 1.5,
    },
  },
  therapistNotes:
    'Patient demonstrates right upper-limb hemiparesis. Focus on active finger extension past 135° and controlled pincer grasp opposition.',
};

/**
 * Calculates total seconds across all session records accurately
 */
export function calculateTotalTherapySeconds(sessions: SessionRecord[]): number {
  return sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
}

/**
 * Calculates total whole minutes rounded accurately
 */
export function calculateTotalTherapyMinutes(sessions: SessionRecord[]): number {
  const totalSec = calculateTotalTherapySeconds(sessions);
  return Math.round(totalSec / 60);
}

/**
 * Human-friendly format for rehabilitation duration (e.g. "45s", "3m 20s", "14 mins")
 */
export function formatRehabDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) {
    return `${s}s`;
  }
  const mins = Math.floor(s / 60);
  const remSec = s % 60;
  if (remSec === 0) {
    return `${mins}m`;
  }
  return `${mins}m ${remSec}s`;
}

export function loadPatientProfile(): PatientProfile {
  if (typeof window === 'undefined') return INITIAL_PATIENT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) {
      const parsed: PatientProfile = JSON.parse(raw);
      // Ensure totalTherapyMinutes accurately reflects stored sessions
      const sessions = loadSessionRecords();
      parsed.totalTherapyMinutes = calculateTotalTherapyMinutes(sessions);
      return parsed;
    }
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

export const getPatientProfile = loadPatientProfile;

export function loadSessionRecords(): SessionRecord[] {
  if (typeof window === 'undefined') return INITIAL_BASELINE_SESSIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (raw !== null) {
      return JSON.parse(raw);
    }
    // First time ever visiting: seed initial baseline and persist
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(INITIAL_BASELINE_SESSIONS));
    return INITIAL_BASELINE_SESSIONS;
  } catch (e) {
    console.error('Failed to load sessions from storage', e);
  }
  return INITIAL_BASELINE_SESSIONS;
}

export const getSessionRecords = loadSessionRecords;

export function saveSessionRecord(session: SessionRecord): SessionRecord[] {
  const current = loadSessionRecords();
  const updated = [session, ...current];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
      const profile = loadPatientProfile();
      // Dynamically calculate accurate total therapy minutes from all sessions
      profile.totalTherapyMinutes = calculateTotalTherapyMinutes(updated);
      savePatientProfile(profile);
    } catch (e) {
      console.error('Failed to save session record to storage', e);
    }
  }
  return updated;
}

export function deleteSessionRecord(sessionId: string): SessionRecord[] {
  const current = loadSessionRecords();
  const updated = current.filter((s) => s.id !== sessionId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
      // Recompute total minutes to accurately match remaining sessions
      const profile = loadPatientProfile();
      profile.totalTherapyMinutes = calculateTotalTherapyMinutes(updated);
      savePatientProfile(profile);
    } catch (e) {
      console.error('Failed to delete session record from storage', e);
    }
  }
  return updated;
}

export function clearAllSessionRecords(): SessionRecord[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify([]));
      const profile = loadPatientProfile();
      profile.totalTherapyMinutes = 0;
      savePatientProfile(profile);
    } catch (e) {
      console.error('Failed to clear session records from storage', e);
    }
  }
  return [];
}
