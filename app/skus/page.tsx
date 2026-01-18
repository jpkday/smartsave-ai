"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

type Store = {
  id: string;
  name: string;
};

type Item = {
  id: number;
  name: string;
  category?: string;
};

type SkuMapping = {
  id: string;
  store_id: string;
  item_id: number;
  store_sku: string;
  created_at: string;
  stores: { name: string } | null;
  items: { name: string; category: string | null } | null;
};

export default function SkuManagement() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [skuValue, setSkuValue] = useState("");
  const [existingMappings, setExistingMappings] = useState<SkuMapping[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [existingSku, setExistingSku] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load stores
  useEffect(() => {
    const loadStores = async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      if (data) setStores(data);
    };
    loadStores();
  }, []);

  // Load existing mappings for selected store
  useEffect(() => {
    if (!selectedStoreId) {
      setExistingMappings([]);
      return;
    }

    const loadMappings = async () => {
      const { data } = await supabase
        .from("store_item_sku")
        .select(
          `
          id,
          store_id,
          item_id,
          store_sku,
          created_at,
          stores (name),
          items (name, category)
        `
        )
        .eq("store_id", selectedStoreId)
        .order("created_at", { ascending: false });

      if (data) setExistingMappings(data as any as SkuMapping[]);
    };

    loadMappings();
  }, [selectedStoreId]);

  // Search items
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchItems = async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, category")
        .ilike("name", `%${searchQuery}%`)
        .order("name")
        .limit(10);

      if (data) setSearchResults(data);
    };

    const debounce = setTimeout(searchItems, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !selectedItem || !skuValue.trim()) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("store_item_sku").upsert(
        {
          store_id: selectedStoreId,
          item_id: selectedItem.id,
          store_sku: skuValue.trim(),
        },
        {
          onConflict: "store_id,item_id",
        }
      );

      if (error) throw error;

      setMessage({
        type: "success",
        text: `SKU saved for ${selectedItem.name}`,
      });
      setSkuValue("");
      setSelectedItem(null);
      setSearchQuery("");
      setExistingSku(null);

      // Refresh mappings
      const { data } = await supabase
        .from("store_item_sku")
        .select(
          `
          id,
          store_id,
          item_id,
          store_sku,
          created_at,
          stores (name),
          items (name, category)
        `
        )
        .eq("store_id", selectedStoreId)
        .order("created_at", { ascending: false });

      if (data) setExistingMappings(data as any as SkuMapping[]);

      // Refocus the search input for next entry
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } catch (error: unknown) {
      const err = error as Error;
      setMessage({
        type: "error",
        text: err.message || "Failed to save SKU",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search items
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchItems = async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, category")
        .ilike("name", `%${searchQuery}%`)
        .order("name")
        .limit(10);

      if (data) setSearchResults(data);
    };

    const debounce = setTimeout(searchItems, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Check for existing SKU when item is selected
  useEffect(() => {
    if (!selectedItem || !selectedStoreId) {
      setExistingSku(null);
      setSkuValue("");
      return;
    }

    const checkExistingSku = async () => {
      const { data } = await supabase
        .from("store_item_sku")
        .select("store_sku")
        .eq("store_id", selectedStoreId)
        .eq("item_id", selectedItem.id)
        .single();

      if (data) {
        setExistingSku(data.store_sku);
        setSkuValue(data.store_sku); // Pre-populate the field
      } else {
        setExistingSku(null);
        setSkuValue("");
      }
    };

    checkExistingSku();
  }, [selectedItem, selectedStoreId]);

  const handleDeleteMapping = async (id: string) => {
    if (!confirm("Delete this SKU mapping?")) return;

    const { error } = await supabase
      .from("store_item_sku")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to delete mapping" });
      return;
    }

    setExistingMappings((prev) => prev.filter((m) => m.id !== id));
    setMessage({ type: "success", text: "Mapping deleted" });
  };

  return (
    <div className="min-h-screen bg-blue-50 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">SKU Management</h1>
          <p className="text-gray-600 mt-1">
            Map store SKUs to items for future receipt scanning
          </p>
        </div>

        {/* Store Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Store
          </label>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setSelectedItem(null);
              setSearchQuery("");
              setSkuValue("");
              setExistingSku(null);
              setMessage(null); // Clear the success/error message
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a store...</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        {/* Entry Form */}
        {selectedStoreId && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add SKU Mapping
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Item Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Item
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={selectedItem ? selectedItem.name : searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedItem(null);
                  }}
                  placeholder="Start typing item name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && !selectedItem && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedItem(item);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        {item.category && (
                          <div className="text-sm text-gray-500">
                            {item.category}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SKU Input */}
              {selectedItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store SKU
                    {existingSku && (
                      <span className="ml-2 text-sm text-red-600 font-normal">
                        (Override existing SKU)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={skuValue}
                    onChange={(e) => setSkuValue(e.target.value)}
                    placeholder="Enter SKU number..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              )}

              {/* Submit Button */}
              {selectedItem && (
                <button
                  type="submit"
                  disabled={isSubmitting || !skuValue.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {isSubmitting ? "Saving..." : "Save SKU Mapping"}
                </button>
              )}
            </form>

            {/* Message */}
            {message && (
              <div
                className={`mt-4 p-3 rounded-lg ${message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                  }`}
              >
                {message.text}
              </div>
            )}
          </div>
        )}

        {/* Existing Mappings */}
        {selectedStoreId && existingMappings.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Existing SKU Mappings ({existingMappings.length})
            </h2>

            <div className="space-y-2">
              {existingMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {mapping.items?.name || 'Unknown Item'}
                    </div>
                    <div className="text-sm text-gray-600">
                      SKU: {mapping.store_sku}
                      {mapping.items?.category && (
                        <span className="ml-2 text-gray-400">
                          • {mapping.items.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMapping(mapping.id)}
                    className="ml-4 text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {selectedStoreId && existingMappings.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            No SKU mappings yet for this store. Add one above!
          </div>
        )}
      </div>
    </div>
  );
}