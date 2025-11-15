// src/lib/loadNaverMap.ts
let naverMapLoader: Promise<void> | null = null;

export function loadNaverMap(): Promise<void> {
  if (naverMapLoader) return naverMapLoader;
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window is undefined'));
  }

  naverMapLoader = new Promise((resolve, reject) => {
    // 이미 로드되어 있으면 즉시 resolve
    if ((window as any).naver && (window as any).naver.maps) {
      resolve();
      return;
    }

    const keyId = import.meta.env.VITE_NAVER_MAP_KEY_ID;
    if (!keyId) {
      reject(new Error('VITE_NAVER_MAP_KEY_ID is not defined'));
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}&submodules=geocoder`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Naver Maps script'));
    };

    document.head.appendChild(script);
  });

  return naverMapLoader;
}
