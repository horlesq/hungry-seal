import { describe, expect, it } from 'vitest';
import {
  computeViewport,
  cssInsetsToDesign,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  textResolution,
} from './viewport';

describe('viewport', () => {
  it('renders at device pixels and fits the design area on a 16:9 screen', () => {
    const v = computeViewport(1920, 1080, 1);
    expect(v.width).toBe(1920);
    expect(v.height).toBe(1080);
    expect(v.zoom).toBeCloseTo(1.5);
    expect(v.viewWidth).toBeCloseTo(DESIGN_WIDTH);
    expect(v.viewHeight).toBeCloseTo(DESIGN_HEIGHT);
  });

  it('shows more world instead of bars when the window is wider than 16:9', () => {
    // A 16:9 monitor minus browser chrome.
    const v = computeViewport(1920, 950, 1);
    expect(v.viewHeight).toBeCloseTo(DESIGN_HEIGHT);
    expect(v.viewWidth).toBeGreaterThan(DESIGN_WIDTH);
    expect(v.width / v.height).toBeCloseTo(v.viewWidth / v.viewHeight);
  });

  it('shows more world vertically on narrower screens', () => {
    const v = computeViewport(1024, 768, 1);
    expect(v.viewWidth).toBeCloseTo(DESIGN_WIDTH);
    expect(v.viewHeight).toBeGreaterThan(DESIGN_HEIGHT);
  });

  it('uses the device pixel ratio for a sharp canvas, capped at 2', () => {
    const retina = computeViewport(1280, 720, 2);
    expect(retina.width).toBe(2560);
    expect(retina.zoom).toBeCloseTo(2);
    const phone = computeViewport(800, 400, 3);
    expect(phone.dpr).toBe(2);
    expect(phone.width).toBe(1600);
  });

  it('falls back to 1 for invalid pixel ratios', () => {
    expect(computeViewport(1280, 720, NaN).dpr).toBe(1);
    expect(computeViewport(1280, 720, 0).dpr).toBe(1);
  });

  it('converts notch safe-area insets from CSS pixels to design units', () => {
    // Landscape phone: 915x412 CSS at 2x, notch on the left.
    const v = computeViewport(915, 412, 2);
    const inset = cssInsetsToDesign({ top: 0, right: 0, bottom: 21, left: 47 }, v);
    // 47 CSS px = 94 device px = 94 / zoom design units.
    expect(inset.left).toBeCloseTo(94 / v.zoom);
    expect(inset.bottom).toBeCloseTo(42 / v.zoom);
    expect(inset.top).toBe(0);
  });

  it('rasterizes text at the zoom level (in half steps)', () => {
    expect(textResolution(1)).toBe(1);
    expect(textResolution(1.35)).toBe(1.5);
    expect(textResolution(2)).toBe(2);
    expect(textResolution(0.6)).toBe(1);
  });
});
