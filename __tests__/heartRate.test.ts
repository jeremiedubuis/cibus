import {
  calculateHeartRateStats,
  calculateHeartRateZones,
  estimateMaxHeartRate,
  generateSyntheticHeartRateSamples,
} from '../src/services/heartRateCalculator';
import { HeartRateSample } from '../src/types';

describe('Heart Rate Calculation & Analysis Suite', () => {
  describe('calculateHeartRateStats', () => {
    it('returns null for empty or null sample array', () => {
      expect(calculateHeartRateStats([])).toBeNull();
    });

    it('calculates average, min, and max BPM accurately', () => {
      const samples: HeartRateSample[] = [
        { timestamp: '2026-08-05T10:00:00Z', bpm: 100 },
        { timestamp: '2026-08-05T10:05:00Z', bpm: 150 },
        { timestamp: '2026-08-05T10:10:00Z', bpm: 180 },
        { timestamp: '2026-08-05T10:15:00Z', bpm: 130 },
      ];

      const stats = calculateHeartRateStats(samples);
      expect(stats).not.toBeNull();
      expect(stats?.minHeartRateBpm).toBe(100);
      expect(stats?.maxHeartRateBpm).toBe(180);
      expect(stats?.avgHeartRateBpm).toBe(140);
    });
  });

  describe('estimateMaxHeartRate', () => {
    it('estimates Tanaka formula max heart rate based on age', () => {
      const maxHr30 = estimateMaxHeartRate(30);
      expect(maxHr30).toBe(187); // 208 - 0.7*30 = 187
    });
  });

  describe('calculateHeartRateZones', () => {
    it('allocates sample BPM values into Zone 1 through Zone 5 correctly', () => {
      // Max HR for age 30 = 187 bpm
      // Z1: < 112.2, Z2: < 130.9, Z3: < 149.6, Z4: < 168.3, Z5: >= 168.3
      const samples: HeartRateSample[] = [
        { timestamp: '2026-08-05T10:00:00Z', bpm: 95 },  // Z1
        { timestamp: '2026-08-05T10:05:00Z', bpm: 120 }, // Z2
        { timestamp: '2026-08-05T10:10:00Z', bpm: 140 }, // Z3
        { timestamp: '2026-08-05T10:15:00Z', bpm: 160 }, // Z4
        { timestamp: '2026-08-05T10:20:00Z', bpm: 175 }, // Z5
      ];

      const zones = calculateHeartRateZones(samples, 30, 30);
      expect(zones.zone1Minutes).toBe(6);
      expect(zones.zone2Minutes).toBe(6);
      expect(zones.zone3Minutes).toBe(6);
      expect(zones.zone4Minutes).toBe(6);
      expect(zones.zone5Minutes).toBe(6);
    });
  });

  describe('generateSyntheticHeartRateSamples', () => {
    it('generates continuous heart rate samples over workout duration', () => {
      const result = generateSyntheticHeartRateSamples(
        '2026-08-05T10:00:00.000Z',
        45,
        145,
        175
      );

      expect(result.samples.length).toBeGreaterThanOrEqual(15);
      expect(result.stats.avgHeartRateBpm).toBeGreaterThan(100);
      expect(result.stats.maxHeartRateBpm).toBeGreaterThanOrEqual(160);
      expect(result.zones.zone1Minutes + result.zones.zone2Minutes + result.zones.zone3Minutes + result.zones.zone4Minutes + result.zones.zone5Minutes).toBeCloseTo(45, 0);
    });
  });
});
