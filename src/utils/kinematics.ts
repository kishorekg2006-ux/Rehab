import { LandmarkPoint, HandLandmarks, FingerAngles, HandMetrics } from '../types/rehab';

// Landmark Indices according to MediaPipe Hands specification
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

// Anatomical baseline standard: Average adult palm distance (Wrist to Middle MCP) is ~85mm
const STANDARD_PALM_MM = 85;

export function euclideanDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Computes 3-point angle in degrees between vector BA and BC (angle at joint B)
export function computeAngleDegrees(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
 
/**
 * Accurately determines physical hand (left vs right) considering:
 * 1. MediaPipe multiHandedness label
 * 2. Mirror mode (selfie camera front-facing vs rear camera)
 * 3. 3D Anatomical orientation of the palm (wrist -> middle MCP, index MCP -> pinky MCP)
 * 4. User calibration inversion toggle
 */
export function determinePhysicalHand(
  mediaPipeLabel?: 'Left' | 'Right' | string,
  landmarks?: HandLandmarks | null,
  isMirrored: boolean = true,
  invertChirality: boolean = false
): 'left' | 'right' {
  let result: 'left' | 'right' = 'right';

  if (mediaPipeLabel) {
    const labelUpper = mediaPipeLabel.toUpperCase();
    // In front-facing selfie camera (standard webcam), MediaPipe's unmirrored image
    // has a physical RIGHT hand appear on the observer's left, so MediaPipe returns 'Left'.
    // When isMirrored is true (standard selfie view), MediaPipe 'Left' is the user's real RIGHT hand.
    if (isMirrored) {
      result = labelUpper === 'LEFT' ? 'right' : 'left';
    } else {
      result = labelUpper === 'LEFT' ? 'left' : 'right';
    }
  } else if (landmarks && landmarks.length >= 21) {
    // Robust anatomical calculation:
    // Normal vector to the palm using cross product
    const wrist = landmarks[LM.WRIST];
    const indexMcp = landmarks[LM.INDEX_MCP];
    const middleMcp = landmarks[LM.MIDDLE_MCP];
    const pinkyMcp = landmarks[LM.PINKY_MCP];
    const thumbTip = landmarks[LM.THUMB_TIP];

    // Longitudinal vector: Wrist -> Middle MCP
    const lx = middleMcp.x - wrist.x;
    const ly = middleMcp.y - wrist.y;

    // Transversal vector: Pinky MCP -> Index MCP
    const tx = indexMcp.x - pinkyMcp.x;
    const ty = indexMcp.y - pinkyMcp.y;

    // 2D Cross product (lx * ty - ly * tx) reveals palm normal z-orientation
    // Positive indicates palm facing camera; negative indicates back of hand facing camera
    const isPalmFacingCamera = (lx * ty - ly * tx) > 0;

    // Relative position of thumb to index
    const isThumbToLeftOfIndex = thumbTip.x < indexMcp.x;

    if (isPalmFacingCamera) {
      result = isThumbToLeftOfIndex ? 'right' : 'left';
    } else {
      result = isThumbToLeftOfIndex ? 'left' : 'right';
    }
  }

  if (invertChirality) {
    result = result === 'right' ? 'left' : 'right';
  }

  return result;
}

export class KinematicsProcessor {
  private positionHistory: { x: number; y: number; time: number }[] = [];
  private readonly historyWindow = 25; // ~800ms at 30fps
  private pinchHoldStart: number | null = null;

  public resetHistory() {
    this.positionHistory = [];
    this.pinchHoldStart = null;
  }

  public processHand(
    landmarks: HandLandmarks,
    now: number = performance.now(),
    explicitHand?: 'left' | 'right' | null
  ): HandMetrics {
    if (!landmarks || landmarks.length < 21) {
      return this.getEmptyMetrics();
    }

    const wrist = landmarks[LM.WRIST];
    const midMcp = landmarks[LM.MIDDLE_MCP];
    const thumbTip = landmarks[LM.THUMB_TIP];
    const indexTip = landmarks[LM.INDEX_TIP];
    const indexPip = landmarks[LM.INDEX_PIP];
    const indexMcp = landmarks[LM.INDEX_MCP];

    // Compute pixel scale to mm conversion using palm dimension
    const palmDistNorm = euclideanDistance(wrist, midMcp);
    const scaleToMm = palmDistNorm > 0.05 ? STANDARD_PALM_MM / palmDistNorm : 300;

    // 1. Pinch Aperture (Thumb tip to Index tip in mm)
    const rawPinchDist = euclideanDistance(thumbTip, indexTip);
    const pinchAperture = Math.round(rawPinchDist * scaleToMm * 10) / 10;
    const isPinching = pinchAperture <= 32; // < 32mm considered active pinch contact

    if (isPinching) {
      if (this.pinchHoldStart === null) {
        this.pinchHoldStart = now;
      }
    } else {
      this.pinchHoldStart = null;
    }
    const pinchHoldDuration = this.pinchHoldStart !== null ? now - this.pinchHoldStart : 0;
    const pinchPurity = Math.max(0, Math.min(100, Math.round(100 - (pinchAperture / 45) * 100)));

    // 2. Individual Finger Extension Angles (MCP -> PIP -> TIP)
    // 180° = fully extended/straight, 60-90° = curled in flexor posture
    const fingerExtensionAngles: FingerAngles = {
      thumb: Math.round(computeAngleDegrees(landmarks[LM.THUMB_MCP], landmarks[LM.THUMB_IP], landmarks[LM.THUMB_TIP])),
      index: Math.round(computeAngleDegrees(indexMcp, indexPip, landmarks[LM.INDEX_DIP])),
      middle: Math.round(computeAngleDegrees(midMcp, landmarks[LM.MIDDLE_PIP], landmarks[LM.MIDDLE_DIP])),
      ring: Math.round(computeAngleDegrees(landmarks[LM.RING_MCP], landmarks[LM.RING_PIP], landmarks[LM.RING_DIP])),
      pinky: Math.round(computeAngleDegrees(landmarks[LM.PINKY_MCP], landmarks[LM.PINKY_PIP], landmarks[LM.PINKY_DIP])),
    };

    const avgFingerExtension = Math.round(
      (fingerExtensionAngles.index + fingerExtensionAngles.middle + fingerExtensionAngles.ring + fingerExtensionAngles.pinky) / 4
    );

    // 3. Hand Open Ratio (Bloom % from clenched fist to full span)
    // Distance from wrist to each fingertip vs palm length
    const tips = [thumbTip, indexTip, landmarks[LM.MIDDLE_TIP], landmarks[LM.RING_TIP], landmarks[LM.PINKY_TIP]];
    const avgTipDist = tips.reduce((acc, tip) => acc + euclideanDistance(wrist, tip), 0) / tips.length;
    // Clenched fist is ~ 0.8x palm, fully open is ~ 1.8x palm
    const openRatioNormalized = Math.max(0, Math.min(1, (avgTipDist / palmDistNorm - 0.7) / 1.1));
    const handOpenRatio = Math.round(openRatioNormalized * 100);

    // 4. Wrist Angles (Flexion / Extension & Deviation)
    // Measure angle vector of forearm (using simulated or y-axis) vs wrist-midMcp line
    const dx = midMcp.x - wrist.x;
    const dy = midMcp.y - wrist.y;
    const angleRad = Math.atan2(dy, dx);
    // Relative to vertical upward (-PI/2)
    const wristAngle = Math.round(((angleRad + Math.PI / 2) * 180) / Math.PI);
    const wristDeviation = Math.round(dx * 100); // Horizontal displacement

    // 5. Tremor Index & Smoothness Score
    // Track index fingertip motion acceleration / high frequency jitter
    this.positionHistory.push({ x: indexTip.x, y: indexTip.y, time: now });
    if (this.positionHistory.length > this.historyWindow) {
      this.positionHistory.shift();
    }

    let tremorIndex = 1.2;
    let smoothnessScore = 88;
    let compensationWarning: string | null = null;

    if (this.positionHistory.length >= 8) {
      // Calculate variance of second derivative (jerk/jitter)
      const jerks: number[] = [];
      for (let i = 2; i < this.positionHistory.length; i++) {
        const p0 = this.positionHistory[i - 2];
        const p1 = this.positionHistory[i - 1];
        const p2 = this.positionHistory[i];
        const dt1 = (p1.time - p0.time) / 1000 || 0.033;
        const dt2 = (p2.time - p1.time) / 1000 || 0.033;

        const v1x = (p1.x - p0.x) / dt1;
        const v1y = (p1.y - p0.y) / dt1;
        const v2x = (p2.x - p1.x) / dt2;
        const v2y = (p2.y - p1.y) / dt2;

        const ax = (v2x - v1x) / dt2;
        const ay = (v2y - v1y) / dt2;
        const jerk = Math.sqrt(ax * ax + ay * ay);
        jerks.push(jerk);
      }

      const avgJerk = jerks.reduce((a, b) => a + b, 0) / jerks.length;
      // Map jerk to 0-10 scale (0 = calm, 10 = pronounced tremor)
      tremorIndex = Math.min(10, Math.max(0.5, Math.round((avgJerk / 15) * 10) / 10));
      smoothnessScore = Math.max(25, Math.min(98, Math.round(100 - tremorIndex * 7)));

      // Compensatory movement check:
      // If wrist jumps up quickly while finger flexion does not change, patient is lifting shoulder/arm
      const wristSpeed = Math.abs(wrist.y - this.positionHistory[0].y);
      if (wristSpeed > 0.15 && Math.abs(avgFingerExtension - 120) < 15) {
        compensationWarning = 'Keep your shoulder relaxed. Focus on moving only your hand.';
      }
    }

    // Determine physical hand (prioritize explicit hand passed from MediaPipe handedness analysis)
    let detectedHand: 'left' | 'right' = 'right';
    if (explicitHand) {
      detectedHand = explicitHand;
    } else {
      detectedHand = determinePhysicalHand(undefined, landmarks, true);
    }

    return {
      pinchAperture,
      isPinching,
      pinchPurity,
      pinchHoldDuration,
      fingerExtensionAngles,
      avgFingerExtension,
      handOpenRatio,
      wristAngle,
      wristDeviation,
      tremorIndex,
      smoothnessScore,
      compensationWarning,
      detectedHand,
    };
  }

  private getEmptyMetrics(): HandMetrics {
    return {
      pinchAperture: 80,
      isPinching: false,
      pinchPurity: 0,
      pinchHoldDuration: 0,
      fingerExtensionAngles: { thumb: 60, index: 120, middle: 120, ring: 120, pinky: 120 },
      avgFingerExtension: 120,
      handOpenRatio: 50,
      wristAngle: 0,
      wristDeviation: 0,
      tremorIndex: 1.5,
      smoothnessScore: 85,
      compensationWarning: null,
      detectedHand: null,
    };
  }
}
