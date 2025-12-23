import Link from 'next/link';

export default function Header({ currentPage }: { currentPage: string }) {
  const pages = [
    { name: 'Home', path: '/' },
    { name: 'Items', path: '/items' },
    { name: 'Prices', path: '/prices' },
    { name: 'Receipts', path: '/receipts' },
    { name: 'Compare', path: '/compare' },
  ];

  return (
    <div className="flex gap-4 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide pb-2">
      {pages.map(page => (
        page.name === currentPage ? (
          <span
            key={page.path}
            className="text-gray-500 font-medium text-sm flex-shrink-0"
          >
            {page.name}
          </span>
        ) : (
          <Link
            key={page.path}
            href={page.path}
            className="text-blue-600 hover:underline font-medium text-sm flex-shrink-0"
          >
            {page.name}
          </Link>
        )
      ))}
    </div>
  );
}