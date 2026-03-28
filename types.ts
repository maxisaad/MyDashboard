export enum SportType {
  Run = 'Run',
  Ride = 'Ride',
  VirtualRide = 'VirtualRide',
  Swim = 'Swim',
  WeightTraining = 'WeightTraining',
  Hike = 'Hike'
}

export interface Lap {
  lap_index: number;
  distance: number;        // meters
  moving_time: number;     // seconds
  elapsed_time: number;    // seconds
  average_speed: number;   // m/s
  average_heartrate?: number;
}

export interface Activity {
  id: string;
  strava_id: string;
  sport_type: SportType;
  name: string;
  start_date: string;
  duration: number;        // moving_time (seconds)
  elapsed_time?: number;   // total time incl. stops (seconds)
  distance: number;        // meters
  elevation_gain: number;  // meters
  training_load?: number;  // suffer_score
  hr_avg?: number;
  hr_max?: number;
  calories?: number;
  average_speed?: number;  // m/s
  average_watts?: number;
  max_watts?: number;
  kilojoules?: number;
  average_temp?: number;   // °C
  start_latlng?: string;   // "lat,lng"
  end_latlng?: string;
  polyline?: string;       // encoded Google polyline
  laps?: string;           // JSON string of Lap[]
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
  source: 'local' | 'gcal';
  gcal_calendar_id?: string;
}
