import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center p-4">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">SmartSaveAI</h1>
        <p className="text-2xl mb-8">Stop overpaying for groceries. Compare prices across your local stores.</p>
        <div className="space-x-4">
        <Link href="/prices" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-white hover:text-blue-600 transition inline-block cursor-pointer">
            Prices
          </Link>
          <Link href="/compare" className="bg-green-500 text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-green-600 transition inline-block cursor-pointer">
            Compare
          </Link>
          <Link href="/items" className="bg-purple-500 text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-purple-600 transition inline-block cursor-pointer">
            Items
          </Link>
          <Link href="/receipts" className="bg-orange-500 text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-orange-600 transition inline-block cursor-pointer">
            Receipts
          </Link>
        </div>
      </div>
    </div>
  );
}