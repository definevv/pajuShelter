import { useState, useEffect } from 'react';
import { Search, MapPin, Home, ChevronRight } from 'lucide-react';
import { supabase, type Shelter } from '../lib/supabase';
import ShelterDetail from './ShelterDetail';
import NaverMap from './NaverMap';
import { geocodeWithNaver } from '../lib/naverGeocode';

interface ShelterSearchProps {
  onNavigate: (page: string) => void;
}

// 파주시 중심점(대략) – 기본 거리 계산용 기준 좌표
const USER_LAT = 37.7599;
const USER_LON = 126.78;

// 파주시 대략 경계(위도/경도 박스)
const PAJU_LAT_MIN = 37.6;
const PAJU_LAT_MAX = 37.95;
const PAJU_LON_MIN = 126.6;
const PAJU_LON_MAX = 127.1;

// 검색 위치 기준으로 보여줄 최대 대피소 개수
const NEARBY_LIMIT = 10;

// 검색 모드
type SearchMode = 'DEFAULT' | 'REGION' | 'ADDRESS';

// 하버사인 공식으로 두 점 사이 거리(km) 계산
function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// DB에서 직접 읽어오는 기본 컬럼 타입
type ShelterRow = {
  facility_serial: number;
  name: string;
  road_addr: string | null;
  region_code: number | null;
  area_sqm: number | null;
  capacity: number | null;
  lon: number;
  lat: number;
};

// 행정구역 스타일(금촌동, 파주시 등)인지 판별
function isAdministrativeQuery(q: string): boolean {
  const trimmed = q.trim();
  if (!trimmed) return false;

  // 숫자가 들어가면(도로명 주소일 확률이 큼) 행정구역으로 보지 않음
  if (/\d/.test(trimmed)) return false;

  // 동/읍/면/리/시/군/구 로 끝나면 행정구역으로 간주
  const suffixes = ['동', '읍', '면', '리', '시', '군', '구'];
  return suffixes.some((s) => trimmed.endsWith(s));
}

// 좌표가 파주시 범위 안인지 확인
function isInPaju(lat: number, lon: number): boolean {
  return (
    lat >= PAJU_LAT_MIN &&
    lat <= PAJU_LAT_MAX &&
    lon >= PAJU_LON_MIN &&
    lon <= PAJU_LON_MAX
  );
}

type SimplePoint = { lat: number; lon: number };

// 지오코딩 시 "파주가 아니면 파주시 붙여서 다시 검색" 로직
async function geocodeWithPajuFallback(
  rawQuery: string,
): Promise<{ point: SimplePoint; usedQuery: string } | null> {
  const cleanQuery = rawQuery.trim();
  if (!cleanQuery) return null;

  // 1차: 사용자가 입력한 그대로
  try {
    const first = await geocodeWithNaver(cleanQuery);
    if (first && isInPaju(first.lat, first.lon)) {
      return { point: first, usedQuery: cleanQuery };
    }
  } catch (e) {
    console.error('[geocodeWithPajuFallback] first geocode error', e);
  }

  // 이미 "파주"가 들어가 있으면 더 붙이지 않고 종료
  if (cleanQuery.includes('파주')) {
    return null;
  }

  // 2차: "파주시 "를 붙여서 재검색
  const prefixed = `파주시 ${cleanQuery}`;
  try {
    const second = await geocodeWithNaver(prefixed);
    if (second && isInPaju(second.lat, second.lon)) {
      return { point: second, usedQuery: prefixed };
    }
  } catch (e) {
    console.error('[geocodeWithPajuFallback] second geocode error', e);
  }

  // 둘 다 파주시가 아니면 실패 처리
  return null;
}

