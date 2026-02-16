export enum SportType {
  Run = 'Run',
  Ride = 'Ride',
  Swim = 'Swim',
  WeightTraining = 'WeightTraining',
  Hike = 'Hike'
}

export interface Activity {
  id: string;
  strava_id: string;
  sport_type: SportType;
  start_date: string; // ISO String
  duration: number; // seconds
  distance: number; // meters
  elevation_gain: number; // meters
  training_load?: number; // arbitrary score
  hr_avg?: number;
  calories?: number;
  location_label: string;
}

export interface DailyMetrics {
  steps: number;
  calories: number;
  activeMinutes: number;
  goals: {
    steps: number;
    calories: number;
    activeMinutes: number;
  }
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO String
  end: string; // ISO String
  isAllDay: boolean;
  color?: string;
}

export interface AppSettings {
  stravaClientId: string;
  stravaClientSecret: string;
  lastSync: string | null;
}