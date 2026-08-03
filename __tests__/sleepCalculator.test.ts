import {
  assignSleepDateAndType,
  calculateSleepQualityScore,
  getSleepQualityRating,
  aggregateDailySleep,
} from '../src/services/sleepCalculator';
import { SleepEntry } from '../src/types';

describe('Sleep Calculator & Date Assignment Suite', () => {
  describe('assignSleepDateAndType', () => {
    it('assigns sleep starting at or after 7:00 PM (19:00) to the next day as overnight sleep', () => {
      // 2026-08-05 at 22:30 (10:30 PM)
      const startDate = new Date('2026-08-05T22:30:00.000');
      const result = assignSleepDateAndType(startDate);

      expect(result.isNap).toBe(false);
      expect(result.dateStr).toBe('2026-08-06');
    });

    it('assigns sleep starting at 7:00 PM (19:00) exactly to the next day', () => {
      const startDate = new Date('2026-08-05T19:00:00.000');
      const result = assignSleepDateAndType(startDate);

      expect(result.isNap).toBe(false);
      expect(result.dateStr).toBe('2026-08-06');
    });

    it('categorizes sleep starting between 11:00 AM and 7:00 PM as a daytime nap on the current day', () => {
      // 2026-08-05 at 14:15 (2:15 PM)
      const napDate = new Date('2026-08-05T14:15:00.000');
      const result = assignSleepDateAndType(napDate);

      expect(result.isNap).toBe(true);
      expect(result.dateStr).toBe('2026-08-05');
    });

    it('categorizes sleep starting before 11:00 AM as current day overnight sleep', () => {
      // 2026-08-05 at 01:30 AM
      const earlyDate = new Date('2026-08-05T01:30:00.000');
      const result = assignSleepDateAndType(earlyDate);

      expect(result.isNap).toBe(false);
      expect(result.dateStr).toBe('2026-08-05');
    });
  });

  describe('calculateSleepQualityScore', () => {
    it('returns 0 for zero or negative duration', () => {
      expect(calculateSleepQualityScore(0, 480)).toBe(0);
      expect(calculateSleepQualityScore(-10, 480)).toBe(0);
    });

    it('scores high when meeting the user target sleep goal', () => {
      // 8 hours slept with 8 hours (480m) target
      const score = calculateSleepQualityScore(480, 480, 100, 110, 10);
      expect(score).toBeGreaterThanOrEqual(85);
    });

    it('supports customizable user target sleep goals', () => {
      // 7 hours slept with 7 hours (420m) custom target
      const score = calculateSleepQualityScore(420, 420, 90, 95, 10);
      expect(score).toBeGreaterThanOrEqual(85);
    });

    it('penalizes undersleeping relative to user target', () => {
      // 5 hours slept vs 8 hours target
      const shortScore = calculateSleepQualityScore(300, 480);
      // 8 hours slept vs 8 hours target
      const targetScore = calculateSleepQualityScore(480, 480);

      expect(shortScore).toBeLessThan(targetScore);
    });

    it('penalizes excessive awakenings', () => {
      const normalAwake = calculateSleepQualityScore(480, 480, 100, 100, 10);
      const highAwake = calculateSleepQualityScore(480, 480, 100, 100, 70);

      expect(highAwake).toBeLessThan(normalAwake);
    });
  });

  describe('getSleepQualityRating', () => {
    it('maps numerical scores to rating categories and colors', () => {
      expect(getSleepQualityRating(90).rating).toBe('EXCELLENT');
      expect(getSleepQualityRating(75).rating).toBe('GOOD');
      expect(getSleepQualityRating(60).rating).toBe('FAIR');
      expect(getSleepQualityRating(40).rating).toBe('POOR');
    });
  });

  describe('aggregateDailySleep', () => {
    it('aggregates overnight sessions and daytime naps correctly', () => {
      const entries: SleepEntry[] = [
        {
          id: 's1',
          date: '2026-08-05',
          startTime: '2026-08-04T23:00:00.000Z',
          endTime: '2026-08-05T07:00:00.000Z',
          durationMinutes: 480,
          qualityScore: 88,
          isNap: false,
          deepSleepMinutes: 100,
          remSleepMinutes: 120,
        },
        {
          id: 's2',
          date: '2026-08-05',
          startTime: '2026-08-05T14:00:00.000Z',
          endTime: '2026-08-05T14:45:00.000Z',
          durationMinutes: 45,
          qualityScore: 60,
          isNap: true,
        },
      ];

      const agg = aggregateDailySleep(entries, 480);

      expect(agg.totalOvernightMinutes).toBe(480);
      expect(agg.totalNapMinutes).toBe(45);
      expect(agg.totalSleepMinutes).toBe(525);
      expect(agg.overnightEntries.length).toBe(1);
      expect(agg.napEntries.length).toBe(1);
      expect(agg.overallScore).toBeGreaterThan(0);
    });
  });
});
