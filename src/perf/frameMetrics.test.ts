import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameProfiler, summarizeFrames } from './frameMetrics';
import type { RenderCounters } from './frameMetrics';

const counters: RenderCounters = {
  calls: 50, triangles: 2000, points: 0, lines: 0, geometries: 12, textures: 8,
};

test('60 FPS frames calculate median, p95, FPS and actual WebGL counters', () => {
  const p = new FrameProfiler();
  p.setEnabled(true);
  for (let i = 0; i <= 121; i++) p.recordFrame(i * 1000 / 60, counters);
  const live = p.getLive();
  assert.equal(live.stats.sampleCount, 121);
  assert.ok(Math.abs(live.stats.fps - 60) < 1e-7);
  assert.ok(Math.abs(live.stats.p95Ms - 1000 / 60) < 1e-7);
  assert.equal(live.stats.drawCallsMean, 50);
  assert.equal(live.stats.trianglesPeak, 2000);
});

test('paused or hidden scene does not count a catch-up spike on resume', () => {
  const p = new FrameProfiler();
  p.setEnabled(true);
  p.recordFrame(0, counters);
  p.recordFrame(16.67, counters);
  p.interrupt();
  p.recordFrame(7000, counters);
  p.recordFrame(7016.67, counters);
  assert.equal(p.getLive().stats.sampleCount, 2);
  assert.equal(p.getLive().stats.slowOver50Ms, 0);
});

test('p95 detects jank and captures can end without additional renders', () => {
  const p = new FrameProfiler();
  p.startCapture(1000, 100);
  for (let i = 0; i <= 19; i++) p.recordFrame(100 + i * 30, counters);
  assert.equal(p.getStatus(1201).active, false);
  const report = p.getReport(1201)!;
  assert.equal(report.rendererStats.sampleCount, 19);
  assert.ok(report.rendererStats.p95Ms > 20);
  assert.equal(report.requestedDurationMs, 1000);
  assert.equal(report.schemaVersion, 1);
});

test('stats of empty intervals do not fabricate FPS', () => {
  const stats = summarizeFrames([]);
  assert.equal(stats.fps, 0);
  assert.equal(stats.sampleCount, 0);
});

test('extremely slow software WebGL frames are measured, not silently discarded', () => {
  const p = new FrameProfiler();
  p.setEnabled(true);
  p.recordFrame(0, counters);
  p.recordFrame(4000, counters);
  p.recordFrame(9000, counters);
  assert.equal(p.getLive().stats.sampleCount, 2);
  assert.ok(p.getLive().stats.fps > 0.2 && p.getLive().stats.fps < 0.3);
  assert.equal(p.getLive().stats.slowOver50Ms, 2);
});
