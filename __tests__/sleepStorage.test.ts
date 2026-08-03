import {
  _resetDatabaseState,
  addSleepEntry,
  deleteSleepEntry,
  findSleepEntryByHealthConnectId,
  getAllSleepEntries,
  getSleepEntriesByDate,
  getUserProfile,
  initDatabase,
  saveUserProfile,
  updateSleepEntry,
  updateSleepHealthConnectId,
} from '../src/services/database';

describe('Sleep Storage & Profile Target Sleep Suite', () => {
  beforeEach(async () => {
    _resetDatabaseState();
    await initDatabase();
  });

  it('initializes profile with default 480 minutes (8 hours) sleep goal', async () => {
    const profile = await getUserProfile();
    expect(profile.targetSleepMinutes).toBe(480);
  });

  it('updates and persists customizable target sleep goal in user profile', async () => {
    const initialProfile = await getUserProfile();
    await saveUserProfile({
      ...initialProfile,
      targetSleepMinutes: 420, // 7 hours
    });

    const updatedProfile = await getUserProfile();
    expect(updatedProfile.targetSleepMinutes).toBe(420);
  });

  it('adds a sleep entry and queries it by date', async () => {
    const entry = await addSleepEntry({
      date: '2026-08-05',
      startTime: '2026-08-04T23:00:00.000Z',
      endTime: '2026-08-05T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 85,
      isNap: false,
      deepSleepMinutes: 90,
      remSleepMinutes: 100,
      source: 'MANUAL',
    });

    expect(entry.id).toBeDefined();
    expect(entry.id).toContain('sleep_');

    const byDate = await getSleepEntriesByDate('2026-08-05');
    expect(byDate.length).toBe(1);
    expect(byDate[0].durationMinutes).toBe(480);
    expect(byDate[0].isNap).toBe(false);
  });

  it('updates an existing sleep entry', async () => {
    const added = await addSleepEntry({
      date: '2026-08-05',
      startTime: '2026-08-05T13:00:00.000Z',
      endTime: '2026-08-05T13:45:00.000Z',
      durationMinutes: 45,
      qualityScore: 60,
      isNap: true,
      notes: 'Quick afternoon power nap',
    });

    const updated = await updateSleepEntry(added.id, {
      durationMinutes: 60,
      notes: 'Extended nap',
    });

    expect(updated).not.toBeNull();
    expect(updated?.durationMinutes).toBe(60);
    expect(updated?.notes).toBe('Extended nap');

    const byDate = await getSleepEntriesByDate('2026-08-05');
    expect(byDate[0].durationMinutes).toBe(60);
  });

  it('deletes a sleep entry', async () => {
    const added = await addSleepEntry({
      date: '2026-08-05',
      startTime: '2026-08-04T23:00:00.000Z',
      endTime: '2026-08-05T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 85,
      isNap: false,
    });

    await deleteSleepEntry(added.id);

    const byDate = await getSleepEntriesByDate('2026-08-05');
    expect(byDate.length).toBe(0);
  });

  it('links and finds sleep entries by Health Connect ID', async () => {
    const added = await addSleepEntry({
      date: '2026-08-05',
      startTime: '2026-08-04T23:00:00.000Z',
      endTime: '2026-08-05T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 90,
      isNap: false,
    });

    const hcRecordId = 'hc_sleep_record_12345';
    await updateSleepHealthConnectId(added.id, hcRecordId);

    const found = await findSleepEntryByHealthConnectId(hcRecordId);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(added.id);
  });

  it('filters all sleep entries by date range', async () => {
    await addSleepEntry({
      date: '2026-08-01',
      startTime: '2026-07-31T23:00:00.000Z',
      endTime: '2026-08-01T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 80,
      isNap: false,
    });

    await addSleepEntry({
      date: '2026-08-05',
      startTime: '2026-08-04T23:00:00.000Z',
      endTime: '2026-08-05T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 88,
      isNap: false,
    });

    await addSleepEntry({
      date: '2026-08-10',
      startTime: '2026-08-09T23:00:00.000Z',
      endTime: '2026-08-10T07:00:00.000Z',
      durationMinutes: 480,
      qualityScore: 85,
      isNap: false,
    });

    const range = await getAllSleepEntries('2026-08-02', '2026-08-08');
    expect(range.length).toBe(1);
    expect(range[0].date).toBe('2026-08-05');
  });
});
