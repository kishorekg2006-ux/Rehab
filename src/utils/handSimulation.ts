import { HandLandmarks, LandmarkPoint } from '../types/rehab';

// Generates an anatomically structured 21-point hand landmark set
export function generateHandPose(params: {
  hand: 'left' | 'right';
  centerX: number; // 0-1
  centerY: number; // 0-1
  scale: number;
  pinchAmount: number; // 0 (open) to 1 (tight pinch between thumb & index)
  bloomAmount: number; // 0 (clenched fist) to 1 (fully spread open)
  wristAngleDeg: number; // -45 to +45
  isolatedFingerFlexion: number; // 0 (extended) to 1 (flexed) for single finger
  isolatedFingerIndex?: number; // 1=thumb, 2=index, 3=middle, 4=ring, 5=pinky
}): HandLandmarks {
  const { hand, centerX, centerY, scale, pinchAmount, bloomAmount, wristAngleDeg, isolatedFingerFlexion, isolatedFingerIndex } = params;
  const isRight = hand === 'right';
  const flip = isRight ? 1 : -1;

  const rad = (wristAngleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Helper to rotate and scale relative to wrist
  const rotatePoint = (lx: number, ly: number): LandmarkPoint => {
    const rx = lx * flip;
    const nx = rx * cos - ly * sin;
    const ny = rx * sin + ly * cos;
    return {
      x: Math.max(0.05, Math.min(0.95, centerX + nx * scale)),
      y: Math.max(0.05, Math.min(0.95, centerY + ny * scale)),
      z: 0,
    };
  };

  // Base palm layout
  const wrist = rotatePoint(0, 0.22);
  const thumbCmc = rotatePoint(0.06, 0.16);
  const thumbMcp = rotatePoint(0.11, 0.09);
  const thumbIp = rotatePoint(0.14, 0.02);
  
  // Thumb tip position shifts toward index tip when pinching
  const thumbTipX = 0.14 - pinchAmount * 0.08;
  const thumbTipY = -0.04 + pinchAmount * 0.05;
  const thumbTip = rotatePoint(thumbTipX, thumbTipY);

  // Knuckles (MCP)
  const indexMcp = rotatePoint(0.07, -0.02);
  const midMcp = rotatePoint(0.01, -0.04);
  const ringMcp = rotatePoint(-0.05, -0.02);
  const pinkyMcp = rotatePoint(-0.10, 0.01);

  // Helper to construct finger joints based on extension/flexion
  const buildFinger = (
    baseX: number,
    baseY: number,
    spreadX: number,
    fingerNum: number,
    isPinchingIndex: boolean = false
  ) => {
    let flex = 1 - bloomAmount * 0.65; // clench vs open
    if (fingerNum === isolatedFingerIndex) {
      flex = Math.max(flex, isolatedFingerFlexion);
    }
    if (isPinchingIndex) {
      flex = Math.max(flex, pinchAmount * 0.7);
    }

    const pipY = baseY - 0.07 * (1 - flex * 0.4);
    const dipY = pipY - 0.06 * (1 - flex * 0.5);
    const tipY = dipY - 0.05 * (1 - flex * 0.6);

    const pipX = baseX + spreadX * 0.3 * bloomAmount;
    const dipX = baseX + spreadX * 0.6 * bloomAmount;
    let tipX = baseX + spreadX * bloomAmount;

    if (isPinchingIndex) {
      tipX = tipX + (0.05 - tipX) * pinchAmount;
    }

    return {
      pip: rotatePoint(pipX, pipY),
      dip: rotatePoint(dipX, dipY),
      tip: rotatePoint(tipX, tipY),
    };
  };

  const indexF = buildFinger(0.07, -0.02, 0.05, 2, true);
  const midF = buildFinger(0.01, -0.04, 0.01, 3);
  const ringF = buildFinger(-0.05, -0.02, -0.04, 4);
  const pinkyF = buildFinger(-0.10, 0.01, -0.08, 5);

  return [
    wrist,        // 0
    thumbCmc,     // 1
    thumbMcp,     // 2
    thumbIp,      // 3
    thumbTip,     // 4
    indexMcp,     // 5
    indexF.pip,   // 6
    indexF.dip,   // 7
    indexF.tip,   // 8
    midMcp,       // 9
    midF.pip,     // 10
    midF.dip,     // 11
    midF.tip,     // 12
    ringMcp,      // 13
    ringF.pip,    // 14
    ringF.dip,    // 15
    ringF.tip,    // 16
    pinkyMcp,     // 17
    pinkyF.pip,   // 18
    pinkyF.dip,   // 19
    pinkyF.tip,   // 20
  ];
}
