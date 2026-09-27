// Stats: your top five runs, lifetime totals and achievements (with how to unlock the rest).
// Three panels side by side on wide screens, stacked on upright phones. Esc / Back = menu.
import Phaser from 'phaser';
import { ACHIEVEMENTS } from '../config/achievements';
import { CREATURES } from '../config/creatures';
import { SceneKeys } from '../config/keys';
import { PREDATORS } from '../config/predators';
import { saves } from '../services/SaveService';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { favoriteSnack } from '../systems/progress';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { COLORS, CSS, drawPanel, EDGE, formatNumber, uiText } from '../ui/theme';
import { UiTextures } from '../ui/uiTextures';
import { addBackdrop, BACKDROPS, CurrencyPill } from '../ui/widgets';
import { DESIGN_HEIGHT } from '../utils/viewport';

const PANEL_TOP = 112;
const BADGE = { w: 104, h: 150 };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class StatsScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Stats });
  }

  create(): void {
    this.leaving = false;
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const cx = v.viewWidth / 2;
    const portrait = v.portrait;
    // Upright: three stacked panels, the badge panel sized to its rows.
    const stackW = Math.min(660, v.viewWidth - 40);
    const badgeRows = Math.ceil(ACHIEVEMENTS.length / badgeColumns(stackW));
    const badgesH = 84 + badgeRows * (BADGE.h + 4);
    const blockH = portrait ? PANEL_TOP + 290 + 20 + 300 + 20 + badgesH + 20 : DESIGN_HEIGHT;
    const top = Math.max(portrait ? safe.top : 0, (v.viewHeight - blockH) / 2);

    addBackdrop(this, v, BACKDROPS.deep);
    this.cameras.main.fadeIn(200, 4, 26, 49);

    const headerY = top + 54;
    const back = new Button(this, safe.left + EDGE + 72, headerY, {
      width: 144,
      height: 56,
      label: 'Back',
      icon: UiTextures.Back,
      iconSize: 24,
      variant: 'quiet',
      fontSize: 24,
      onClick: () => this.leave(),
    }).setName('back');
    uiText(this, cx, headerY, 'Stats', 'title', { size: 56 }).setOrigin(0.5);
    new CurrencyPill(this, v.viewWidth - safe.right - EDGE, headerY, saves.data.gems, 'gems');

    let runs: Box;
    let life: Box;
    let badges: Box;
    if (portrait) {
      const w = stackW;
      const x = cx - w / 2;
      runs = { x, y: top + PANEL_TOP, w, h: 290 };
      life = { x, y: runs.y + runs.h + 20, w, h: 300 };
      badges = { x, y: life.y + life.h + 20, w, h: badgesH };
    } else {
      const widths = [360, 360, 460];
      const total = widths.reduce((a, b) => a + b, 0) + 40;
      const x0 = cx - total / 2;
      const y = top + PANEL_TOP;
      const h = DESIGN_HEIGHT - PANEL_TOP - 24;
      runs = { x: x0, y, w: widths[0], h };
      life = { x: x0 + widths[0] + 20, y, w: widths[1], h };
      badges = { x: life.x + widths[1] + 20, y, w: widths[2], h };
    }
    this.topRuns(runs);
    this.lifetime(life, portrait ? 2 : 1);
    this.achievements(badges);

    new FocusNav(this).add(back);
    this.input.keyboard!.on('keydown-ESC', () => back.press());
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  private panel(b: Box, title: string, note = ''): void {
    drawPanel(this.add.graphics(), b.x, b.y, b.w, b.h, { alpha: 0.8, line: 0.14, radius: 22 });
    uiText(this, b.x + 22, b.y + 30, title, 'heading', { size: 24 }).setOrigin(0, 0.5);
    if (note) {
      uiText(this, b.x + b.w - 22, b.y + 30, note, 'caption', { weight: 800 }).setOrigin(1, 0.5);
    }
  }

  private topRuns(b: Box): void {
    this.panel(b, 'Top runs');
    const runs = saves.data.topRuns;
    if (runs.length === 0) {
      uiText(this, b.x + 22, b.y + 76, 'No runs yet. Your best five show up here.', 'body', {
        color: CSS.mist,
        wrap: b.w - 44,
      });
      return;
    }
    runs.forEach((r, i) => {
      const y = b.y + 84 + i * 46;
      const g = this.add.graphics();
      g.fillStyle(i === 0 ? COLORS.gold : COLORS.inkRaised, 1).fillCircle(b.x + 38, y, 17);
      uiText(this, b.x + 38, y + 1, String(i + 1), 'heading', {
        size: 20,
        color: i === 0 ? CSS.ink : CSS.foam,
      }).setOrigin(0.5);
      uiText(this, b.x + 68, y, formatNumber(r.score), 'heading', { size: 24 }).setOrigin(0, 0.5);
      const detail = `${clock(r.seconds)}  size ${r.stage}${r.date ? `  ${shortDate(r.date)}` : ''}`;
      uiText(this, b.x + b.w - 22, y, detail, 'caption', { size: 15 }).setOrigin(1, 0.5);
    });
  }

  private lifetime(b: Box, columns: number): void {
    const data = saves.data;
    const s = data.stats;
    const snack = favoriteSnack(s);
    const rows: Array<[string, string]> = [
      ['Runs', formatNumber(data.runs)],
      ['Best score', formatNumber(data.bestScore)],
      ['Fish eaten', formatNumber(s.eaten)],
      ['Favorite snack', snack ? creatureName(snack.id) : 'None yet'],
      ['Deepest dive', `${formatNumber(s.deepest)} m`],
      ['Longest run', clock(s.longestRun)],
      ['Time played', duration(s.timePlayed)],
      ['Coins earned', formatNumber(s.coinsEarned)],
      ['Gems earned', formatNumber(s.gemsEarned)],
      ['Treasure chests', formatNumber(s.chests)],
      ['Feeding frenzies', formatNumber(s.frenzies)],
      ['Missions done', formatNumber(data.missions.completed)],
    ];
    this.panel(b, 'Lifetime');
    const perCol = Math.ceil(rows.length / columns);
    const colW = (b.w - 44 - (columns - 1) * 24) / columns;
    rows.forEach(([label, value], i) => {
      const col = Math.floor(i / perCol);
      const x = b.x + 22 + col * (colW + 24);
      const y = b.y + 76 + (i % perCol) * (columns === 1 ? 40 : 36);
      uiText(this, x, y, label, 'body', { size: 17, color: CSS.mist }).setOrigin(0, 0.5);
      uiText(this, x + colW, y, value, 'body', { size: 18, weight: 800 }).setOrigin(1, 0.5);
    });
  }

  private achievements(b: Box): void {
    const unlocked = saves.data.achievements;
    this.panel(b, 'Achievements', `${unlocked.length} / ${ACHIEVEMENTS.length}`);
    const cols = badgeColumns(b.w);
    const gridW = cols * BADGE.w;
    ACHIEVEMENTS.forEach((a, i) => {
      const done = unlocked.includes(a.id);
      const x = b.x + (b.w - gridW) / 2 + (i % cols) * BADGE.w + BADGE.w / 2;
      const y = b.y + 92 + Math.floor(i / cols) * (BADGE.h + 4);
      const g = this.add.graphics();
      g.fillStyle(COLORS.trench, 0.7).fillCircle(x, y + 3, 28);
      g.fillStyle(done ? COLORS.gold : COLORS.inkRaised, 1).fillCircle(x, y, 28);
      const icon = this.add.image(x, y, done ? UiTextures.Star : UiTextures.Lock);
      icon.setScale((done ? 34 : 26) / icon.frame.width).setTint(done ? COLORS.ink : COLORS.mist);
      const name = uiText(this, x, y + 40, a.name, 'caption', {
        size: 14,
        weight: 800,
        color: done ? CSS.foam : CSS.mist,
        align: 'center',
        wrap: BADGE.w - 6,
      }).setOrigin(0.5, 0);
      // Below the name, however many lines it took.
      const note = done ? `+${a.gems} gem${a.gems === 1 ? '' : 's'}` : a.description;
      uiText(this, x, name.y + name.height - 2, note, 'caption', {
        size: 12,
        color: done ? CSS.gem : CSS.mist,
        align: 'center',
        wrap: BADGE.w - 8,
      })
        .setOrigin(0.5, 0)
        .setAlpha(done ? 1 : 0.8);
    });
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 4, 26, 49);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Menu);
    });
  }
}

/** Achievement badges per row in a panel this wide. */
function badgeColumns(width: number): number {
  return Math.max(1, Math.floor((width - 24) / BADGE.w));
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-28" -> "Sep 28". */
function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : '';
}

function creatureName(id: string): string {
  const creature = (CREATURES as Record<string, { name: string } | undefined>)[id];
  const predator = (PREDATORS as Record<string, { name: string } | undefined>)[id];
  return creature?.name ?? predator?.name ?? id;
}
