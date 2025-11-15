import { useState } from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  AlertTriangle,
  Home,
  Building,
  Users,
  Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { geocodeWithNaver } from '../lib/naverGeocode';

type HousingType = 'apartment' | 'house' | null;
type FamilySize = 'alone' | 'couple' | 'family' | null;
type Magnitude = '3-4' | '4-5' | '5+' | null;

type NearestShelter = {
  name: string;
  address: string;
  capacity: number | null;
};

type ShelterRow = {
  facility_serial: number;
  name: string;
  road_addr: string | null;
  capacity: number | null;
  lat: number | null;
  lon: number | null;
};

// ----------------- 공통 유틸 -----------------
const PAJU_LAT_MIN = 37.6;
const PAJU_LAT_MAX = 37.95;
const PAJU_LON_MIN = 126.6;
const PAJU_LON_MAX = 127.1;

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

function isInPaju(lat: number, lon: number): boolean {
  return (
    lat >= PAJU_LAT_MIN &&
    lat <= PAJU_LAT_MAX &&
    lon >= PAJU_LON_MIN &&
    lon <= PAJU_LON_MAX
  );
}

type SimplePoint = { lat: number; lon: number };

async function geocodeWithPajuFallback(rawQuery: string): Promise<SimplePoint | null> {
  const clean = rawQuery.trim();
  if (!clean) return null;

  try {
    const first = await geocodeWithNaver(clean);
    if (first && isInPaju(first.lat, first.lon)) {
      return first;
    }
  } catch (e) {
    console.error('[EvacSimulation] 1차 지오코딩 오류', e);
  }

  if (!clean.includes('파주')) {
    try {
      const second = await geocodeWithNaver(`파주시 ${clean}`);
      if (second && isInPaju(second.lat, second.lon)) {
        return second;
      }
    } catch (e) {
      console.error('[EvacSimulation] 2차 지오코딩 오류', e);
    }
  }

  return null;
}

async function findNearestShelter(address: string): Promise<NearestShelter | null> {
  const geo = await geocodeWithPajuFallback(address);

  const { data, error } = await supabase
    .from<ShelterRow>('shelter_facilities')
    .select('facility_serial,name,road_addr,capacity,lat,lon');

  if (error) {
    console.error('[EvacSimulation] shelter_facilities 조회 오류', error);
    return null;
  }
  if (!data || data.length === 0) return null;

  // 지오코딩 실패 시: 첫 번째 대피소 사용
  if (!geo) {
    const s = data[0];
    return {
      name: s.name,
      address: s.road_addr ?? '',
      capacity: s.capacity ?? null,
    };
  }

  let best = data[0];
  let bestDist = Number.MAX_VALUE;

  for (const row of data) {
    if (row.lat == null || row.lon == null) continue;
    const d = calcDistanceKm(geo.lat, geo.lon, row.lat, row.lon);
    if (d < bestDist) {
      bestDist = d;
      best = row;
    }
  }

  return {
    name: best.name,
    address: best.road_addr ?? '',
    capacity: best.capacity ?? null,
  };
}

