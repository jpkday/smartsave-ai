import Link from 'next/link';

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const pages = [
    { name: 'Prices', path: '/prices', letter: 'P', color: 'bg-blue-600 hover:bg-blue-700', dimColor: 'bg-blue-200', icon: '💰' },
    { name: 'List', path: '/list', letter: 'L', color: 'bg-yellow-500 hover:bg-yellow-600', dimColor: 'bg-yellow-200', icon: '📝' },
    { name: 'Compare', path: '/compare', letter: 'C', color: 'bg-green-500 hover:bg-green-600', dimColor: 'bg-green-200', icon: '⚖️' },
    { name: 'Items', path: '/items', letter: 'I', color: 'bg-purple-500 hover:bg-purple-600', dimColor: 'bg-purple-200', icon: '📋' },
    { name: 'History', path: '/history', letter: 'H', color: 'bg-teal-500 hover:bg-teal-600', dimColor: 'bg-teal-200', icon: '📊' },
    { name: 'Receipts', path: '/receipts', letter: 'R', color: 'bg-orange-500 hover:bg-orange-600', dimColor: 'bg-orange-200', icon: '🧾' },
    { name: 'Stores', path: '/stores', letter: 'S', color: 'bg-pink-500 hover:bg-pink-600', dimColor: 'bg-pink-200', icon: '🛍️' }
  ];

  return (
    <nav>
      {/* Mobile View - Home Button + Page Dropdown */}
      <div className="flex md:hidden items-center gap-3 w-full">
        <Link 
          href="/" 
          className="bg-gray-600 text-white p-3 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center"
        >
          <span className="text-xl">🏠</span>
        </Link>
        <div className="flex-1 relative">
          <div 
            className={`px-4 py-3 rounded-lg font-bold text-white text-lg text-center flex items-center justify-center gap-2 ${
              (() => {
                const page = pages.find(p => p.name === currentPage);
                return page ? page.color.split(' ')[0] : 'bg-gray-600';
              })()
            }`}
          >
            <span>
              {(() => {
                const page = pages.find(p => p.name === currentPage);
                return page ? `${page.icon} ${page.name}` : currentPage;
              })()}
            </span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                const page = pages.find(p => p.name === e.target.value);
                if (page) {
                  window.location.href = page.path;
                }
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          >
            <option value="" disabled hidden></option>
            {pages.filter(page => page.name !== currentPage).map(page => (
              <option key={page.name} value={page.name}>
                {page.icon} {page.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop View - Full Text Links */}
      <div className="hidden md:flex gap-4">
        <Link href="/" className="text-gray-600 hover:text-blue-600 font-semibold">
          Home
        </Link>
        {pages.map(page => (
          <Link
            key={page.name}
            href={page.path}
            className={`font-semibold ${
              currentPage === page.name
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            {page.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}