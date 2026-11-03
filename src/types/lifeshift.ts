// LifeShift Types - Time Block Management & Optimization

export interface TimeBlock {
  id: string;
  title: string;
  category: 'work' | 'learn' | 'health' | 'social' | 'rest' | 'other';
  startTime: string; // HH:mm format
  endTime: string;
  duration: number; // minutes
  priority: 'high' | 'medium' | 'low';
  energy: 'peak' | 'moderate' | 'low'; // Energy level required
  flexibility: number; // 0-100, how movable this block is
  completed?: boolean;
  notes?: string;
}

export interface DaySchedule {
  id: string;
  date: string; // ISO date
  blocks: TimeBlock[];
  totalProductiveTime: number; // minutes
  totalRestTime: number;
  energyScore: number; // 0-100
  balanceScore: number; // 0-100
  optimizationSuggestions?: OptimizationSuggestion[];
}

export interface OptimizationSuggestion {
  id: string;
  type: 'reorder' | 'merge' | 'split' | 'rest' | 'energy-match';
  blockIds: string[];
  reason: string;
  expectedImprovement: string;
  confidence: number; // 0-100
}

export interface LifeShiftAnalysis {
  before: DaySchedule;
  after: DaySchedule;
  improvements: {
    productiveTime: number; // percentage increase
    energyAlignment: number; // percentage improvement
    balance: number; // percentage improvement
    focusTime: number; // minutes gained
  };
  insights: string[];
  implementationSteps: string[];
}

export interface UserEnergyPattern {
  userId: string;
  peakHours: string[]; // ['09:00', '10:00', '14:00']
  lowHours: string[];
  optimalWorkDuration: number; // minutes before break needed
  optimalRestDuration: number; // minutes
  preferences: {
    workStartTime?: string;
    workEndTime?: string;
    breakPreferences?: string[];
    deepWorkPreferences?: string[];
  };
}
