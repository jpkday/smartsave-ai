'use client';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string | null;
  currentPreference: string;
  storeOptions: Array<{ store: string; price: number }>;
  allStores: string[];
  onSelectStore: (itemName: string, store: string) => void;
  onOpenEditModalForPrice: (itemName: string, store: string) => void;
  formatMoney: (amount: number) => string;
}

export default function StoreModal({
  isOpen,
  onClose,
  itemName,
  currentPreference,
  storeOptions,
  allStores,
  onSelectStore,
  onOpenEditModalForPrice,
  formatMoney,
}: StoreModalProps) {
  if (!isOpen || !itemName) return null;

  // Find stores WITHOUT price data
  const storesWithoutPrice = allStores.filter(
    (store) => !storeOptions.find((opt) => opt.store === store)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span>Swap Store</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">{itemName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            {/* Auto option - only if there are options with prices */}
            {storeOptions.length > 0 && (
              <button
                onClick={() => {
                  onSelectStore(itemName, 'AUTO');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition text-left ${
                  currentPreference === 'AUTO' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">Auto (cheapest)</span>
                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">{storeOptions[0].store}</span>
                </div>
                <span className="font-bold text-gray-800">{formatMoney(storeOptions[0].price)}</span>
              </button>
            )}

            {/* Store options - stores with prices */}
            {storeOptions.map(({ store, price }, idx) => {
              const isSelected = currentPreference === store;
              const isBestPrice = idx === 0;

              return (
                <button
                  key={store}
                  onClick={() => {
                    onSelectStore(itemName, store);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition text-left ${
                    isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{store}</span>
                    {isBestPrice && (
                      <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                        Best Price
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-gray-800">{formatMoney(price)}</span>
                </button>
              );
            })}
          </div>

          {/* Stores without prices - now swappable! */}
          {storesWithoutPrice.length > 0 && (
            <div className="pt-3 border-t-2 border-dashed border-gray-200">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">
                {storeOptions.length === 0 ? "Select a Store:" : "Other Favorite Stores:"}
              </h4>
              <div className="space-y-2">
                {storesWithoutPrice.map((store) => {
                  const isSelected = currentPreference === store;
                  return (
                    <div
                      key={store}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed transition text-left ${
                        isSelected ? 'border-indigo-400 bg-indigo-50 font-bold' : 'border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          onSelectStore(itemName, store);
                          onClose();
                        }}
                      >
                        <span className="text-gray-800">{store}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onSelectStore(itemName, store);
                            onClose();
                          }}
                          className={`p-2 rounded-lg transition ${
                            isSelected ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                          title={isSelected ? 'Currently Selected' : 'Swap to this store'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>

                        <button
                          onClick={() => {
                            onOpenEditModalForPrice(itemName, store);
                          }}
                          className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-full transition"
                          title="Add Price"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
