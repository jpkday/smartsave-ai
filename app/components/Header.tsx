import Link from 'next/link';

export default function Header({ currentPage }: { currentPage: string }) {
  const pages = [
    { name: 'Prices', path: '/prices' },
    { name: 'Compare', path: '/compare' },
    { name: 'Items', path: '/items' },
    { name: 'Receipts', path: '/receipts' },
    { name: 'Home', path: '/' },
  ];

  return (
    <div className="flex justify-end gap-4 mb-6">
      {pages.map(page => (
        page.name === currentPage ? (
          <span
            key={page.path}
            className="text-gray-500 font-medium"
          >
            {page.name}
          </span>
        ) : (
          <Link
            key={page.path}
            href={page.path}
            className="text-blue-600 hover:underline font-medium"
          >
            {page.name}
          </Link>
        )
      ))}
    </div>
  );
}