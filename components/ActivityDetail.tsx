import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Activity, SportType } from '../types';
import {
  Clock, Timer, Gauge, Zap, Heart, Thermometer,
  Flame, Mountain, ChevronUp, ChevronDown, X,
  Footprints, Bike, Waves, Dumbbell
} from 'lucide-react';

interface ActivityDetailProps {
  activity: Activity;
  onClose: () => void;
}

// Google polyline decoder
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

const getSportColor = (type: SportType) => {
  switch (type) {
    case SportType.Run: return 'text-lime-400';
    case SportType.Ride: return 'text-cyan-400';
    case SportType.VirtualRide: return 'text-orange-400';
    case SportType.Swim: return 'text-blue-400';
    case SportType.WeightTraining: return 'text-red-400';
    case SportType.Hike: return 'text-amber-400';
    default: return 'text-white';
  }
};

const getSportIcon = (type: SportType, size: number = 20) => {
  switch (type) {
    case SportType.Run: return <Footprints size={size} />;
    case SportType.Ride: return <Bike size={size} />;
    case SportType.VirtualRide: return <Bike size={size} />;
    case SportType.Swim: return <Waves size={size} />;
    case SportType.WeightTraining: return <Dumbbell size={size} />;
    default: return <Zap size={size} />;
  }
};

const getSportLineColor = (type: SportType) => {
  switch (type) {
    case SportType.Run: return '#a3e635';
    case SportType.Ride: return '#22d3ee';
    case SportType.VirtualRide: return '#fb923c';
    case SportType.Swim: return '#60a5fa';
    default: return '#ffffff';
  }
};

const ActivityDetail: React.FC<ActivityDetailProps> = ({ activity, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !activity.polyline) return;

    // Fix Leaflet default icon paths for bundled builds
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const coords = decodePolyline(activity.polyline);
    if (coords.length === 0) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const latlngs = coords.map(([lat, lng]) => L.latLng(lat, lng));
    const polyline = L.polyline(latlngs, {
      color: getSportLineColor(activity.sport_type),
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    map.fitBounds(polyline.getBounds().pad(0.1));
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [activity.polyline, activity.sport_type]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (mPerSec?: number) => {
    if (!mPerSec) return '—';
    const kmh = mPerSec * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatPace = (mPerSec?: number) => {
    if (!mPerSec || mPerSec === 0) return '—';
    const paceSecPerKm = 1000 / mPerSec;
    const min = Math.floor(paceSecPerKm / 60);
    const sec = Math.floor(paceSecPerKm % 60);
    return `${min}'${sec.toString().padStart(2, '0')}" /km`;
  };

  const parseLatLng = (str?: string): [number, number] | null => {
    if (!str) return null;
    const parts = str.split(',').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return [parts[0], parts[1]];
  };

  const startCoords = parseLatLng(activity.start_latlng);
  const isRunning = activity.sport_type === SportType.Run;
  const isCycling = activity.sport_type === SportType.Ride || activity.sport_type === SportType.VirtualRide;

  // Build metrics rows
  const metrics: { label: string; value: string; icon: React.ReactNode }[] = [];

  // Always show
  metrics.push({ label: 'Duration', value: formatDuration(activity.duration), icon: <Timer size={14} /> });
  if (activity.elapsed_time && activity.elapsed_time !== activity.duration) {
    metrics.push({ label: 'Elapsed', value: formatDuration(activity.elapsed_time), icon: <Clock size={14} /> });
  }
  metrics.push({ label: 'Distance', value: `${(activity.distance / 1000).toFixed(2)} km`, icon: <Gauge size={14} /> });

  // Speed / Pace
  if (isRunning) {
    metrics.push({ label: 'Avg Pace', value: formatPace(activity.average_speed), icon: <Timer size={14} /> });
  } else if (activity.average_speed) {
    metrics.push({ label: 'Avg Speed', value: formatSpeed(activity.average_speed), icon: <Gauge size={14} /> });
  }

  // Elevation
  if (activity.elevation_gain > 0) {
    metrics.push({ label: 'Elevation', value: `${activity.elevation_gain} m`, icon: <Mountain size={14} /> });
  }

  // Heart Rate
  if (activity.hr_avg) {
    metrics.push({ label: 'Avg HR', value: `${activity.hr_avg} bpm`, icon: <Heart size={14} /> });
  }
  if (activity.hr_max) {
    metrics.push({ label: 'Max HR', value: `${activity.hr_max} bpm`, icon: <Heart size={14} /> });
  }

  // Power (cycling)
  if (activity.average_watts) {
    metrics.push({ label: 'Avg Power', value: `${activity.average_watts.toFixed(0)} W`, icon: <Zap size={14} /> });
  }
  if (activity.max_watts) {
    metrics.push({ label: 'Max Power', value: `${activity.max_watts.toFixed(0)} W`, icon: <Zap size={14} /> });
  }
  if (activity.kilojoules) {
    metrics.push({ label: 'Energy', value: `${activity.kilojoules.toFixed(0)} kJ`, icon: <Flame size={14} /> });
  }

  // Calories
  if (activity.calories) {
    metrics.push({ label: 'Calories', value: `${activity.calories.toFixed(0)} kcal`, icon: <Flame size={14} /> });
  }

  // Temperature
  if (activity.average_temp) {
    metrics.push({ label: 'Temp', value: `${activity.average_temp}°C`, icon: <Thermometer size={14} /> });
  }

  // Training Load
  if (activity.training_load) {
    metrics.push({ label: 'Load', value: `${activity.training_load}`, icon: <ChevronUp size={14} /> });
  }

  const hasMap = !!activity.polyline;

  return (
    <div className="mt-4 bg-card rounded-xl border border-white/5 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white/5 ${getSportColor(activity.sport_type)}`}>
            {getSportIcon(activity.sport_type)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{activity.name}</h3>
            <div className="text-xs text-text-secondary">
              {new Date(activity.start_date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Map */}
      {hasMap && (
        <div ref={mapRef} className="w-full h-[250px] bg-zinc-900" />
      )}

      {/* Metrics Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-lg p-3 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 text-text-secondary">
                {m.icon}
                <span className="text-[10px] uppercase font-mono">{m.label}</span>
              </div>
              <span className="text-sm font-mono font-semibold text-white">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityDetail;
