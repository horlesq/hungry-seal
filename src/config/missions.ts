// Missions: three active goals at a time, rotated from this pool. Finishing one pays its
// reward when the run ends and a new mission takes its place. `run` missions must be done
// within a single run; `total` missions add up across runs. Rules in systems/progress.ts.

export type MissionMetric =
  /** Anything eaten. */
  | 'eat'
  /** One creature or predator id (`kind`). */
  | 'eatKind'
  | 'score'
  /** Seconds survived. */
  | 'survive'
  /** Coins collected. */
  | 'coins'
  /** Deepest point, meters. */
  | 'depth'
  | 'stage'
  | 'chests'
  | 'frenzies';

export interface MissionDef {
  id: string;
  text: string;
  metric: MissionMetric;
  /** Creature/predator id for `eatKind`. */
  kind?: string;
  target: number;
  scope: 'run' | 'total';
  coins: number;
  gems?: number;
}

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'eat-20',
    text: 'Eat 20 fish in one run',
    metric: 'eat',
    target: 20,
    scope: 'run',
    coins: 60,
  },
  {
    id: 'eat-60',
    text: 'Eat 60 fish in one run',
    metric: 'eat',
    target: 60,
    scope: 'run',
    coins: 150,
    gems: 1,
  },
  {
    id: 'score-2000',
    text: 'Score 2,000 in one run',
    metric: 'score',
    target: 2000,
    scope: 'run',
    coins: 80,
  },
  {
    id: 'score-8000',
    text: 'Score 8,000 in one run',
    metric: 'score',
    target: 8000,
    scope: 'run',
    coins: 200,
    gems: 1,
  },
  {
    id: 'survive-120',
    text: 'Survive for 2 minutes',
    metric: 'survive',
    target: 120,
    scope: 'run',
    coins: 80,
  },
  {
    id: 'survive-240',
    text: 'Survive for 4 minutes',
    metric: 'survive',
    target: 240,
    scope: 'run',
    coins: 200,
    gems: 1,
  },
  {
    id: 'coins-40',
    text: 'Collect 40 coins in one run',
    metric: 'coins',
    target: 40,
    scope: 'run',
    coins: 80,
  },
  {
    id: 'depth-deep',
    text: 'Swim down to the deep',
    metric: 'depth',
    target: 276,
    scope: 'run',
    coins: 90,
  },
  {
    id: 'depth-abyss',
    text: 'Reach the abyss',
    metric: 'depth',
    target: 436,
    scope: 'run',
    coins: 150,
    gems: 1,
  },
  { id: 'stage-3', text: 'Grow to size 3', metric: 'stage', target: 3, scope: 'run', coins: 80 },
  {
    id: 'stage-5',
    text: 'Grow to full size',
    metric: 'stage',
    target: 5,
    scope: 'run',
    coins: 250,
    gems: 2,
  },
  {
    id: 'penguin-3',
    text: 'Eat 3 penguins in one run',
    metric: 'eatKind',
    kind: 'penguin',
    target: 3,
    scope: 'run',
    coins: 90,
  },
  {
    id: 'seabird-2',
    text: 'Catch 2 seabirds in one run',
    metric: 'eatKind',
    kind: 'seabird',
    target: 2,
    scope: 'run',
    coins: 90,
  },
  {
    id: 'squid-4',
    text: 'Eat 4 squid in one run',
    metric: 'eatKind',
    kind: 'squid',
    target: 4,
    scope: 'run',
    coins: 90,
  },
  {
    id: 'turtle-1',
    text: 'Eat a sea turtle',
    metric: 'eatKind',
    kind: 'turtle',
    target: 1,
    scope: 'run',
    coins: 100,
  },
  {
    id: 'frenzy-1',
    text: 'Start a feeding frenzy',
    metric: 'frenzies',
    target: 1,
    scope: 'run',
    coins: 80,
  },
  {
    id: 'shark-1',
    text: 'Eat a shark',
    metric: 'eatKind',
    kind: 'shark',
    target: 1,
    scope: 'run',
    coins: 200,
    gems: 1,
  },
  {
    id: 'total-eat-200',
    text: 'Eat 200 fish in total',
    metric: 'eat',
    target: 200,
    scope: 'total',
    coins: 150,
  },
  {
    id: 'total-chests-3',
    text: 'Open 3 treasure chests',
    metric: 'chests',
    target: 3,
    scope: 'total',
    coins: 150,
    gems: 1,
  },
  {
    id: 'total-crab-10',
    text: 'Eat 10 crabs',
    metric: 'eatKind',
    kind: 'crab',
    target: 10,
    scope: 'total',
    coins: 120,
  },
  {
    id: 'total-lantern-25',
    text: 'Eat 25 lanternfish',
    metric: 'eatKind',
    kind: 'lanternfish',
    target: 25,
    scope: 'total',
    coins: 120,
  },
  {
    id: 'total-puffer-5',
    text: 'Eat 5 pufferfish',
    metric: 'eatKind',
    kind: 'pufferfish',
    target: 5,
    scope: 'total',
    coins: 120,
  },
];

/** How many missions are active at once. */
export const ACTIVE_MISSIONS = 3;

/** A new player's first missions: easy, and they teach the game. */
export const STARTER_MISSIONS: readonly string[] = ['eat-20', 'score-2000', 'seabird-2'];

export function missionDef(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}
