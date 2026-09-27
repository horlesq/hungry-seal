// Mission list panel (title screen): each active mission with a progress ring, its goal,
// progress so far and the reward.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { missionDef, type MissionDef } from '../config/missions';
import type { ActiveMission } from '../systems/progress';
import { COLORS, CSS, drawPanel, formatNumber, uiText } from './theme';
import { UiTextures } from './uiTextures';

const HEAD = 48;
const ROW = 58;

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "12 / 20", "1:20 / 2:00" or "210 / 276 m". */
export function formatMissionProgress(def: MissionDef, progress: number): string {
  if (def.metric === 'survive') return `${clock(progress)} / ${clock(def.target)}`;
  const unit = def.metric === 'depth' ? ' m' : '';
  return `${formatNumber(progress)} / ${formatNumber(def.target)}${unit}`;
}

export class MissionPanel extends Phaser.GameObjects.Container {
  /** Panel height for a number of missions. */
  static heightFor(count: number): number {
    return HEAD + count * ROW + 8;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    missions: readonly ActiveMission[],
  ) {
    super(scene, x, y);
    const h = MissionPanel.heightFor(missions.length);
    const bg = drawPanel(scene.add.graphics(), 0, 0, width, h, {
      alpha: 0.62,
      line: 0.16,
      radius: 22,
    });
    this.add(bg);
    this.add(uiText(scene, 22, 26, 'Missions', 'heading', { size: 22 }).setOrigin(0, 0.5));

    missions.forEach((m, i) => {
      const def = missionDef(m.id);
      if (!def) return;
      const cy = HEAD + i * ROW + ROW / 2 - 4;
      // Progress ring.
      const ring = scene.add.graphics();
      const frac = Math.min(1, m.progress / def.target);
      ring.lineStyle(5, COLORS.trench, 0.8).strokeCircle(36, cy, 14);
      if (frac > 0) {
        ring.lineStyle(5, COLORS.glacier, 1);
        ring.beginPath();
        ring.arc(36, cy, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ring.strokePath();
      }
      this.add(ring);
      this.add(
        uiText(scene, 62, cy - 10, def.text, 'body', { size: 18, weight: 700 }).setOrigin(0, 0.5),
      );
      this.add(
        uiText(scene, 62, cy + 13, formatMissionProgress(def, m.progress), 'caption', {
          size: 14,
        }).setOrigin(0, 0.5),
      );

      // Reward, right-aligned: coins, then gems if any.
      let right = width - 20;
      const reward = (amount: number, icon: string, color: string) => {
        const t = uiText(scene, right, cy, formatNumber(amount), 'heading', {
          size: 20,
          color,
        }).setOrigin(1, 0.5);
        const img = scene.add.image(right - t.width - 13, cy, icon);
        img.setScale(22 / img.frame.width);
        this.add([t, img]);
        right -= t.width + 34;
      };
      if (def.gems) reward(def.gems, UiTextures.Gem, CSS.gem);
      reward(def.coins, TextureKeys.Coin, CSS.gold);
    });

    this.setSize(width, h);
    scene.add.existing(this);
  }
}