// ----------------- 컴포넌트 -----------------
export default function EvacuationSimulation() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState('');
  const [housingType, setHousingType] = useState<HousingType>(null);
  const [familySize, setFamilySize] = useState<FamilySize>(null);
  const [magnitude, setMagnitude] = useState<Magnitude>(null);
  const [showResults, setShowResults] = useState(false);
  const [targetShelter, setTargetShelter] = useState<NearestShelter | null>(null);
  const [loadingShelter, setLoadingShelter] = useState(false);

  const handleStartSimulation = async () => {
    if (!(address && housingType && familySize && magnitude)) return;

    setLoadingShelter(true);
    const shelter = await findNearestShelter(address);
    setTargetShelter(shelter);
    setLoadingShelter(false);
    setShowResults(true);
  };

  const getScenarioInfo = () => {
    if (!magnitude) return null;

    const scenarios = {
      '3-4': {
        title: '규모 3.0-4.0: 실내 대피',
        description: '약한 흔들림이 느껴지지만 구조물 피해는 적습니다.',
        actions: [
          '튼튼한 탁자나 책상 아래로 대피',
          '머리와 목을 보호',
          '창문과 유리에서 멀리 떨어지기',
          '가스와 전기 차단',
          '문을 열어 탈출로 확보',
        ],
        color: 'yellow',
      },
      '4-5': {
        title: '규모 4.0-5.0: 옥외 대피소 이동',
        description: '강한 흔들림으로 건물 내부에 균열이 발생할 수 있습니다.',
        actions: [
          '즉시 건물 밖으로 대피',
          '엘리베이터 사용 금지 (계단 이용)',
          '낙하물 주의하며 이동',
          '넓은 공터나 지정 대피소로 이동',
          '비상 물품 가방 휴대',
          '가족과 연락처 공유',
        ],
        color: 'orange',
      },
      '5+': {
        title: '규모 5.0 이상: 긴급 대피',
        description: '건물 붕괴 위험이 높습니다. 즉시 대피해야 합니다.',
        actions: [
          '즉시 건물에서 탈출',
          '지정된 긴급 대피소로 이동',
          '가족 비상 연락망 가동',
          '구호물품 지원 장소 확인',
          '여진에 대비하여 장기 체류 준비',
          '정부 재난 문자 확인',
        ],
        color: 'red',
      },
    };

    return scenarios[magnitude];
  };

  const getEvacuationRoute = (shelterName: string) => {
    const finalName = shelterName || '가장 가까운 대피소';

    const routes = [
      {
        step: 1,
        action: '현재 위치에서 출발',
        detail: `${address}에서 가장 가까운 대피소로 이동을 시작합니다.`,
        time: '0분',
      },
      {
        step: 2,
        action: '집에서 나오기',
        detail:
          housingType === 'apartment'
            ? '엘리베이터 사용하지 않고 계단으로 이동'
            : '대문을 통해 안전하게 나가기',
        time: '2-3분',
      },
      {
        step: 3,
        action: '주요 도로로 이동',
        detail: '건물과 전봇대에서 멀리 떨어져 중앙으로 이동',
        time: '5-7분',
      },
      {
        step: 4,
        action: `${finalName} 도착`,
        detail: '대피소 입구에서 등록 후 지정된 장소로 이동',
        time: '15분',
      },
    ];

    return routes;
  };

  const getPreparationItems = () => {
    const items = {
      essential: [
        { name: '신분증/여권', icon: '📇' },
        { name: '현금 (소액권)', icon: '💰' },
        { name: '휴대폰 충전기', icon: '🔌' },
        { name: '상비약', icon: '💊' },
      ],
      food: [
        { name: '생수 (3일분)', icon: '💧' },
        { name: '비상식량', icon: '🍞' },
        { name: '영양바/초콜릿', icon: '🍫' },
      ],
      emergency: [
        { name: '손전등', icon: '🔦' },
        { name: '구급함', icon: '🏥' },
        { name: '라디오', icon: '📻' },
        { name: '담요', icon: '🛏️' },
      ],
    };

    return items;
  };

  if (showResults) {
    const scenario = getScenarioInfo();
    const routes = getEvacuationRoute(targetShelter?.name ?? '');
    const items = getPreparationItems();

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <button
              onClick={() => {
                setShowResults(false);
                setStep(1);
                setAddress('');
                setHousingType(null);
                setFamilySize(null);
                setMagnitude(null);
                setTargetShelter(null);
              }}
              className="text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              ← 새로운 시뮬레이션
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">대피 시뮬레이션 결과</h1>
            <p className="text-gray-600">
              입력하신 정보를 바탕으로 최적의 대피 계획을 생성했습니다.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {scenario && (
                <div
                  className={`bg-gradient-to-br from-${scenario.color}-50 to-${scenario.color}-100 border-2 border-${scenario.color}-300 rounded-xl p-6`}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={`w-12 h-12 bg-${scenario.color}-600 rounded-full flex items-center justify-center flex-shrink-0`}
                    >
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {scenario.title}
                      </h2>
                      <p className="text-gray-700 mb-4">{scenario.description}</p>
                      <div className="space-y-2">
                        <h3 className="font-bold text-gray-900">행동 요령:</h3>
                        <ul className="space-y-1">
                          {scenario.actions.map((action, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-gray-700">•</span>
                              <span className="text-gray-700">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Navigation className="w-6 h-6 text-blue-600" />
                  <span>대피 경로</span>
                </h2>

                <div className="space-y-4">
                  {routes.map((route, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {route.step}
                        </div>
                        {index < routes.length - 1 && (
                          <div className="w-0.5 h-16 bg-blue-200 my-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-gray-900">{route.action}</h3>
                          <span className="text-sm text-gray-600 flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{route.time}</span>
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">{route.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">예상 소요시간</div>
                      <div className="text-2xl font-bold text-blue-600">약 15분</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">이동 거리</div>
                      <div className="text-2xl font-bold text-gray-900">1.2km</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 대피소 상세 정보 - 수용 인원만 DB 연동 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <MapPin className="w-6 h-6 text-blue-600" />
                  <span>대피소 상세 정보</span>
                </h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {targetShelter?.name ?? '가까운 대피소'}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {targetShelter?.address || '주소 정보 없음'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">수용 인원</div>
                      <div className="text-xl font-bold text-gray-900">
                        {targetShelter?.capacity != null
                          ? `${targetShelter.capacity.toLocaleString()}명`
                          : '정보 없음'}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">현재 예상 혼잡도</div>
                      <div className="text-xl font-bold text-green-600">여유</div>
                    </div>
                  </div>

                  {/* ✅ 시설 정보 블록 삭제됨 */}

                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span>대피 시 주의사항</span>
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• 마스크를 꼭 착용하고 입소하세요</li>
                      <li>• 가스와 전기를 반드시 차단하고 나오세요</li>
                      <li>• 엘리베이터 대신 계단을 이용하세요</li>
                      <li>• 차량 이용 시 키는 꽂아두고 대피하세요</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽 사이드 패널 그대로 */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span>챙겨야 할 물품</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">필수 품목</h4>
                    <div className="space-y-2">
                      {items.essential.map((item, index) => (
                        <label
                          key={index}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {item.icon} {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">식량/물</h4>
                    <div className="space-y-2">
                      {items.food.map((item, index) => (
                        <label
                          key={index}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {item.icon} {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">비상 용품</h4>
                    <div className="space-y-2">
                      {items.emergency.map((item, index) => (
                        <label
                          key={index}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {item.icon} {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
                <h3 className="font-bold text-gray-900 mb-2">가족 대피 계획</h3>
                <p className="text-sm text-gray-700 mb-4">
                  {familySize === 'alone' && '혼자 대피하는 경우 주변에 알리고 이동하세요.'}
                  {familySize === 'couple' &&
                    '2인 가구는 서로 위치를 확인하며 함께 이동하세요.'}
                  {familySize === 'family' &&
                    '가족 모두의 안전을 확인하고 함께 대피하세요.'}
                </p>
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  대피 계획 저장하기
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">긴급 연락처</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">소방서 (119)</span>
                    <button className="text-blue-600 text-sm font-medium">전화걸기</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">경찰서 (112)</span>
                    <button className="text-blue-600 text-sm font-medium">전화걸기</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">파주시청</span>
                    <button className="text-blue-600 text-sm font-medium">전화걸기</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loadingShelter && (
            <div className="mt-4 text-sm text-gray-500">
              대피소 정보를 불러오는 중입니다...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------- 입력 단계 화면 -----------------
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">대피 시뮬레이션</h1>
          <p className="text-gray-600">
            우리 집에서 대피 연습하기 - 주소와 상황을 입력하면 AI가 최적의 대피 경로를 생성합니다.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* 스텝 인디케이터 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-24 h-1 mx-2 ${
                        step > s ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    ></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 각 스텝 UI (기존과 동일) */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">주소 입력</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예: 경기도 파주시 금촌동"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-sm text-gray-600 mt-2">
                  현재 위치를 기준으로 가장 가까운 대피소까지의 경로를 계산합니다.
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!address}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                다음 단계
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">거주 환경</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setHousingType('apartment')}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      housingType === 'apartment'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Building className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <div className="font-medium text-gray-900">아파트</div>
                  </button>
                  <button
                    onClick={() => setHousingType('house')}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      housingType === 'house'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Home className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <div className="font-medium text-gray-900">단독주택</div>
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  이전
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!housingType}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  다음 단계
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">가족 구성</label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setFamilySize('alone')}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      familySize === 'alone'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <div className="font-medium text-gray-900 text-sm">1인</div>
                  </button>
                  <button
                    onClick={() => setFamilySize('couple')}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      familySize === 'couple'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <div className="font-medium text-gray-900 text-sm">2인</div>
                  </button>
                  <button
                    onClick={() => setFamilySize('family')}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      familySize === 'family'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <div className="font-medium text-gray-900 text-sm">3인 이상</div>
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  이전
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!familySize}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  다음 단계
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  지진 규모 시나리오 선택
                </label>
                <div className="space-y-3">
                  <button
                    onClick={() => setMagnitude('3-4')}
                    className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                      magnitude === '3-4'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-gray-900 mb-1">규모 3.0-4.0</div>
                    <div className="text-sm text-gray-600">실내 대피 (약한 흔들림)</div>
                  </button>
                  <button
                    onClick={() => setMagnitude('4-5')}
                    className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                      magnitude === '4-5'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-gray-900 mb-1">규모 4.0-5.0</div>
                    <div className="text-sm text-gray-600">옥외 대피소 이동 (강한 흔들림)</div>
                  </button>
                  <button
                    onClick={() => setMagnitude('5+')}
                    className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                      magnitude === '5+'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-gray-900 mb-1">규모 5.0 이상</div>
                    <div className="text-sm text-gray-600">긴급 대피 (건물 붕괴 위험)</div>
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  이전
                </button>
                <button
                  onClick={handleStartSimulation}
                  disabled={!magnitude || loadingShelter}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loadingShelter ? '계획 생성 중...' : '시뮬레이션 시작'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
