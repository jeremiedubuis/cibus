import {
  fetchDailyBurnedMetrics,
  MEAL_TYPE_MAP,
  reconcileHealthConnectData,
  REVERSE_MEAL_TYPE_MAP,
  syncMealToHealthConnect,
} from '../src/services/healthConnect';

describe('Health Connect Sync Service', () => {
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
    expect(typeof metrics.activeCaloriesKcal).toBe('number');
    expect(typeof metrics.stepCount).toBe('number');
  });

  it('should handle reconcileHealthConnectData gracefully when non-native', async () => {
    const res = await reconcileHealthConnectData(false);
    expect(res).toBeDefined();
    expect(res.reconciledWindowDays).toBe(1);
    expect(res.importedCount).toBe(0);
    expect(res.exportedCount).toBe(0);
  });
});