export default function ShelterSearch({ onNavigate }: ShelterSearchProps) {
  const [searchAddress, setSearchAddress] = useState(''); // 입력창 값
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [filteredShelters, setFilteredShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null); // 검색 기준 좌표
  const [resultLabel, setResultLabel] = useState<string>('파주시 전체 기준, 가까운 순');
  const [searchMode, setSearchMode] = useState<SearchMode>('DEFAULT');
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);

  // ✅ 홈에서 넘어온 초기 검색어
  const [initialQuery, setInitialQuery] = useState<string | null>(null);

  // 마운트 시 sessionStorage에서 검색어 읽기
  useEffect(() => {
    const stored = window.sessionStorage.getItem('quake_lastSearch');
    if (stored && stored.trim().length > 0) {
      setInitialQuery(stored);
      setSearchAddress(stored);
      window.sessionStorage.removeItem('quake_lastSearch');
    }
  }, []);

  // DB에서 대피소 가져오기
  useEffect(() => {
    const loadShelters = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from<ShelterRow>('shelter_facilities')
        .select('facility_serial,name,road_addr,region_code,area_sqm,capacity,lon,lat')
        .order('name');

      if (error) {
        console.error('Error loading shelters:', error);
        setShelters([]);
        setFilteredShelters([]);
        setLoading(false);
        return;
      }

      const mapped: Shelter[] = (data ?? []).map((row) => ({
        ...row,
        address: row.road_addr ?? '',
        is_24h_open: true,
        facilities: {
          medical: true,
          restroom: true,
          supplies: true,
          wifi: false,
          generator: false,
          emergency_power: true,
          pets_allowed: false,
        },
      }));

      // 기본: 파주시 중심 기준 전체 거리순 정렬
      const sorted = [...mapped].sort((a, b) => {
        const da =
          a.lat && a.lon
            ? calcDistanceKm(USER_LAT, USER_LON, a.lat, a.lon)
            : Number.MAX_VALUE;
        const db =
          b.lat && b.lon
            ? calcDistanceKm(USER_LAT, USER_LON, b.lat, b.lon)
            : Number.MAX_VALUE;
        return da - db;
      });

      setShelters(mapped);
      setFilteredShelters(sorted);
      setSearchMode('DEFAULT');
      setLastSearchQuery(null);
      setLoading(false);
    };

    loadShelters();
  }, []);

  // shelters 로딩 후 initialQuery 있으면 자동 검색
  useEffect(() => {
    if (!initialQuery) return;
    if (loading) return;
    if (shelters.length === 0) return;

    (async () => {
      await handleSearchClick(initialQuery);
      setInitialQuery(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, loading, shelters]);

  // 검색 버튼/엔터 눌렀을 때
  // ✅ forcedQuery 인자로 홈에서 넘겨준 검색어 사용 가능
  const handleSearchClick = async (forcedQuery?: string) => {
    const q = (forcedQuery ?? searchAddress).trim();

    // 검색어가 없으면 기본 파주시 중심 기준으로 리셋
    if (!q) {
      setUserPos(null);
      setSearchMode('DEFAULT');
      setLastSearchQuery(null);
      setResultLabel('파주시 전체 기준, 가까운 순');

      const resetSorted = [...shelters].sort((a, b) => {
        const da =
          a.lat && a.lon
            ? calcDistanceKm(USER_LAT, USER_LON, a.lat, a.lon)
            : Number.MAX_VALUE;
        const db =
          b.lat && b.lon
            ? calcDistanceKm(USER_LAT, USER_LON, b.lat, b.lon)
            : Number.MAX_VALUE;
        return da - db;
      });

      setFilteredShelters(resetSorted);
      return;
    }

    // 1) 행정구역 검색(금촌동, 파주시 등)
    if (isAdministrativeQuery(q)) {
      setUserPos(null);
      setSearchMode('REGION');
      setLastSearchQuery(q);

      const zoneFiltered = shelters.filter((s) => (s.road_addr ?? '').includes(q));

      setFilteredShelters(zoneFiltered);
      setResultLabel(`행정구역 "${q}" 대피소 목록`);
      return;
    }

    // 2) 도로명/건물 주소 검색 + 파주시 fallback
    try {
      const fallbackResult = await geocodeWithPajuFallback(q);

      if (fallbackResult) {
        const { point, usedQuery } = fallbackResult;

        // 검색 위치 좌표 저장
        setUserPos({ lat: point.lat, lon: point.lon });
        setSearchMode('ADDRESS');
        setLastSearchQuery(usedQuery);

        // 거리 계산
        const withDistance = shelters.map((s) => {
          const distance =
            s.lat && s.lon ? calcDistanceKm(point.lat, point.lon, s.lat, s.lon) : null;
          return { shelter: s, distance };
        });

        // 거리순 정렬 후 상위 N개만 사용
        const sortedByDistance = withDistance
          .sort((a, b) => {
            const da = a.distance ?? Number.MAX_VALUE;
            const db = b.distance ?? Number.MAX_VALUE;
            return da - db;
          })
          .map((item) => item.shelter);

        const limited =
          sortedByDistance.length > NEARBY_LIMIT
            ? sortedByDistance.slice(0, NEARBY_LIMIT)
            : sortedByDistance;

        setFilteredShelters(limited);

        const baseLabel =
          usedQuery === q ? '검색 위치 기준' : `검색 위치 기준 (${usedQuery})`;

        setResultLabel(`${baseLabel}, 가까운 대피소 ${limited.length}곳`);
        return;
      }
    } catch (err) {
      console.error('Error in geocoding with Paju fallback:', err);
    }

    // 3) 파주시 내 좌표를 못 찾은 경우
    setUserPos(null);
    setSearchMode('REGION'); // 거리 정보 숨기기 위해 REGION으로
    setLastSearchQuery(q);
    setFilteredShelters([]);
    setResultLabel('검색 결과가 없습니다. 도로명 주소를 다시 확인해 주세요.');
  };

  const getDistanceForShelter = (s: Shelter): number | null => {
    if (s.lat == null || s.lon == null) return null;
    const baseLat = userPos?.lat ?? USER_LAT;
    const baseLon = userPos?.lon ?? USER_LON;
    return calcDistanceKm(baseLat, baseLon, s.lat, s.lon);
  };

  const getWalkTime = (d: number) => Math.ceil(d * 12); // km -> 분 (대략)

  // ✅ 주소 검색(ADDRESS)일 때만 거리/시간 보여주기
  const showDistanceInfo = searchMode === 'ADDRESS';

  // 상세 모드일 때는 바로 상세 컴포넌트 렌더
  if (viewMode === 'detail' && selectedShelter) {
    return (
      <ShelterDetail
        shelter={selectedShelter}
        onBack={() => {
          setViewMode('list');
          setSelectedShelter(null);
        }}
        lastSearchQuery={lastSearchQuery}
        searchMode={searchMode}
        // 주소 검색(ADDRESS)일 때만 기준 좌표 전달, 나머지는 null
        userPos={searchMode === 'ADDRESS' ? userPos : null}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 왼쪽 사이드바 - 홈 버튼 */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-6">
        <button
          onClick={() => onNavigate('home')}
          className="p-3 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex">
        {/* 리스트 패널 */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-3">대피소 검색/추천</h2>
            <p className="text-sm text-gray-600 mb-4">
              파주시 내 지진 대피소를 검색하고, 거리·행정구역 기준으로 조회합니다.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  동/읍/면/시 또는 도로명 주소 검색
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="예: 금촌동, 파주시, 시청로 50"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                  </div>
                  <button
                    onClick={() => handleSearchClick()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    검색
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 결과 헤더 */}
          <div className="flex flex-col px-6 py-3 border-b border-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">
                검색 결과 {filteredShelters.length}곳
              </h3>
            </div>
            <p className="text-xs text-gray-500 truncate">{resultLabel}</p>
          </div>

          {/* 결과 리스트 */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-gray-500">대피소 정보를 불러오는 중입니다...</div>
            )}

            {!loading &&
              filteredShelters.map((shelter) => {
                const distance = showDistanceInfo ? getDistanceForShelter(shelter) : null;
                const distanceText =
                  distance != null ? `${distance.toFixed(1)}km` : '거리 정보 없음';

                return (
                  <div
                    key={shelter.facility_serial}
                    onClick={() => setSelectedShelter(shelter)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedShelter?.facility_serial === shelter.facility_serial
                        ? 'bg-blue-50'
                        : ''
                    }`}
                  >
                    <h4 className="font-semibold text-sm text-gray-900 mb-1">
                      {shelter.name}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      {shelter.road_addr ?? '주소 정보 없음'}
                    </p>

                    {showDistanceInfo && (
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{distanceText}</span>
                        </span>
                        <span className="text-[11px] text-gray-400">직선거리 기준</span>
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShelter(shelter);
                        setViewMode('detail');
                      }}
                      className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-1"
                    >
                      <span>상세보기</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 오른쪽 네이버 지도 + 선택된 대피소 요약 카드 */}
        <div className="flex-1 relative">
          <NaverMap
            shelters={filteredShelters}
            userPos={userPos}
            selectedShelter={selectedShelter}
            onSelectShelter={(shelter) => {
              setSelectedShelter(shelter);
              setViewMode('detail');
            }}
          />

          {selectedShelter && showDistanceInfo && (
            <div className="absolute bottom-6 left-6 right-6 bg-white rounded-xl shadow-xl p-4 max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {selectedShelter.name}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {selectedShelter.road_addr ?? '주소 정보 없음'}
              </p>

              {(() => {
                const d = getDistanceForShelter(selectedShelter);
                if (d == null) return null;
                const walk = getWalkTime(d);
                const drive = Math.ceil(d * 3);

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-600 mb-1">현재 거리</div>
                        <div className="text-xl font-bold text-gray-900">
                          {d.toFixed(1)}km
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-600 mb-1">차량 거리</div>
                        <div className="text-xl font-bold text-gray-900">
                          {(d + 0.3).toFixed(1)}km
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify_between p-2 bg-blue-50 rounded-lg">
                        <span className="text-xs text-gray-700">도보 경로</span>
                        <span className="font-semibold text-sm text-blue-600">
                          약 {walk}분
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-700">차량 경로</span>
                        <span className="font-semibold text-sm text-gray-900">
                          약 {drive}분
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
