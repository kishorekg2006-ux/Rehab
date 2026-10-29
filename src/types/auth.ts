export type UserRole = 'patient' | 'therapist';

export interface UserAccount {
  id: string;
  name: string;
  phoneNumber: string;
  condition: string; // Disease / disorder / case (e.g. Stroke Hemiparesis, Parkinson's, Carpal Tunnel, etc.)
  role: UserRole;
  title: string;
  email?: string;
  patientId?: string;
  clinicianId?: string;
  organization?: string;
}

export const COMMON_CONDITIONS = [
  'Stroke / Hemiparesis',
  "Parkinson's Disease (Hand Tremor & Rigidity)",
  'Carpal Tunnel & Peripheral Nerve Injury',
  'Post-Operative Hand / Tendon Surgery',
  'Cerebral Palsy & Fine Motor Delay',
  'Rheumatoid / Osteoarthritis Stiffness',
  'Spinal Cord Injury (Upper Limb)',
  'Traumatic Brain Injury (TBI)',
  'General Upper Limb Motor Weakness',
  'Other Neuro-Musculoskeletal Case',
] as const;

export const DEFAULT_USER: UserAccount = {
  id: 'pt-8821',
  name: 'Eleanor Vance',
  phoneNumber: '+1 (555) 839-2019',
  condition: 'Stroke / Hemiparesis',
  role: 'patient',
  title: 'Stroke Rehabilitation Case',
  patientId: 'PT-8821',
  organization: 'Neuro-Rehab Clinic',
};
