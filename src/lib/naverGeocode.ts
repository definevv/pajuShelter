// src/lib/naverGeocode.ts
import { loadNaverMap } from './loadNaverMap';

export interface GeoPoint {
  lat: number;
  lon: number;
  address: string;
}

export async function geocodeWithNaver(query: string): Promise<GeoPoint | null> {
  if (!query.trim()) return null;

  await loadNaverMap();

  return new Promise((resolve) => {
    const svc = (window as any).naver.maps.Service;

    svc.geocode({ query }, (status: any, response: any) => {
      const maps = (window as any).naver.maps;
      if (status !== maps.Service.Status.OK) {
        resolve(null);
        return;
      }

      const result = response.v2?.addresses?.[0];
      if (!result) {
        resolve(null);
        return;
      }

      const lat = parseFloat(result.y);
      const lon = parseFloat(result.x);
      const address = result.roadAddress || result.jibunAddress || query;

      resolve({ lat, lon, address });
    });
  });
}
