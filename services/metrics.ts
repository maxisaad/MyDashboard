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

  const calories = todayActivities.reduce((sum, a) => sum + (a.calories || 0), 0);
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
  totalDistanceKm: string;
  totalDuration: string;
  totalLoad: number;
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

  const weekActivities = activities.filter(a => {
    const d = new Date(a.start_date);
    return d >= monday && d <= sunday;
  });

  const totalDistance = weekActivities.reduce((sum, a) => sum + a.distance, 0);
  const totalSeconds = weekActivities.reduce((sum, a) => sum + a.duration, 0);
  const totalLoad = weekActivities.reduce((sum, a) => sum + (a.training_load || 0), 0);

  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);

  return {
    totalDistanceKm: (totalDistance / 1000).toFixed(1),
    totalDuration: `${hours}h ${mins}m`,
    totalLoad,
  };
}
