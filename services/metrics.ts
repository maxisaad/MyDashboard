import { Activity, DailyMetrics } from '../types';

export function computeDailyMetrics(activities: Activity[], date: Date): DailyMetrics {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const todayActivities = activities.filter(a => {
    const d = new Date(a.start_date);
    return d >= dayStart && d <= dayEnd;
  });

  // Estimate calories: prefer power-based for cycling, then Strava data, then MET fallback
  const estimateCalories = (a: Activity): number => {
    if (a.calories && a.calories > 0) return a.calories;

    // Power-based (cycling): kcal ≈ kJ × 1.15 (accounts for ~22% body efficiency)
    if (a.average_watts && a.duration > 0) {
      const kJ = (a.average_watts * a.duration) / 1000;
      return Math.round(kJ * 1.15);
    }

    // MET-based fallback (~70kg reference)
    const hours = a.duration / 3600;
    const met = a.sport_type === 'Run' ? 10
      : a.sport_type === 'Ride' ? 8
      : a.sport_type === 'VirtualRide' ? 7
      : a.sport_type === 'Swim' ? 8
      : a.sport_type === 'WeightTraining' ? 5
      : a.sport_type === 'Hike' ? 6
      : 5;
    return Math.round(met * 70 * hours);
  };

  const calories = todayActivities.reduce((sum, a) => sum + estimateCalories(a), 0);
  const activeMinutes = Math.round(
    todayActivities.reduce((sum, a) => sum + a.duration, 0) / 60
  );

  return {
    steps: 0, // Strava ne fournit pas les steps
    calories,
    activeMinutes,
    goals: {
      steps: 10000,
      calories: 2500,
      activeMinutes: 60,
    },
  };
}

export interface WeeklySummary {
  runDistanceKm: string;
  bikeDistanceKm: string;
  totalDuration: string;
}

export function computeWeeklySummary(activities: Activity[], weekOffset: number = 0): WeeklySummary {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);

  const monday = new Date(today);
  monday.setDate(diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return computePeriodSummary(activities, monday, sunday);
}

export function computePeriodSummary(activities: Activity[], start: Date, end: Date): WeeklySummary {
  const filtered = activities.filter(a => {
    const d = new Date(a.start_date);
    return d >= start && d <= end;
  });

  const runDistance = filtered
    .filter(a => a.sport_type === 'Run' || a.sport_type === 'TrailRun')
    .reduce((sum, a) => sum + a.distance, 0);

  const bikeDistance = filtered
    .filter(a => a.sport_type === 'Ride' || a.sport_type === 'VirtualRide')
    .reduce((sum, a) => sum + a.distance, 0);

  const totalSeconds = filtered.reduce((sum, a) => sum + a.duration, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);

  return {
    runDistanceKm: (runDistance / 1000).toFixed(1),
    bikeDistanceKm: (bikeDistance / 1000).toFixed(1),
    totalDuration: `${hours}h ${mins}m`,
  };
}

export function computeThisWeekSummary(activities: Activity[]): WeeklySummary {
  return computeWeeklySummary(activities, 0);
}

export function computeLastWeekSummary(activities: Activity[]): WeeklySummary {
  return computeWeeklySummary(activities, -1);
}

export function computeThisMonthSummary(activities: Activity[]): WeeklySummary {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return computePeriodSummary(activities, start, end);
}

export function computeLastMonthSummary(activities: Activity[]): WeeklySummary {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  end.setHours(23, 59, 59, 999);
  return computePeriodSummary(activities, start, end);
}

export function computeThisYearSummary(activities: Activity[]): WeeklySummary {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);
  return computePeriodSummary(activities, start, end);
}

export function computeLastYearSummary(activities: Activity[]): WeeklySummary {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear() - 1, 11, 31);
  end.setHours(23, 59, 59, 999);
  return computePeriodSummary(activities, start, end);
}
