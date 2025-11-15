interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <img src="/src/assets/logo.jpg" alt="파주시 로고" className="h-8" />
          </div>

          <nav className="flex items-center space-x-8">
            <button
              onClick={() => onNavigate('home')}
              className={`text-sm font-medium transition-colors ${
                currentPage === 'home' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              홈
            </button>
            <button
              onClick={() => onNavigate('search')}
              className={`text-sm font-medium transition-colors ${
                currentPage === 'search' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              대피소 찾기
            </button>
            <button
              onClick={() => onNavigate('guide')}
              className={`text-sm font-medium transition-colors ${
                currentPage === 'guide' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              대피 가이드
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
