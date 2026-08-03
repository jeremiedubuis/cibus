import {
  _resetDatabaseState,
  addActivityEntry,
  deleteActivityEntry,
  findActivityEntryByHealthConnectId,
  getActivityEntriesByDate,
  getAllActivityEntries,
  getUserProfile,
  initDatabase,
  saveUserProfile,
  updateActivityEntry,
  updateActivityHealthConnectId,
} from '../src/services/database';

describe('Activity Storage & Profile Default Duration Suite', () => {
  beforeEach(async () => {
    _resetDatabaseState();
    await initDatabase();
  });

  it('initializes default user profile with 20 minutes default workout duration', async () => {
    const profile = await getUserProfile();
    expect(profile.defaultWorkoutDurationMinutes).toBe(20);
  });

  it('updates and persists default workout duration in user profile', async () => {
    const profile = await getUserProfile();
    const updated = await saveUserProfile({
      ...profile,
      defaultWorkoutDurationMinutes: 45,
    });

    expect(updated.defaultWorkoutDurationMinutes).toBe(45);
    const reFetched = await getUserProfile();
    expect(reFetched.defaultWorkoutDurationMinutes).toBe(45);
  });

  it('adds a sport activity entry and retrieves it by date', async () => {
    const entry = await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T18:00:00.000Z',
      durationMinutes: 30,
      activityType: 'RUNNING',
      caloriesKcal: 320,
      distanceKm: 5.2,
    });

    expect(entry.id).toBeDefined();
    expect(entry.id).toContain('activity_');
    expect(entry.activityType).toBe('RUNNING');
    expect(entry.caloriesKcal).toBe(320);

    const dateEntries = await getActivityEntriesByDate('2026-08-04');
    expect(dateEntries).toHaveLength(1);
    expect(dateEntries[0].id).toBe(entry.id);
  });

  it('updates an existing activity entry', async () => {
    const entry = await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T18:00:00.000Z',
      durationMinutes: 20,
      activityType: 'ELLIPTICAL',
      caloriesKcal: 180,
    });

    const updated = await updateActivityEntry(entry.id, {
      durationMinutes: 35,
      caloriesKcal: 290,
      distanceKm: 4.0,
    });

    expect(updated).not.toBeNull();
    expect(updated?.durationMinutes).toBe(35);
    expect(updated?.caloriesKcal).toBe(290);
    expect(updated?.distanceKm).toBe(4.0);
  });

  it('deletes an activity entry', async () => {
    const entry1 = await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T10:00:00.000Z',
      durationMinutes: 20,
      activityType: 'CALISTHENICS',
      caloriesKcal: 150,
    });
    const entry2 = await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T14:00:00.000Z',
      durationMinutes: 30,
      activityType: 'RUNNING',
      caloriesKcal: 300,
    });

    expect(await getActivityEntriesByDate('2026-08-04')).toHaveLength(2);

    await deleteActivityEntry(entry1.id);

    const remaining = await getActivityEntriesByDate('2026-08-04');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(entry2.id);
  });

  it('links and finds activity entries by Health Connect ID', async () => {
    const entry = await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T15:00:00.000Z',
      durationMinutes: 25,
      activityType: 'RUNNING',
      caloriesKcal: 240,
    });

    await updateActivityHealthConnectId(entry.id, 'hc_session_123');

    const found = await findActivityEntryByHealthConnectId('hc_session_123');
    expect(found).not.toBeNull();
    expect(found?.id).toBe(entry.id);
  });

  it('filters all activity entries by date range', async () => {
    await addActivityEntry({
      date: '2026-08-01',
      startTime: '2026-08-01T10:00:00.000Z',
      durationMinutes: 20,
      activityType: 'RUNNING',
      caloriesKcal: 200,
    });
    await addActivityEntry({
      date: '2026-08-04',
      startTime: '2026-08-04T10:00:00.000Z',
      durationMinutes: 20,
      activityType: 'CALISTHENICS',
      caloriesKcal: 150,
    });
    await addActivityEntry({
      date: '2026-08-10',
      startTime: '2026-08-10T10:00:00.000Z',
      durationMinutes: 20,
      activityType: 'ELLIPTICAL',
      caloriesKcal: 180,
    });

    const windowEntries = await getAllActivityEntries('2026-08-02', '2026-08-05');
    expect(windowEntries).toHaveLength(1);
    expect(windowEntries[0].date).toBe('2026-08-04');
  });

  it('stores and retrieves activity entries with heart rate data and zones', async () => {
    const entry = await addActivityEntry({
      date: '2026-08-05',
      startTime: '2026-08-05T10:00:00.000Z',
      durationMinutes: 40,
      activityType: 'RUNNING',
      caloriesKcal: 420,
      avgHeartRateBpm: 148,
      maxHeartRateBpm: 178,
      minHeartRateBpm: 98,
      heartRateSamples: [
        { timestamp: '2026-08-05T10:00:00.000Z', bpm: 98 },
        { timestamp: '2026-08-05T10:20:00.000Z', bpm: 178 },
        { timestamp: '2026-08-05T10:40:00.000Z', bpm: 148 },
      ],
      heartRateZones: {
        zone1Minutes: 5,
        zone2Minutes: 10,
        zone3Minutes: 15,
        zone4Minutes: 8,
        zone5Minutes: 2,
      },
    });

    const fetched = await getActivityEntriesByDate('2026-08-05');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].avgHeartRateBpm).toBe(148);
    expect(fetched[0].maxHeartRateBpm).toBe(178);
    expect(fetched[0].heartRateSamples).toHaveLength(3);
    expect(fetched[0].heartRateZones?.zone3Minutes).toBe(15);
  });
});
