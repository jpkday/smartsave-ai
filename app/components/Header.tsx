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
    { name: 'Receipts', path: '/receipts', letter: 'R', color: 'bg-orange-500 hover:bg-orange-600', dimColor: 'bg-orange-200', icon: '🧾' }
  ];

  return (
    <nav>
      {/* Mobile View - Colorful Letter Buttons */}
      <div className="flex md:hidden gap-2 justify-center">
        <Link 
          href="/" 
          className="bg-gray-300 text-gray-700 px-3 py-2 rounded-lg font-bold hover:bg-gray-400 transition text-sm w-12 flex items-center justify-center"
        >
          🏠
        </Link>
        {pages.map(page => (
          <Link
            key={page.name}
            href={page.path}
            className={`${currentPage === page.name ? page.color : page.dimColor} text-white px-3 py-2 rounded-lg font-bold transition text-sm w-12 flex items-center justify-center gap-1`}
          >
            <span className="text-xs">{page.icon}</span>
            <span>{page.letter}</span>
          </Link>
        ))}
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