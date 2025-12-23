import Link from 'next/link';

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const pages = [
    { name: 'Prices', path: '/prices', letter: 'P', color: 'bg-blue-600 hover:bg-blue-700', icon: '💰' },
    { name: 'Compare', path: '/compare', letter: 'C', color: 'bg-green-500 hover:bg-green-600', icon: '⚖️' },
    { name: 'Items', path: '/items', letter: 'I', color: 'bg-purple-500 hover:bg-purple-600', icon: '📝' },
    { name: 'Receipts', path: '/receipts', letter: 'R', color: 'bg-orange-500 hover:bg-orange-600', icon: '🧾' }
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
        {pages.filter(page => page.name !== currentPage).map(page => (
          <Link
            key={page.name}
            href={page.path}
            className={`${page.color} text-white px-3 py-2 rounded-lg font-bold transition text-sm w-12 flex items-center justify-center gap-1`}
          >
            <span className="text-xs">{page.icon}</span>
            <span>{page.letter}</span>
          </Link>
        ))}
      </div>

      {/* Desktop View - Full Text Links */}
      <div className="hidden md:flex gap-4">
        <Link href="/" className="text-blue-600 hover:text-blue-800 font-semibold">
          Home
        </Link>
        {pages.map(page => (
          <Link
            key={page.name}
            href={page.path}
            className={`font-semibold ${
              currentPage === page.name
                ? 'text-blue-600 underline'
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