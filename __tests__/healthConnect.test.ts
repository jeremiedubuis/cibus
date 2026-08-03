import {
  calculateDailyBurnedCalories,
  estimateActivityCalories,
  estimateStepCalories,
  fetchDailyBurnedMetrics,
  getExerciseSessionNetActiveCalories,
  getStepCountOutsideExerciseSessions,
  MEAL_TYPE_MAP,
  reconcileHealthConnectData,
  REVERSE_MEAL_TYPE_MAP,
  syncMealToHealthConnect,
} from '../src/services/healthConnect';

describe('Health Connect Sync Service', () => {
  it('estimates calories from steps only with a valid step count and weight', () => {
    expect(estimateStepCalories(6500, 70)).toBe(228);
    expect(estimateStepCalories(0, 70)).toBe(0);
    expect(estimateStepCalories(6500, 0)).toBe(0);
  });

  it('combines separate activity and step contributions for the daily budget', () => {
    // 4,746 steps at 73 kg estimate to 173 kcal; a 240-kcal workout totals 413 kcal.
    expect(calculateDailyBurnedCalories(240, 4746, 73)).toBe(413);
  });

  it('uses net, session-overlapping total calories without subtracting BMR twice', () => {
    const exercise = [{ startTime: '2026-08-04T04:00:00.000Z', endTime: '2026-08-04T05:00:00.000Z' }];
    const records = [
      { startTime: '2026-08-04T04:00:00.000Z', endTime: '2026-08-04T04:30:00.000Z', energy: { inKilocalories: 250 } },
      { startTime: '2026-08-04T04:30:00.000Z', endTime: '2026-08-04T05:00:00.000Z', energy: { inKilocalories: 250 } },
      { startTime: '2026-08-03T22:00:00.000Z', endTime: '2026-08-04T21:59:59.999Z', energy: { inKilocalories: 2200 } },
    ];

    // 500 gross kcal across an hour, less 70 kcal of BMR for the hour.
    expect(getExerciseSessionNetActiveCalories(records, exercise, 1680)).toBe(430);
  });

  it('excludes steps that overlap a logged exercise session from the step estimate', () => {
    const exercise = [{ startTime: '2026-08-04T04:10:00.000Z', endTime: '2026-08-04T04:20:00.000Z' }];
    const buckets = [
      { startTime: '2026-08-04T04:00:00.000Z', endTime: '2026-08-04T04:15:00.000Z', result: { COUNT_TOTAL: 150 } },
      { startTime: '2026-08-04T04:15:00.000Z', endTime: '2026-08-04T04:30:00.000Z', result: { COUNT_TOTAL: 150 } },
    ];

    expect(getStepCountOutsideExerciseSessions(buckets, exercise)).toBeCloseTo(200);
  });

  it('should map internal MealType constants to Android Health Connect integer values', () => {
    expect(MEAL_TYPE_MAP.BREAKFAST).toBe(1);
    expect(MEAL_TYPE_MAP.LUNCH).toBe(2);
    expect(MEAL_TYPE_MAP.DINNER).toBe(3);
    expect(MEAL_TYPE_MAP.SNACK).toBe(4);

    expect(REVERSE_MEAL_TYPE_MAP[1]).toBe('BREAKFAST');
    expect(REVERSE_MEAL_TYPE_MAP[2]).toBe('LUNCH');
    expect(REVERSE_MEAL_TYPE_MAP[3]).toBe('DINNER');
    expect(REVERSE_MEAL_TYPE_MAP[4]).toBe('SNACK');
  });

  it('should sync meal entry record and return record identifier in fallback/mock mode', async () => {
    const consumedAt = new Date('2026-07-31T08:30:00Z');
    const recordId = await syncMealToHealthConnect(
      'Rolled Oats & Milk',
      'BREAKFAST',
      consumedAt,
      420,
      16.5,
      68.0,
      8.5
    );

    expect(recordId).not.toBeNull();
    expect(recordId).toContain('hc_');
  });

  it('should fetch active calories and steps metrics', async () => {
    const targetDate = new Date('2026-07-31');
    const metrics = await fetchDailyBurnedMetrics(targetDate);

    expect(metrics).toHaveProperty('activeCaloriesKcal');
    expect(metrics).toHaveProperty('stepCount');
    expect(metrics).toHaveProperty('regularStepCount');
    expect(metrics).toHaveProperty('activityStepCount');
    expect(typeof metrics.activeCaloriesKcal).toBe('number');
    expect(typeof metrics.stepCount).toBe('number');
    expect(typeof metrics.regularStepCount).toBe('number');
    expect(typeof metrics.activityStepCount).toBe('number');
  });

  it('should handle reconcileHealthConnectData gracefully when non-native', async () => {
    const res = await reconcileHealthConnectData(false);
    expect(res).toBeDefined();
    expect(res.reconciledWindowDays).toBe(1);
    expect(res.importedCount).toBe(0);
    expect(res.exportedCount).toBe(0);
  });

  it('estimates exercise calories correctly using MET formulas', () => {
    const runKcal = estimateActivityCalories('RUNNING', 30, 75);
    expect(runKcal).toBeGreaterThan(300); // 30 min running ~ 386 kcal

    const walkKcal = estimateActivityCalories('WALKING', 30, 75);
    expect(walkKcal).toBeLessThan(runKcal);
    expect(walkKcal).toBeGreaterThan(100);
  });
});
