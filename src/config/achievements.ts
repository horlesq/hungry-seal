// Achievements: one-time milestones from lifetime stats, each worth a few gems. Checked when
// a run ends (systems/progress.ts); shown on the Stats screen.

export type AchievementMetric =
  | 'eaten'
  /** Lifetime count of one creature/predator id (`kind`). */
  | 'eatKind'
  /** Deepest dive, meters. */
  | 'deepest'
  | 'maxStage'
  | 'chests'
  | 'frenzies'
  /** Longest single run, seconds. */
  | 'longestRun'
  | 'coinsEarned';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  kind?: string;
  target: number;
  gems: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-bite',
    name: 'First Bite',
    description: 'Eat your first fish',
    metric: 'eaten',
    target: 1,
    gems: 1,
  },
  {
    id: 'big-eater',
    name: 'Big Eater',
    description: 'Eat 1,000 fish',
    metric: 'eaten',
    target: 1000,
    gems: 5,
  },
  {
    id: 'abyss-diver',
    name: 'Abyss Diver',
    description: 'Reach the abyss',
    metric: 'deepest',
    target: 436,
    gems: 3,
  },
  {
    id: 'rock-bottom',
    name: 'Rock Bottom',
    description: 'Touch the seabed',
    metric: 'deepest',
    target: 570,
    gems: 3,
  },
  {
    id: 'fully-grown',
    name: 'Fully Grown',
    description: 'Grow to full size',
    metric: 'maxStage',
    target: 8,
    gems: 3,
  },
  {
    id: 'shark-snack',
    name: 'Shark Snack',
    description: 'Eat a shark',
    metric: 'eatKind',
    kind: 'shark',
    target: 1,
    gems: 3,
  },
  {
    id: 'orca-crunch',
    name: 'Orca Crunch',
    description: 'Eat an orca',
    metric: 'eatKind',
    kind: 'orca',
    target: 1,
    gems: 5,
  },
  {
    id: 'treasure-hunter',
    name: 'Treasure Hunter',
    description: 'Open 5 treasure chests',
    metric: 'chests',
    target: 5,
    gems: 3,
  },
  {
    id: 'frenzied',
    name: 'Frenzied',
    description: 'Start 10 feeding frenzies',
    metric: 'frenzies',
    target: 10,
    gems: 2,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Survive 5 minutes in one run',
    metric: 'longestRun',
    target: 300,
    gems: 3,
  },
  {
    id: 'deep-pockets',
    name: 'Deep Pockets',
    description: 'Earn 5,000 coins',
    metric: 'coinsEarned',
    target: 5000,
    gems: 3,
  },
  {
    id: 'bird-watcher',
    name: 'Bird Watcher',
    description: 'Catch 25 seabirds',
    metric: 'eatKind',
    kind: 'seabird',
    target: 25,
    gems: 2,
  },
];
