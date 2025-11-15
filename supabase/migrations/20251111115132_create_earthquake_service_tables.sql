/*
  # Paju City Earthquake Evacuation Service - Database Schema

  1. New Tables
    - `shelters` - Emergency evacuation shelters
      - `id` (uuid, primary key)
      - `name` (text) - Shelter name
      - `address` (text) - Full address
      - `latitude` (numeric) - GPS latitude
      - `longitude` (numeric) - GPS longitude
      - `capacity` (integer) - Maximum capacity
      - `facilities` (jsonb) - Facility information (medical, restroom, supplies, etc.)
      - `contact` (text) - Contact phone number
      - `is_24h_open` (boolean) - 24/7 availability
      - `shelter_type` (text) - Type of shelter (school, gym, community center)
      - `created_at` (timestamptz)

    - `earthquakes` - Historical earthquake data
      - `id` (uuid, primary key)
      - `occurred_at` (timestamptz) - When earthquake occurred
      - `location` (text) - Location description
      - `distance_from_paju` (numeric) - Distance in km
      - `magnitude` (numeric) - Earthquake magnitude
      - `depth` (numeric) - Depth in km
      - `created_at` (timestamptz)

    - `fault_lines` - Geological fault line data
      - `id` (uuid, primary key)
      - `name` (text) - Fault line name
      - `coordinates` (jsonb) - Array of coordinates
      - `risk_level` (text) - Low, Medium, High
      - `created_at` (timestamptz)

    - `user_searches` - User search history
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to auth.users (nullable for anonymous)
      - `address` (text) - Searched address
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `created_at` (timestamptz)

    - `chatbot_conversations` - AI chatbot conversation logs
      - `id` (uuid, primary key)
      - `session_id` (uuid) - Conversation session
      - `user_message` (text)
      - `bot_response` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for shelters, earthquakes, and fault_lines
    - User-specific access for user_searches
    - Public insert for chatbot_conversations
*/

-- Create shelters table
CREATE TABLE IF NOT EXISTS shelters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  facilities jsonb DEFAULT '{}'::jsonb,
  contact text,
  is_24h_open boolean DEFAULT true,
  shelter_type text,
  created_at timestamptz DEFAULT now()
);

-- Create earthquakes table
CREATE TABLE IF NOT EXISTS earthquakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL,
  location text NOT NULL,
  distance_from_paju numeric NOT NULL,
  magnitude numeric NOT NULL,
  depth numeric,
  created_at timestamptz DEFAULT now()
);

-- Create fault_lines table
CREATE TABLE IF NOT EXISTS fault_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  coordinates jsonb NOT NULL,
  risk_level text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create user_searches table
CREATE TABLE IF NOT EXISTS user_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create chatbot_conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_message text NOT NULL,
  bot_response text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE earthquakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fault_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shelters (public read)
CREATE POLICY "Anyone can view shelters"
  ON shelters FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policies for earthquakes (public read)
CREATE POLICY "Anyone can view earthquake data"
  ON earthquakes FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policies for fault_lines (public read)
CREATE POLICY "Anyone can view fault lines"
  ON fault_lines FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policies for user_searches
CREATE POLICY "Users can view own searches"
  ON user_searches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own searches"
  ON user_searches FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- RLS Policies for chatbot_conversations
CREATE POLICY "Anyone can insert conversations"
  ON chatbot_conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view conversations"
  ON chatbot_conversations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Insert sample shelter data
INSERT INTO shelters (name, address, latitude, longitude, capacity, facilities, contact, is_24h_open, shelter_type) VALUES
  ('금촌초등학교 체육관', '경기도 파주시 금촌동 123-45', 37.7599, 126.7816, 300, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "generator": true}'::jsonb, '031-123-4567', true, 'school'),
  ('파주운동장', '경기도 파주시 중앙로 242', 37.7614, 126.7803, 500, '{"medical": false, "restroom": true, "supplies": false, "wifi": false}'::jsonb, '031-940-4567', true, 'sports_facility'),
  ('금촌문화센터', '경기도 파주시 금촌3동 512개', 37.7580, 126.7850, 200, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "pets_allowed": true}'::jsonb, '031-940-5678', true, 'community_center'),
  ('교하초등학교', '경기도 파주시 교하동 512-1', 37.7012, 126.7456, 350, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "generator": true}'::jsonb, '031-945-1234', true, 'school'),
  ('문산체육관', '경기도 파주시 문산읍 당동리', 37.8603, 126.7881, 400, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "emergency_power": true}'::jsonb, '031-952-3456', true, 'sports_facility'),
  ('탄현종합사회복지관', '경기도 파주시 탄현면', 37.7890, 126.7123, 250, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "pets_allowed": true}'::jsonb, '031-943-7890', true, 'welfare_center'),
  ('운정중학교', '경기도 파주시 와동동', 37.7234, 126.7567, 400, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "generator": true}'::jsonb, '031-946-5678', true, 'school'),
  ('파주시청 대강당', '경기도 파주시 시청로 50', 37.7609, 126.7801, 300, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "emergency_power": true}'::jsonb, '031-940-4114', true, 'government'),
  ('법원읍체육관', '경기도 파주시 법원읍', 37.8456, 126.8234, 280, '{"medical": false, "restroom": true, "supplies": true, "wifi": true}'::jsonb, '031-958-3344', true, 'sports_facility'),
  ('적성면주민센터', '경기도 파주시 적성면', 37.9123, 126.8901, 150, '{"medical": true, "restroom": true, "supplies": true, "wifi": false}'::jsonb, '031-950-4500', true, 'community_center'),
  ('광탄면체육관', '경기도 파주시 광탄면', 37.6789, 126.8456, 320, '{"medical": false, "restroom": true, "supplies": true, "wifi": true}'::jsonb, '031-949-6677', true, 'sports_facility'),
  ('조리읍문화센터', '경기도 파주시 조리읍', 37.7456, 126.8123, 200, '{"medical": true, "restroom": true, "supplies": true, "wifi": true, "pets_allowed": false}'::jsonb, '031-940-8899', true, 'community_center');

-- Insert sample earthquake data
INSERT INTO earthquakes (occurred_at, location, distance_from_paju, magnitude, depth) VALUES
  ('2023-10-26 08:14:22', '인천, 남서쪽', 120, 2.1, 15),
  ('2023-10-24 15:30:05', '강릉, 서쪽', 165, 1.9, 12),
  ('2023-09-15 03:22:11', '서울, 동쪽', 45, 2.3, 18),
  ('2023-08-30 19:45:33', '파주, 북쪽', 15, 2.0, 10),
  ('2023-07-12 11:05:44', '개성, 남쪽', 35, 2.8, 20);

-- Insert sample fault line data
INSERT INTO fault_lines (name, coordinates, risk_level) VALUES
  ('추가령구조곡', '[{"lat": 38.2, "lng": 127.0}, {"lat": 37.8, "lng": 126.8}, {"lat": 37.6, "lng": 126.7}]'::jsonb, 'medium'),
  ('경기단층대', '[{"lat": 37.9, "lng": 126.9}, {"lat": 37.7, "lng": 126.8}, {"lat": 37.5, "lng": 126.7}]'::jsonb, 'low'),
  ('임진강단층', '[{"lat": 38.0, "lng": 126.8}, {"lat": 37.9, "lng": 126.7}, {"lat": 37.8, "lng": 126.6}]'::jsonb, 'medium');