import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center p-6">
      <div className="text-center text-white max-w-xs md:max-w-2xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6">SmartSaveAI</h1>
        <p className="text-base md:text-xl mb-6 md:mb-10 px-2">Stop overpaying for groceries. Compare prices across your local stores.</p>
        
        {/* Mobile: 1 column, Desktop: 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Column 1 */}
          <Link href="/list" className="bg-yellow-500 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-yellow-600 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">📝</span>
            <span className="flex-1 ml-6 md:ml-6">Shopping List</span>
          </Link>
          
          {/* Column 2 */}
          <Link href="/history" className="bg-amber-700 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-amber-800 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">📊</span>
            <span className="flex-1 ml-6 md:ml-6">History</span>
          </Link>
          
          {/* Column 1 */}
          <Link href="/compare" className="bg-green-500 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-green-600 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">⚖️</span>
            <span className="flex-1 ml-6 md:ml-6">Compare</span>
          </Link>
          
          {/* Column 2 */}
          <Link href="/receipts" className="bg-orange-500 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-orange-600 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">🧾</span>
            <span className="flex-1 ml-6 md:ml-6">Receipts</span>
          </Link>
          
          {/* Column 1 */}
          <Link href="/prices" className="bg-blue-600 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">💰</span>
            <span className="flex-1 ml-6 md:ml-6">Prices</span>
          </Link>
          
          {/* Column 2 */}
          <Link href="/stores" className="bg-pink-500 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-pink-600 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">🛍️</span>
            <span className="flex-1 ml-6 md:ml-6">Stores</span>
          </Link>
          
          {/* Column 1 */}
          <Link href="/items" className="bg-purple-500 text-white px-10 py-3 md:px-8 md:py-4 rounded-lg text-base md:text-lg font-semibold hover:bg-purple-600 transition cursor-pointer text-center relative flex items-center">
            <span className="absolute left-4 md:left-4 text-xl md:text-2xl">📋</span>
            <span className="flex-1 ml-6 md:ml-6">Items</span>
          </Link>
        </div>
      </div>
    </div>
  );
}