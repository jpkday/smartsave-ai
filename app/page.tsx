import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center p-6">
      <div className="text-center text-white max-w-xs md:max-w-4xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6">SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-6 md:mb-10 px-2">Stop overpaying for groceries. Compare prices across your local stores.</p>
        <div className="flex flex-col md:flex-row gap-3 md:gap-6 md:justify-center">
          <Link href="/prices" className="bg-blue-600 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-blue-700 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">💰</span>
            <span className="flex-1 ml-6 md:ml-8">Prices</span>
          </Link>
          <Link href="/list" className="bg-yellow-500 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-yellow-600 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">📝</span>
            <span className="flex-1 ml-6 md:ml-8">Shopping List</span>
          </Link>
          <Link href="/compare" className="bg-green-500 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-green-600 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">⚖️</span>
            <span className="flex-1 ml-6 md:ml-8">Compare</span>
          </Link>
          <Link href="/items" className="bg-purple-500 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-purple-600 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">📋</span>
            <span className="flex-1 ml-6 md:ml-8">Items</span>
          </Link>
          <Link href="/history" className="bg-teal-500 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-teal-600 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">📊</span>
            <span className="flex-1 ml-6 md:ml-8">History</span>
          </Link>
          <Link href="/receipts" className="bg-orange-500 text-white px-10 py-3 md:px-14 md:py-5 rounded-lg text-base md:text-xl font-semibold hover:bg-orange-600 transition cursor-pointer text-center w-full md:w-56 relative flex items-center">
            <span className="absolute left-4 md:left-5 text-xl md:text-2xl">🧾</span>
            <span className="flex-1 ml-6 md:ml-8">Receipts</span>
          </Link>
        </div>
      </div>
    </div>
  );
}