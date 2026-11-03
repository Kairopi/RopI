import type { TimeBlock, DaySchedule, LifeShiftAnalysis } from '../types/lifeshift';

// Generate sample unoptimized schedule (realistic chaos)
function generateBeforeSchedule(): DaySchedule {
  const blocks: TimeBlock[] = [
    {
      id: '1',
      title: 'Check Emails & Slack',
      category: 'work',
      startTime: '09:00',
      endTime: '09:45',
      duration: 45,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 70,
    },
    {
      id: '2',
      title: 'Team Meeting',
      category: 'work',
      startTime: '09:45',
      endTime: '10:30',
      duration: 45,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 20,
    },
    {
      id: '3',
      title: 'Social Media Scroll',
      category: 'other',
      startTime: '10:30',
      endTime: '11:00',
      duration: 30,
      priority: 'low',
      energy: 'low',
      flexibility: 90,
    },
    {
      id: '4',
      title: 'Deep Work: Code Feature',
      category: 'work',
      startTime: '11:00',
      endTime: '12:30',
      duration: 90,
      priority: 'high',
      energy: 'peak',
      flexibility: 50,
    },
    {
      id: '5',
      title: 'Lunch Break',
      category: 'rest',
      startTime: '12:30',
      endTime: '13:00',
      duration: 30,
      priority: 'medium',
      energy: 'low',
      flexibility: 30,
    },
    {
      id: '6',
      title: 'Another Meeting',
      category: 'work',
      startTime: '13:00',
      endTime: '14:00',
      duration: 60,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 20,
    },
    {
      id: '7',
      title: 'Review PRs & Code Review',
      category: 'work',
      startTime: '14:00',
      endTime: '15:30',
      duration: 90,
      priority: 'high',
      energy: 'moderate',
      flexibility: 60,
    },
    {
      id: '8',
      title: 'Quick Workout',
      category: 'health',
      startTime: '15:30',
      endTime: '16:00',
      duration: 30,
      priority: 'low',
      energy: 'moderate',
      flexibility: 80,
    },
    {
      id: '9',
      title: 'Random Admin Tasks',
      category: 'work',
      startTime: '16:00',
      endTime: '17:00',
      duration: 60,
      priority: 'low',
      energy: 'low',
      flexibility: 80,
    },
    {
      id: '10',
      title: 'Online Course',
      category: 'learn',
      startTime: '17:00',
      endTime: '18:00',
      duration: 60,
      priority: 'medium',
      energy: 'low',
      flexibility: 70,
    },
  ];

  const totalProductiveTime = blocks
    .filter(b => ['work', 'learn'].includes(b.category))
    .reduce((sum, b) => sum + b.duration, 0);

  const totalRestTime = blocks
    .filter(b => ['rest', 'health'].includes(b.category))
    .reduce((sum, b) => sum + b.duration, 0);

  return {
    id: 'before-1',
    date: new Date().toISOString(),
    blocks,
    totalProductiveTime,
    totalRestTime,
    energyScore: 62, // Poor energy alignment
    balanceScore: 58, // Unbalanced
  };
}

