import { Activity, SportType, DailyMetrics, CalendarEvent } from '../types';

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    strava_id: '1001',
    sport_type: SportType.Run,
    start_date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    duration: 3200,
    distance: 8500,
    elevation_gain: 120,
    training_load: 85,
    hr_avg: 145,
    calories: 650,
    location_label: 'Morning Loop'
  },
  {
    id: '2',
    strava_id: '1002',
    sport_type: SportType.Ride,
    start_date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    duration: 5400,
    distance: 32000,
    elevation_gain: 450,
    training_load: 110,
    hr_avg: 130,
    calories: 900,
    location_label: 'Commute'
  },
  {
    id: '3',
    strava_id: '1003',
    sport_type: SportType.WeightTraining,
    start_date: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    duration: 2700,
    distance: 0,
    elevation_gain: 0,
    training_load: 60,
    hr_avg: 110,
    calories: 300,
    location_label: 'Garage Gym'
  },
  {
    id: '4',
    strava_id: '1004',
    sport_type: SportType.Run,
    start_date: new Date(Date.now() - 1000 * 60 * 60 * 74).toISOString(),
    duration: 1800,
    distance: 5000,
    elevation_gain: 45,
    training_load: 55,
    hr_avg: 155,
    calories: 400,
    location_label: 'Speed Work'
  },
  {
    id: '5',
    strava_id: '1005',
    sport_type: SportType.Swim,
    start_date: new Date(Date.now() - 1000 * 60 * 60 * 98).toISOString(),
    duration: 2400,
    distance: 2000,
    elevation_gain: 0,
    training_load: 90,
    hr_avg: 125,
    calories: 500,
    location_label: 'Pool Laps'
  }
];

export const MOCK_DAILY_METRICS: DailyMetrics = {
  steps: 8432,
  calories: 2150,
  activeMinutes: 55,
  goals: {
    steps: 10000,
    calories: 2500,
    activeMinutes: 60
  }
};

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Marathon Training - Long Run',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 27).toISOString(),
    isAllDay: false,
    color: '#a3e635'
  },
  {
    id: 'e2',
    title: 'Rest Day',
    start: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    isAllDay: true,
    color: '#6366f1'
  },
  {
    id: 'e3',
    title: 'Physio Appointment',
    start: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 73).toISOString(),
    isAllDay: false,
    color: '#a1a1aa'
  }
];