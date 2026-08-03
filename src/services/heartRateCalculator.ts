import { HeartRateSample, HeartRateZones } from '../types';

export interface HeartRateStats {
  avgHeartRateBpm: number;
  minHeartRateBpm: number;
  maxHeartRateBpm: number;
}

/**
  Calculate average, min, and max heart rate from a list of samples.
 */
export function calculateHeartRateStats(samples: HeartRateSample[]): HeartRateStats | null {
  if (!samples || samples.length === 0) {
    return null;
  }

  let sum = 0;
  let min = samples[0].bpm;
  let max = samples[0].bpm;

  for (const sample of samples) {
    sum += sample.bpm;
    if (sample.bpm < min) min = sample.bpm;
    if (sample.bpm > max) max = sample.bpm;
  }

  return {
    avgHeartRateBpm: Math.round(sum / samples.length),
    minHeartRateBpm: Math.round(min),
    maxHeartRateBpm: Math.round(max),
  };
}

/**
  Estimate Maximum Heart Rate using Tanaka formula or 220 - age.
 */
export function estimateMaxHeartRate(age: number = 30): number {
  const safeAge = Math.max(10, Math.min(100, age || 30));
  return Math.round(208 - 0.7 * safeAge);
}

/**
  Calculate minutes spent in each Heart Rate Zone based on HR samples and activity duration.
 */
export function calculateHeartRateZones(
  samples: HeartRateSample[],
  durationMinutes: number,
  userAge: number = 30
): HeartRateZones {
  const maxHr = estimateMaxHeartRate(userAge);

  // Zone boundaries (BPM)
  const z1Upper = maxHr * 0.60;
  const z2Upper = maxHr * 0.70;
  const z3Upper = maxHr * 0.80;
  const z4Upper = maxHr * 0.90;

  let z1Count = 0;
  let z2Count = 0;
  let z3Count = 0;
  let z4Count = 0;
  let z5Count = 0;

  if (samples && samples.length > 0) {
    for (const sample of samples) {
      const bpm = sample.bpm;
      if (bpm < z1Upper) {
        z1Count++;
      } else if (bpm < z2Upper) {
        z2Count++;
      } else if (bpm < z3Upper) {
        z3Count++;
      } else if (bpm < z4Upper) {
        z4Count++;
      } else {
        z5Count++;
      }
    }

    const totalSamples = samples.length;
    const minutesPerSample = durationMinutes / totalSamples;

    return {
      zone1Minutes: Math.round((z1Count * minutesPerSample) * 10) / 10,
      zone2Minutes: Math.round((z2Count * minutesPerSample) * 10) / 10,
      zone3Minutes: Math.round((z3Count * minutesPerSample) * 10) / 10,
      zone4Minutes: Math.round((z4Count * minutesPerSample) * 10) / 10,
      zone5Minutes: Math.round((z5Count * minutesPerSample) * 10) / 10,
    };
  }

  // Fallback if no samples are present: allocate evenly around zone 2 & 3
  const z2Mins = Math.round(durationMinutes * 0.5 * 10) / 10;
  const z3Mins = Math.round(durationMinutes * 0.3 * 10) / 10;
  const z1Mins = Math.round((durationMinutes - z2Mins - z3Mins) * 10) / 10;

  return {
    zone1Minutes: Math.max(0, z1Mins),
    zone2Minutes: z2Mins,
    zone3Minutes: z3Mins,
    zone4Minutes: 0,
    zone5Minutes: 0,
  };
}

/**
  Generate realistic continuous Heart Rate samples for a given workout.
 */
export function generateSyntheticHeartRateSamples(
  startTimeIso: string,
  durationMinutes: number,
  targetAvgBpm: number = 140,
  targetMaxBpm?: number
): {
  samples: HeartRateSample[];
  stats: HeartRateStats;
  zones: HeartRateZones;
} {
  const durationMs = Math.max(1, durationMinutes) * 60 * 1000;
  const startTime = new Date(startTimeIso).getTime() || Date.now();
  const sampleIntervalMs = durationMinutes > 60 ? 120 * 1000 : 60 * 1000; // 1 or 2 min interval
  const pointCount = Math.max(5, Math.floor(durationMs / sampleIntervalMs));

  const baseRestBpm = Math.max(60, targetAvgBpm - 40);
  const peakBpm = targetMaxBpm && targetMaxBpm > targetAvgBpm
    ? targetMaxBpm
    : Math.min(195, Math.round(targetAvgBpm * 1.25));

  const samples: HeartRateSample[] = [];

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1); // 0.0 to 1.0
    const timeMs = startTime + progress * durationMs;
    const isoString = new Date(timeMs).toISOString();

    let bpm: number;
    if (progress < 0.15) {
      // Warmup phase
      const ratio = progress / 0.15;
      bpm = baseRestBpm + (targetAvgBpm - baseRestBpm) * ratio;
    } else if (progress > 0.85) {
      // Cooldown phase
      const ratio = (progress - 0.85) / 0.15;
      bpm = targetAvgBpm - (targetAvgBpm - baseRestBpm - 15) * ratio;
    } else {
      // Workout main phase with realistic variation and intermittent peaks
      const midProgress = (progress - 0.15) / 0.7;
      const sineWave = Math.sin(midProgress * Math.PI * 3) * 8;
      const peakBoost = Math.exp(-Math.pow((midProgress - 0.5) * 4, 2)) * (peakBpm - targetAvgBpm);
      bpm = targetAvgBpm + sineWave + peakBoost;
    }

    // Add deterministic micro jitter based on index
    const jitter = ((i * 7) % 5) - 2;
    const finalBpm = Math.max(50, Math.min(210, Math.round(bpm + jitter)));

    samples.push({
      timestamp: isoString,
      bpm: finalBpm,
    });
  }

  const stats = calculateHeartRateStats(samples) || {
    avgHeartRateBpm: targetAvgBpm,
    minHeartRateBpm: baseRestBpm,
    maxHeartRateBpm: peakBpm,
  };

  const zones = calculateHeartRateZones(samples, durationMinutes);

  return { samples, stats, zones };
}
