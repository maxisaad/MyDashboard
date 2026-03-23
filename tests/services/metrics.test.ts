import { describe, it, expect } from 'vitest';
import { computeDailyMetrics, computeWeeklySummary } from '../../services/metrics';
import { SportType, Activity } from '../../types';

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: '1',
  strava_id: '1001',
  sport_type: SportType.Run,
  start_date: new Date().toISOString(),
  duration: 1800,
  distance: 5000,
  elevation_gain: 50,
  calories: 300,
  training_load: 60,
  hr_avg: 140,
  location_label: 'Test',
  ...overrides,
});

describe('computeDailyMetrics', () => {
  it('returns zero for empty activities', () => {
    const result = computeDailyMetrics([], new Date());
    expect(result.calories).toBe(0);
    expect(result.activeMinutes).toBe(0);
    expect(result.steps).toBe(0);
  });

  it('sums calories from today activities', () => {
    const activities = [
      makeActivity({ calories: 300, duration: 1800 }),
      makeActivity({ calories: 200, duration: 1200 }),
    ];
    const result = computeDailyMetrics(activities, new Date());
    expect(result.calories).toBe(500);
    expect(result.activeMinutes).toBe(50); // (1800+1200)/60 = 50
  });

  it('ignores activities from other days', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const activities = [
      makeActivity({ calories: 300 }),
      makeActivity({ calories: 500, start_date: yesterday }),
    ];
    const result = computeDailyMetrics(activities, new Date());
    expect(result.calories).toBe(300);
  });

  it('includes goals', () => {
    const result = computeDailyMetrics([], new Date());
    expect(result.goals.calories).toBe(2500);
    expect(result.goals.activeMinutes).toBe(60);
  });
});

describe('computeWeeklySummary', () => {
  it('returns zero for empty activities', () => {
    const result = computeWeeklySummary([]);
    expect(result.totalDistanceKm).toBe('0.0');
    expect(result.totalDuration).toBe('0h 0m');
    expect(result.totalLoad).toBe(0);
  });

  it('sums this week activities', () => {
    const activities = [
      makeActivity({ distance: 5000, duration: 1800, training_load: 50 }),
      makeActivity({ distance: 10000, duration: 3600, training_load: 80 }),
    ];
    const result = computeWeeklySummary(activities);
    expect(result.totalDistanceKm).toBe('15.0');
    expect(result.totalDuration).toBe('1h 30m');
    expect(result.totalLoad).toBe(130);
  });
});
