import { SleepEntry } from '../types';

export const DEFAULT_SLEEP_TARGET_MINUTES = 480; // 8 hours

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Assigns a sleep session to a date and determines if it is a nap or overnight sleep.
 * Rules:
 * - Start time >= 7:00 PM (19:00): assigned to the NEXT calendar day, isNap = false.
 * - Start time between 11:00 AM (11:00) and 7:00 PM (19:00): assigned to CURRENT day, isNap = true.
 * - Start time before 11:00 AM (11:00): assigned to CURRENT day, isNap = false.
 */
export function assignSleepDateAndType(startInput: Date | string): { dateStr: string; isNap: boolean } {
  const date = typeof startInput === 'string' ? new Date(startInput) : new Date(startInput.getTime());

  if (isNaN(date.getTime())) {
    const fallbackDate = new Date();
    return { dateStr: formatDateLocal(fallbackDate), isNap: false };
  }

  const hour = date.getHours();

  if (hour >= 19) {
    // 7 PM or later -> Next day morning wake date
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return { dateStr: formatDateLocal(nextDay), isNap: false };
  } else if (hour >= 11 && hour < 19) {
    // 11 AM to 7 PM -> Daytime nap
    return { dateStr: formatDateLocal(date), isNap: true };
  } else {
    // Before 11 AM -> Morning / Early hours sleep belonging to current wake day
    return { dateStr: formatDateLocal(date), isNap: false };
  }
}

/**
 * Calculates a Sleep Quality Score between 0 and 100 based on user's target sleep,
 * total sleep duration, sleep stage distribution (deep, REM), and awake interruptions.
 */
export function calculateSleepQualityScore(
  totalDurationMinutes: number,
  targetSleepMinutes: number = DEFAULT_SLEEP_TARGET_MINUTES,
  deepSleepMinutes?: number,
  remSleepMinutes?: number,
  awakeMinutes?: number
): number {
  if (totalDurationMinutes <= 0) return 0;

  const validTarget = Math.max(120, targetSleepMinutes); // minimum 2h target sanity check

  // 1. Duration Score (max 60 points)
  const ratio = totalDurationMinutes / validTarget;
  let durationScore = 0;
  if (ratio >= 0.9 && ratio <= 1.1) {
    durationScore = 60;
  } else if (ratio > 1.1) {
    // Oversleeping penalty (slight)
    durationScore = Math.max(40, 60 - Math.round((ratio - 1.1) * 40));
  } else {
    // Undersleeping linear scale
    durationScore = Math.max(0, Math.round(ratio * 60));
  }

  // 2. Stage Breakdown Score (max 30 points)
  let stageScore = 24; // Default baseline if stage breakdown is unknown
  if (
    typeof deepSleepMinutes === 'number' &&
    typeof remSleepMinutes === 'number' &&
    totalDurationMinutes > 0
  ) {
    const deepRatio = deepSleepMinutes / totalDurationMinutes;
    const remRatio = remSleepMinutes / totalDurationMinutes;

    let deepPts = 0;
    if (deepRatio >= 0.15 && deepRatio <= 0.25) {
      deepPts = 15;
    } else if (deepRatio > 0) {
      deepPts = Math.min(15, Math.round((deepRatio / 0.15) * 15));
    }

    let remPts = 0;
    if (remRatio >= 0.20 && remRatio <= 0.25) {
      remPts = 15;
    } else if (remRatio > 0) {
      remPts = Math.min(15, Math.round((remRatio / 0.20) * 15));
    }

    stageScore = deepPts + remPts;
  }

  // 3. Awakening Interruption Penalty (deduct up to 10 points)
  let awakePenalty = 0;
  if (typeof awakeMinutes === 'number' && awakeMinutes > 20) {
    awakePenalty = Math.min(10, Math.round((awakeMinutes - 20) / 5));
  }

  const finalScore = Math.max(0, Math.min(100, durationScore + stageScore - awakePenalty));
  return finalScore;
}

export type SleepRatingCategory = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface SleepRatingInfo {
  rating: SleepRatingCategory;
  color: string;
  labelKey: string;
}

export function getSleepQualityRating(score: number): SleepRatingInfo {
  if (score >= 85) {
    return { rating: 'EXCELLENT', color: '#10B981', labelKey: 'sleep.qualityExcellent' };
  } else if (score >= 70) {
    return { rating: 'GOOD', color: '#3B82F6', labelKey: 'sleep.qualityGood' };
  } else if (score >= 50) {
    return { rating: 'FAIR', color: '#F59E0B', labelKey: 'sleep.qualityFair' };
  } else {
    return { rating: 'POOR', color: '#EF4444', labelKey: 'sleep.qualityPoor' };
  }
}

/**
 * Calculates aggregate stats for all sleep entries on a single day.
 */
export function aggregateDailySleep(
  entries: SleepEntry[],
  targetSleepMinutes: number = DEFAULT_SLEEP_TARGET_MINUTES
) {
  const overnightEntries = entries.filter((e) => !e.isNap);
  const napEntries = entries.filter((e) => e.isNap);

  const totalOvernightMinutes = overnightEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalNapMinutes = napEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalSleepMinutes = totalOvernightMinutes + totalNapMinutes;

  const totalDeepMinutes = entries.reduce((sum, e) => sum + (e.deepSleepMinutes || 0), 0);
  const totalRemMinutes = entries.reduce((sum, e) => sum + (e.remSleepMinutes || 0), 0);
  const totalLightMinutes = entries.reduce((sum, e) => sum + (e.lightSleepMinutes || 0), 0);
  const totalAwakeMinutes = entries.reduce((sum, e) => sum + (e.awakeMinutes || 0), 0);

  // Daily Score is primary overnight quality score or composite
  let overallScore = 0;
  if (overnightEntries.length > 0) {
    overallScore = calculateSleepQualityScore(
      totalSleepMinutes,
      targetSleepMinutes,
      totalDeepMinutes > 0 ? totalDeepMinutes : undefined,
      totalRemMinutes > 0 ? totalRemMinutes : undefined,
      totalAwakeMinutes > 0 ? totalAwakeMinutes : undefined
    );
  } else if (napEntries.length > 0) {
    overallScore = 60; // Baseline for naps only
  }

  return {
    totalOvernightMinutes,
    totalNapMinutes,
    totalSleepMinutes,
    totalDeepMinutes,
    totalRemMinutes,
    totalLightMinutes,
    totalAwakeMinutes,
    overallScore,
    ratingInfo: getSleepQualityRating(overallScore),
    overnightEntries,
    napEntries,
  };
}
