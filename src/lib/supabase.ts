// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// .env 혹은 Vite 환경변수 기준
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
});

// 화면에서 사용할 Shelter 타입
export type Shelter = {
  facility_serial: number;
  name: string;
  road_addr: string | null;
  region_code: number | null;
  area_sqm: number | null;
  capacity: number | null;
  lon: number;
  lat: number;

  // 화면용 파생 필드들
  address: string;
  is_24h_open: boolean;
  facilities: {
    medical: boolean;
    restroom: boolean;
    supplies: boolean;
    wifi: boolean;
    generator: boolean;
    emergency_power: boolean;
    pets_allowed: boolean;
  };
};
