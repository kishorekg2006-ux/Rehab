import React from 'react';
import { StarReachGame } from './StarReachGame';
import { HandMetrics, HandLandmarks, SessionRecord } from '../../types/rehab';

export interface WristGliderGameProps {
  metrics: HandMetrics | null;
  landmarks: HandLandmarks | null;
  targetReps: number;
  onSessionComplete: (record: Partial<SessionRecord>) => void;
  onDeleteSessionData?: () => void;
}

// Re-export StarReachGame as WristGliderGame so existing routes and definitions work seamlessly
export const WristGliderGame: React.FC<WristGliderGameProps> = (props) => {
  return <StarReachGame {...props} />;
};

export default WristGliderGame;
