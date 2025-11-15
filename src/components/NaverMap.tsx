// src/components/NaverMap.tsx
import { useEffect, useRef } from 'react';
import type { Shelter } from '../lib/supabase';
import { loadNaverMap } from '../lib/loadNaverMap';

interface NaverMapProps {
  shelters: Shelter[];
  userPos: { lat: number; lon: number } | null;
  selectedShelter: Shelter | null;
  onSelectShelter: (s: Shelter) => void;
}

export default function NaverMap({
  shelters,
  userPos,
  selectedShelter,
  onSelectShelter,
}: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // 지도 생성 + 마커 표시
  useEffect(() => {
    let canceled = false;

    (async () => {
      await loadNaverMap();
      if (canceled || !mapRef.current) return;

      const maps = (window as any).naver.maps;
      const center = userPos
        ? new maps.LatLng(userPos.lat, userPos.lon)
        : new maps.LatLng(37.7599, 126.78); // 파주시 대략 중심

      const map = new maps.Map(mapRef.current, {
        center,
        zoom: 11,
      });

      mapInstanceRef.current = map;

      // 기준점(사용자 위치) 마커
      if (userPos) {
        new maps.Marker({
          position: center,
          map,
          icon: {
            content:
              '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>',
          },
        });
      }

      // 대피소 마커
      shelters.forEach((shelter) => {
        if (!shelter.lat || !shelter.lon) return;
        const marker = new maps.Marker({
          position: new maps.LatLng(shelter.lat, shelter.lon),
          map,
        });
        maps.Event.addListener(marker, 'click', () => {
          onSelectShelter(shelter);
        });
      });
    })();

    return () => {
      canceled = true;
    };
  }, [shelters, userPos, onSelectShelter]);

  // 선택된 대피소로 중심 이동
  useEffect(() => {
    (async () => {
      if (!selectedShelter || !selectedShelter.lat || !selectedShelter.lon)
        return;
      await loadNaverMap();
      const maps = (window as any).naver.maps;
      const map = mapInstanceRef.current;
      if (!map) return;

      const latlng = new maps.LatLng(selectedShelter.lat, selectedShelter.lon);
      map.setCenter(latlng);
      map.setZoom(13);
    })();
  }, [selectedShelter]);

  return <div ref={mapRef} className="w-full h-full" />;
}
