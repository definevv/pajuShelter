// src/components/ShelterDetail.tsx
import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Map as MapIcon,
  Star,
} from 'lucide-react';

// 네이버 지도 타입 선언 (window.naver 사용을 위해)
declare global {
  interface Window {
    naver: any;
  }
}

// Supabase의 quake.shelter_facilities 테이블 기준 타입
export type Shelter = {
  facility_serial: number;
  name: string;
  road_addr: string | null;
  region_code: number | null;
  area_sqm: number | null;
  capacity: number | null;
  lon: number;
  lat: number;
};

// 목록 페이지(ShelterSearch)에서 내려줄 검색 컨텍스트
export type SearchMode = 'DEFAULT' | 'REGION' | 'ADDRESS';

interface ShelterDetailProps {
  shelter: Shelter;
  onBack: () => void;

  // 최근에 어떤 검색으로 들어왔는지
  lastSearchQuery: string | null;
  searchMode: SearchMode;

  // 주소(도로명) 검색 시 기준이 되는 좌표 (행정구역/기본 보기에서는 null)
  userPos: { lat: number; lon: number } | null;
}

export default function ShelterDetail({
  shelter,
  onBack,
  lastSearchQuery,
  searchMode,
  userPos,
}: ShelterDetailProps) {
  // 주소 검색(도로명) + userPos 있을 때만 길안내 사용
  const hasDistance =
    searchMode === 'ADDRESS' &&
    userPos &&
    shelter.lat != null &&
    shelter.lon != null;

  // 헤더 아래에 표시할 검색 컨텍스트 텍스트
  const renderSearchContext = () => {
    if (!lastSearchQuery) {
      return (
        <span className="text-xs text-gray-500">
          기본 보기 (파주시 전체 기준)
        </span>
      );
    }

    if (searchMode === 'REGION') {
      return (
        <span className="text-xs text-gray-500">
          최근 검색: "{lastSearchQuery}" (행정구역 기준)
        </span>
      );
    }

    if (searchMode === 'ADDRESS') {
      return (
        <span className="text-xs text-gray-500">
          최근 검색: "{lastSearchQuery}" (검색 위치 기준)
        </span>
      );
    }

    return (
      <span className="text-xs text-gray-500">
        최근 검색: "{lastSearchQuery}"
      </span>
    );
  };

  // 길안내 버튼 활성 여부
  const canUseGuide = hasDistance && !!userPos;

  const handleGuideClick = () => {
    if (!canUseGuide || !userPos) {
      alert('도로명 주소로 검색한 후에 길안내를 사용할 수 있습니다.');
      return;
    }

    const startName =
      lastSearchQuery && lastSearchQuery.trim().length > 0
        ? lastSearchQuery
        : '검색 위치';

    const sLat = userPos.lat;
    const sLon = userPos.lon;
    const eLat = shelter.lat;
    const eLon = shelter.lon;

    // PC 웹 네이버 지도 길찾기용 URL
    const url =
      'https://map.naver.com/index.nhn' +
      `?slng=${encodeURIComponent(String(sLon))}` +
      `&slat=${encodeURIComponent(String(sLat))}` +
      `&stext=${encodeURIComponent(startName)}` +
      `&elng=${encodeURIComponent(String(eLon))}` +
      `&elat=${encodeURIComponent(String(eLat))}` +
      `&etext=${encodeURIComponent(shelter.name)}` +
      '&menu=route' +
      '&pathType=3'; // 1: 자동차 기준

    window.open(url, '_blank');
  };

  const handleOpenNaverMap = () => {
    const keyword = shelter.road_addr || shelter.name;
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(
      keyword,
    )}`;
    window.open(url, '_blank');
  };

  // 오른쪽 지도 영역
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (typeof window === 'undefined') return;
    if (!window.naver) return;
    if (shelter.lat == null || shelter.lon == null) return;

    const { naver } = window;
    const center = new naver.maps.LatLng(shelter.lat, shelter.lon);

    const mapOptions = {
      center,
      zoom: 16,
      zoomControl: true,
      mapTypeControl: false,
    };

    const map = new naver.maps.Map(mapRef.current, mapOptions);

    new naver.maps.Marker({
      position: center,
      map,
      icon: {
        content: `
          <div style="
            width: 32px; height: 32px;
            border-radius: 50%;
            background-color: #ef4444;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            color: white;
          ">
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 22s7-7.364 7-12.25A7 7 0 105 9.75C5 14.636 12 22 12 22z" />
            </svg>
          </div>
        `,
        anchor: new naver.maps.Point(16, 32),
      },
    });

    // cleanup 생략
  }, [shelter.lat, shelter.lon]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* 상단 헤더 */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">목록으로</span>
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Star className="w-6 h-6 text-yellow-500" />
            </button>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {shelter.name}
          </h1>
          <p className="text-sm text-gray-600 mb-1">
            {shelter.road_addr ?? '주소 정보가 없습니다.'}
          </p>
          {renderSearchContext()}
        </div>

        {/* 본문 */}
        <div className="p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 왼쪽 컬럼 */}
            <div className="space-y-6">
              {/* 대표 이미지 카드 (사진 없음) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="relative h-64 flex items-center justify-center">
                  <span className="text-sm text-gray-400">
                    시설 사진이 등록되어 있지 않습니다.
                  </span>
                </div>
              </div>

              {/* 현재 상태 카드 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  현재 상태
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-600 mb-1">예상 혼잡도</div>
                    <div className="text-lg font-bold text-green-600">원활</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-600 mb-1">최대 수용</div>
                    <div className="text-lg font-bold text-blue-600">
                      {shelter.capacity ?? '정보 없음'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-600 mb-1">
                      시설 면적(㎡)
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {shelter.area_sqm ?? '정보 없음'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 기본정보 카드 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  기본정보
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">주소</span>
                    <span className="text-sm font-medium text-gray-900 text-right">
                      {shelter.road_addr ?? '주소 정보 없음'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">법정동 코드</span>
                    <span className="text-sm font-medium text-gray-900">
                      {shelter.region_code ?? '정보 없음'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-600">좌표</span>
                    <span className="text-sm font-medium text-gray-900">
                      {shelter.lat}, {shelter.lon}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽 컬럼: 지도 + 주의사항 + 버튼 */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
                {/* 네이버 지도 */}
                <div className="h-64 relative">
                  <div ref={mapRef} className="w-full h-full" />
                </div>

                <div className="p-6">
                  {/* 지도 바로 아래 주의사항 박스 */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <h3 className="font-semibold text-red-900 text-sm mb-2">
                      대피 시 주의사항
                    </h3>
                    <ul className="space-y-1 text-xs text-red-800">
                      <li>• 머리를 보호하고 안전한 자세를 유지하세요.</li>
                      <li>• 가스와 전기를 차단하고 문을 열어 대피 통로를 확보하세요.</li>
                      <li>• 엘리베이터 대신 계단을 이용하세요.</li>
                      <li>• 가능한 도보로 이동하고, 차량 정체를 피하세요.</li>
                    </ul>
                  </div>

                  {/* 하단 버튼: 길안내 / 네이버지도로 보기 */}
                  <div className="flex space-x-2">
                    <button
                      onClick={handleGuideClick}
                      disabled={!canUseGuide}
                      className="flex-1 px-4 py-3 bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                    >
                      <Navigation className="w-5 h-5" />
                      <span>길안내</span>
                    </button>
                    <button
                      onClick={handleOpenNaverMap}
                      className="flex-1 px-4 py-3 bg-white text-gray-700 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center space-x-2"
                    >
                      <MapIcon className="w-5 h-5" />
                      <span>네이버지도로 보기</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* 오른쪽 끝 */}
          </div>
        </div>
      </div>
    </div>
  );
}