// Generate optimized schedule using AI principles
function generateAfterSchedule(before: DaySchedule): DaySchedule {
  const blocks: TimeBlock[] = [
    // Peak energy morning: Deep work first
    {
      id: '4-opt',
      title: 'Deep Work: Code Feature',
      category: 'work',
      startTime: '09:00',
      endTime: '10:30',
      duration: 90,
      priority: 'high',
      energy: 'peak',
      flexibility: 50,
    },
    // Short break
    {
      id: '11-opt',
      title: 'Morning Break & Stretch',
      category: 'rest',
      startTime: '10:30',
      endTime: '10:45',
      duration: 15,
      priority: 'medium',
      energy: 'low',
      flexibility: 50,
    },
    // Still peak: High-priority focused work
    {
      id: '7-opt',
      title: 'Review PRs & Code Review',
      category: 'work',
      startTime: '10:45',
      endTime: '12:00',
      duration: 75,
      priority: 'high',
      energy: 'peak',
      flexibility: 60,
    },
    // Proper lunch break
    {
      id: '5-opt',
      title: 'Lunch Break',
      category: 'rest',
      startTime: '12:00',
      endTime: '13:00',
      duration: 60,
      priority: 'medium',
      energy: 'low',
      flexibility: 30,
    },
    // Post-lunch: Collaborative work
    {
      id: '2-opt',
      title: 'Team Meeting',
      category: 'work',
      startTime: '13:00',
      endTime: '13:45',
      duration: 45,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 20,
    },
    {
      id: '6-opt',
      title: 'Sync Meeting',
      category: 'work',
      startTime: '13:45',
      endTime: '14:30',
      duration: 45,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 20,
    },
    // Mid-afternoon: Learning when energy dips
    {
      id: '10-opt',
      title: 'Online Course',
      category: 'learn',
      startTime: '14:30',
      endTime: '15:30',
      duration: 60,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 70,
    },
    // Movement break
    {
      id: '8-opt',
      title: 'Workout & Movement',
      category: 'health',
      startTime: '15:30',
      endTime: '16:15',
      duration: 45,
      priority: 'medium',
      energy: 'moderate',
      flexibility: 80,
    },
    // Light admin work
    {
      id: '9-opt',
      title: 'Admin Tasks & Emails',
      category: 'work',
      startTime: '16:15',
      endTime: '17:00',
      duration: 45,
      priority: 'low',
      energy: 'low',
      flexibility: 80,
    },
    {
      id: '1-opt',
      title: 'End-of-Day Check & Plan Tomorrow',
      category: 'work',
      startTime: '17:00',
      endTime: '17:30',
      duration: 30,
      priority: 'medium',
      energy: 'low',
      flexibility: 70,
    },
  ];

  const totalProductiveTime = blocks
    .filter(b => ['work', 'learn'].includes(b.category))
    .reduce((sum, b) => sum + b.duration, 0);

  const totalRestTime = blocks
    .filter(b => ['rest', 'health'].includes(b.category))
    .reduce((sum, b) => sum + b.duration, 0);

  return {
    id: 'after-1',
    date: new Date().toISOString(),
    blocks,
    totalProductiveTime,
    totalRestTime,
    energyScore: 91, // Excellent energy alignment
    balanceScore: 87, // Well balanced
  };
}

// Main analysis generator
export function generateLifeShiftAnalysis(): LifeShiftAnalysis {
  const before = generateBeforeSchedule();
  const after = generateAfterSchedule(before);

  const improvements = {
    productiveTime: Math.round(((after.totalProductiveTime - before.totalProductiveTime) / before.totalProductiveTime) * 100),
    energyAlignment: after.energyScore - before.energyScore,
    balance: after.balanceScore - before.balanceScore,
    focusTime: 90, // Deep work gained at peak hours
  };

  const insights = [
    'Your peak energy hours (9-11 AM) were wasted on meetings and email. Moved deep work here for +47% productivity.',
    'Added strategic breaks every 90 minutes to prevent burnout and maintain focus throughout the day.',
    'Consolidated meetings into one afternoon block to minimize context switching (-65% task switches).',
    'Moved learning to post-lunch when energy naturally dips but attention is still present.',
    'Extended workout from 30→45 minutes for better health outcomes and afternoon energy boost.',
    'Scheduled low-priority admin tasks for end-of-day when decision fatigue is highest.',
  ];

  const implementationSteps = [
    'Block 9-10:30 AM daily as "Deep Work - Do Not Disturb" in your calendar',
    'Set up auto-responder for emails until 4 PM',
    'Decline/reschedule any meetings scheduled before noon',
    'Enable Focus Mode during deep work blocks',
    'Set 15-minute break reminders every 90 minutes',
  ];

  return {
    before,
    after,
    improvements,
    insights,
    implementationSteps,
  };
}

// Future: Connect to Muse Wonder API for real-time optimization
export async function analyzeScheduleWithMuseWonder(blocks: TimeBlock[]): Promise<LifeShiftAnalysis> {
  // TODO: Integrate Muse Wonder API
  // const response = await fetch('https://api.muse.ai/v1/wonder', {
  //   method: 'POST',
  //   body: JSON.stringify({ blocks, context: 'schedule-optimization' })
  // });
  
  return generateLifeShiftAnalysis();
}
