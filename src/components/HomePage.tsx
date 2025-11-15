import { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Navigation as NavigationIcon,
} from 'lucide-react';
import { supabase, type Earthquake } from '../lib/supabase';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [searchAddress, setSearchAddress] = useState('');
  const [shelterCount, setShelterCount] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [recentEarthquakes, setRecentEarthquakes] = useState<Earthquake[]>([]);
  const [riskScore, setRiskScore] = useState<number | null>(null); // DB risk_score 그대로

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // 1) 대피소 통계 (public.shelter_facilities)
    const { data: shelters } = await supabase
      .from('shelter_facilities')
      .select('capacity');

    if (shelters) {
      setShelterCount(shelters.length);
      setTotalCapacity(
        shelters.reduce(
          (sum: number, s: { capacity: number | null }) => sum + (s.capacity ?? 0),
          0,
        ),
      );
    }

    // 2) 최근 지진 정보
    const { data: earthquakes } = await supabase
      .from('earthquakes')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(5);

    if (earthquakes) {
      setRecentEarthquakes(earthquakes);
    }

    // 3) 파주 위험도 (public.earthquakerisk_paju)
    const { data: riskData, error: riskError } = await supabase
      .from('earthquakerisk_paju')
      .select('risk_score')
      .limit(1)
      .single();

    if (!riskError && riskData && riskData.risk_score != null) {
      setRiskScore(Number(riskData.risk_score));
    }
  };

  // ✅ 홈에서 검색어 입력 후 search 화면으로 넘길 때
  const handleSearch = () => {
    const q = searchAddress.trim();
    if (!q) return;

    window.sessionStorage.setItem('quake_lastSearch', q);
    onNavigate('search');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* 히어로 섹션 */}
      <div
        className="relative h-[400px] bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(/image.png)',
        }}
      >
        <div className="text-center text-white px-4 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            파주시 지진 안전 대피소 시스템
          </h1>
          <p className="text-lg md:text-xl mb-8 text-gray-100">
            파주시에서 가장 가까운 지진 대피소를 빠르고 안전하게 찾으세요. 귀하의 가족을 보호하기 위한
            실시간 안전정보를 제공합니다.
          </p>

          <div className="bg-white rounded-lg p-6 max-w-2xl mx-auto">
            {/* 검색 입력 */}
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="주소 또는 동네 입력"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 outline-none text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                검색
              </button>
            </div>

            {/* 주요 버튼 */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => onNavigate('search')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                파주시 대피소 찾기
              </button>
              <button
                onClick={() => onNavigate('guide')}
                className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                AI에게 물어보기
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              인천 광역시 지진 발생:{' '}
              <span className="text-green-600 font-medium">양호</span> (마지막 업데이트: 2분 전)
            </p>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 주요 기능 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-8">주요 기능</h2>
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div
              className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onNavigate('search')}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">지능형 대피소 추천</h3>
              <p className="text-gray-600 mb-4">
                사용자의 현재 위치를 검색하여 가까운 대피소를 추천합니다.
              </p>
              <button className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                자세히 보기 →
              </button>
            </div>

            <div
              className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onNavigate('guide')}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">맞춤형 AI 가이드</h3>
              <p className="text-gray-600 mb-4">
                AI 챗봇이 지진 발생 상황에 맞춰 대피 요령과 준비사항을 즉시 안내해 줍니다.
              </p>
              <button className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                자세히 보기 →
              </button>
            </div>

            <div
              className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onNavigate('simulation')}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <NavigationIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">대피 시뮬레이션</h3>
              <p className="text-gray-600 mb-4">
                우리 집에서 대피 연습하기. 주소와 상황을 입력하면 AI가 최적의 대피 경로와 준비사항을 안내합니다.
              </p>
              <button className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                자세히 보기 →
              </button>
            </div>
          </div>
        </div>

        {/* 현황판 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-8">현황판</h2>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">등록된 대피소</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {shelterCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">파주 관내 전체 개소</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">총 수용 인원</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {totalCapacity.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">명</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">위험도</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {riskScore !== null ? riskScore.toFixed(3) : '-'}
            </div>
          </div>
        </div>

        {/* 최근 지진 정보 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-8">최근 지진 정보</h2>

        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
          {recentEarthquakes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">
                최근 24시간 이내 파주 반경 100km 내에서 감지된 지진이 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentEarthquakes.map((eq) => (
                <div
                  key={eq.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <div className="text-sm text-gray-600 mb-1">발생 위치 및 시간</div>
                    <div className="font-medium text-gray-900">
                      {new Date(eq.occurred_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">위치</div>
                    <div className="font-medium text-gray-900">{eq.location}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 mb-1">규모</div>
                    <div
                      className={`text-2xl font-bold ${
                        eq.magnitude >= 3.0 ? 'text-red-600' : 'text-yellow-600'
                      }`}
                    >
                      {eq.magnitude}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => onNavigate('risk')}
                  className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
                >
                  전체 기록 보기 →
                </button>
                <button className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  지진 위험도 지도 보기 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">파주시청</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>비상연락처</p>
                <p>전화: 031-123-4567</p>
                <p>이메일: safety@paju.go.kr</p>
                <p>경기도 파주시 시청로 50</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-4">바로가기</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p
                  className="cursor-pointer hover:text-gray-900"
                  onClick={() => onNavigate('search')}
                >
                  대피소 찾기
                </p>
                <p
                  className="cursor-pointer hover:text-gray-900"
                  onClick={() => onNavigate('risk')}
                >
                  위험도 지도
                </p>
                <p
                  className="cursor-pointer hover:text-gray-900"
                  onClick={() => onNavigate('guide')}
                >
                  대피 가이드
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-4">법적 고지</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>개인정보처리방침</p>
                <p>이용약관</p>
                <p>오픈소스 라이선스</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
            © 2024 Paju City. 모든 권리 보유.
          </div>
        </div>
      </footer>
    </div>
  );
}
