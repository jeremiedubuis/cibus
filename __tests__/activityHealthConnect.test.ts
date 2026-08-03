import {
  EXERCISE_TYPE_MAP,
  REVERSE_EXERCISE_TYPE_MAP,
  syncActivityToHealthConnect,
} from '../src/services/healthConnect';
import { ActivityEntry } from '../src/types';

describe('Activity Health Connect Sync & Mapping Suite', () => {
  it('maps sport activity types to Health Connect ExerciseType integer constants', () => {
    expect(EXERCISE_TYPE_MAP.RUNNING).toBe(56);
    expect(EXERCISE_TYPE_MAP.ELLIPTICAL).toBe(25);
    expect(EXERCISE_TYPE_MAP.CALISTHENICS).toBe(13);
    expect(EXERCISE_TYPE_MAP.SWIMMING).toBe(71);
    expect(EXERCISE_TYPE_MAP.BICYCLE).toBe(8);
    expect(EXERCISE_TYPE_MAP.CLIMBING).toBe(55);

    expect(REVERSE_EXERCISE_TYPE_MAP[56]).toBe('RUNNING');
    expect(REVERSE_EXERCISE_TYPE_MAP[25]).toBe('ELLIPTICAL');
    expect(REVERSE_EXERCISE_TYPE_MAP[13]).toBe('CALISTHENICS');
    expect(REVERSE_EXERCISE_TYPE_MAP[71]).toBe('SWIMMING');
    expect(REVERSE_EXERCISE_TYPE_MAP[8]).toBe('BICYCLE');
    expect(REVERSE_EXERCISE_TYPE_MAP[55]).toBe('CLIMBING');
  });

  it('syncs activity entry and returns record identifier in fallback/mock mode', async () => {
    const activity: ActivityEntry = {
      id: 'act_101',
      date: '2026-08-04',
      startTime: '2026-08-04T17:30:00.000Z',
      durationMinutes: 20,
      activityType: 'RUNNING',
      caloriesKcal: 220,
      distanceKm: 3.2,
    };

    const hcId = await syncActivityToHealthConnect(activity);
    expect(hcId).not.toBeNull();
    expect(hcId).toContain('mock_hc_act_');
  });

  it('handles activity sync for elliptical bike and calisthenics', async () => {
    const elliptical: ActivityEntry = {
      id: 'act_102',
      date: '2026-08-04',
      startTime: '2026-08-04T18:00:00.000Z',
      durationMinutes: 40,
      activityType: 'ELLIPTICAL',
      caloriesKcal: 350,
    };

    const calisthenics: ActivityEntry = {
      id: 'act_103',
      date: '2026-08-04',
      startTime: '2026-08-04T19:00:00.000Z',
      durationMinutes: 25,
      activityType: 'CALISTHENICS',
      caloriesKcal: 190,
    };

    const id1 = await syncActivityToHealthConnect(elliptical);
    const id2 = await syncActivityToHealthConnect(calisthenics);

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
  });
});
