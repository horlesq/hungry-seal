// First-run hints. A small rule list decides which hint to show given what the player has
// done so far; each hint shows once. Pure logic, no Phaser: GameScene feeds it progress and
// forwards the current hint text to the HUD.

export type HintId = 'move' | 'eat' | 'boost' | 'danger' | 'grow' | 'shark';

export interface TutorialProgress {
  elapsed: number;
  /** Meters swum. */
  distance: number;
  eaten: number;
  stage: number;
  /** A shark has started hunting the seal at least once. */
  sharkNoticed: boolean;
}

interface Rule {
  id: HintId;
  /** Becomes eligible. */
  when: (p: TutorialProgress, done: ReadonlySet<HintId>) => boolean;
  /** Completed early (e.g. the player already did the thing). */
  doneWhen?: (p: TutorialProgress) => boolean;
  /** Max seconds on screen. */
  duration: number;
  /** Shows even if another hint is up. */
  urgent?: boolean;
}

/** Hints never disappear faster than this, so they can be read. */
const MIN_SHOW = 2.5;

const RULES: readonly Rule[] = [
  { id: 'shark', when: (p) => p.sharkNoticed, duration: 4, urgent: true },
  { id: 'grow', when: (p) => p.stage >= 2, duration: 4, urgent: true },
  { id: 'move', when: () => true, doneWhen: (p) => p.distance > 15, duration: 7 },
  { id: 'eat', when: (_p, d) => d.has('move'), doneWhen: (p) => p.eaten >= 3, duration: 10 },
  { id: 'boost', when: (_p, d) => d.has('eat'), duration: 6 },
  { id: 'danger', when: (p) => p.elapsed >= 24, duration: 5 },
];

export class Tutorial {
  private readonly done = new Set<HintId>();
  private current: Rule | null = null;
  private shownFor = 0;

  constructor(private readonly texts: Record<HintId, string>) {}

  /** Returns the text to show now, or null for no hint. */
  update(dt: number, p: TutorialProgress): string | null {
    if (this.current) {
      this.shownFor += dt;
      const expired = this.shownFor >= this.current.duration;
      const satisfied = this.shownFor >= MIN_SHOW && (this.current.doneWhen?.(p) ?? false);
      if (expired || satisfied) this.finish();
    }

    for (const rule of RULES) {
      if (this.done.has(rule.id) || rule === this.current) continue;
      if (this.current && !(rule.urgent && !this.current.urgent)) continue;
      if (!rule.when(p, this.done)) continue;
      if (rule.doneWhen?.(p)) {
        // Already did it before we got to explain it.
        this.done.add(rule.id);
        continue;
      }
      if (this.current) this.interrupt();
      this.current = rule;
      this.shownFor = 0;
      break;
    }
    return this.current ? this.texts[this.current.id] : null;
  }

  get finished(): boolean {
    return RULES.every((r) => this.done.has(r.id));
  }

  private finish(): void {
    if (this.current) this.done.add(this.current.id);
    this.current = null;
    this.shownFor = 0;
  }

  /** Replaced by an urgent hint: only counts as seen if it was up long enough to read. */
  private interrupt(): void {
    if (this.current && this.shownFor >= MIN_SHOW) this.done.add(this.current.id);
    this.current = null;
    this.shownFor = 0;
  }
}
