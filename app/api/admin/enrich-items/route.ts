import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Service Role for Admin updates if available, but here using anon/public logic or env vars)
// Ideally we need SERVICE_ROLE_KEY to update items without RLS issues if we are "Admin".
// For now, assuming standard client works or user has configured env.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// NOTE: In a real admin script, use SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    try {
        // 1. Find items with no category
        // 'category_id' is null.
        const { data: items, error: fetchError } = await supabase
            .from('items')
            .select('id, name')
            .is('category_id', null)
            .limit(limit);

        if (fetchError) {
            throw new Error(`Error fetching items: ${fetchError.message}`);
        }

        if (!items || items.length === 0) {
            return NextResponse.json({ message: 'No items found needing enrichment.' });
        }

        const results = [];

        // 2. Loop and Enrich
        for (const item of items) {
            console.log(`Enriching item: ${item.name} (${item.id})`);

            try {
                const costcoData = await searchCostco(item.name);

                if (costcoData) {
                    const { categoryName, imageUrl } = costcoData;

                    // 3. Get or Create Category
                    let categoryId = null;
                    if (categoryName) {
                        categoryId = await getOrCreateCategory(categoryName);
                    }

                    // 4. Update Item
                    const updatePayload: any = {};
                    if (categoryId) updatePayload.category_id = categoryId;
                    if (imageUrl) updatePayload.image_url = imageUrl;

                    if (Object.keys(updatePayload).length > 0) {
                        const { error: updateError } = await supabase
                            .from('items')
                            .update(updatePayload)
                            .eq('id', item.id);

                        if (updateError) {
                            console.error(`Failed to update item ${item.id}:`, updateError);
                            results.push({ id: item.id, name: item.name, status: 'failed_update', error: updateError.message });
                        } else {
                            results.push({ id: item.id, name: item.name, status: 'updated', enrichment: updatePayload });
                        }
                    } else {
                        results.push({ id: item.id, name: item.name, status: 'no_data_to_update' });
                    }

                } else {
                    results.push({ id: item.id, name: item.name, status: 'not_found_in_costco' });
                }

            } catch (err: any) {
                console.error(`Error processing item ${item.name}:`, err);
                results.push({ id: item.id, name: item.name, status: 'error', error: err.message });
            }

            // Respect rate limits nicely
            await new Promise(r => setTimeout(r, 1000));
        }

        return NextResponse.json({
            processed: items.length,
            results
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function getOrCreateCategory(categoryName: string): Promise<string | null> {
    // 1. Clean name
    const cleanName = categoryName.trim();
    if (!cleanName) return null;

    // 2. Try to find existing
    // Note: Assuming 'categories' table has 'id' and 'name'.
    const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', cleanName) // Case insensitive match
        .single();

    if (existing) return existing.id;

    // 3. Create new
    const { data: newCat, error } = await supabase
        .from('categories')
        .insert({ name: cleanName })
        .select('id')
        .single();

    if (error) {
        console.error(`Error creating category ${cleanName}:`, error);
        return null;
    }

    return newCat.id;
}

// COSTCO SEARCH LOGIC
async function searchCostco(searchTerm: string): Promise<{ categoryName: string | null, imageUrl: string | null } | null> {
    // This function attempts to emulate the GraphQL search provided by the user.
    // In reality, this requires valid Headers/Cookies/Auth to work against sameday.costco.com.
    // The user should update the HEADERS and QUERY below.

    const endpoint = "https://sameday.costco.com/graphql"; // Or v3/graphql

    // Constructing a query similar to the structure observed in the response
    const query = `
      query Search($query: String!) {
        searchResultsPlacements(query: $query, page: 1, perPage: 1) {
          placements {
             content {
                ... on SearchContentManagementSearchItemGrid {
                   __typename
                   items {
                      name
                      viewSection {
                          itemImage {
                              url
                          }
                          trackingProperties {
                              product_category_name
                          }
                      }
                   }
                }
             }
          }
        }
      }
    `;

    const variables = { query: searchTerm };

    // TODO: USER MUST PROVIDE VALID AUTH HEADERS HERE
    // You can get these by inspecting a network request on sameday.costco.com
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // "Authorization": "Bearer <TOKEN>",
        // "X-Client-Id": "...",
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables })
        });

        // Parse JSON even if status is not 200, to see errors
        const json = await response.json();

        if (json.errors) {
            console.error("GraphQL Errors:", json.errors);
            return null;
        }

        const placements = json.data?.searchResultsPlacements?.placements;

        if (!placements || !Array.isArray(placements)) return null;

        // Find the Item Grid
        const gridPlacement = placements.find((p: any) => p?.content?.__typename === 'SearchContentManagementSearchItemGrid');

        if (!gridPlacement) return null;

        const items = gridPlacement.content.items;
        if (!items || items.length === 0) return null;

        const firstItem = items[0];

        // MAPPING
        // The user provided response has `product_category_name` and `itemImage.url`
        // Note: Field names in GraphQL result match the query alias or field name.
        // My Query uses `productCategoryName: product_category_name`.

        // Actually, looking at user's JSON:
        // "trackingProperties": { "product_category_name": "Pre-Workout Supplements" } ?
        // Or "product_category_name" at root of item?
        // User snippet: 
        // "product_category_name" IS NOT VISIBLE AT TOP LEVEL of Item in the JSON he pasted?
        // Wait, let me check the JSON snippet again.

        // ItemsItem:
        // "name": "Mr. Hyde ..."
        // "viewSection": { "trackingProperties": { "product_category_name": "Pre-Workout Supplements" } }

        // AHA! It is nested in `viewSection.trackingProperties.product_category_name`.

        // I need to update my Query to fetch that deep field if possible, OR just access it if I request the whole object.
        // But GraphQL requires specific field requests.

        // Revised extraction based on typical GQL:
        // item {
        //   viewSection {
        //      trackingProperties {
        //         product_category_name
        //      }
        //   }
        // }

        const category = firstItem.viewSection?.trackingProperties?.product_category_name || null;
        const image = firstItem.viewSection?.itemImage?.url || firstItem.itemImage?.url || null;

        return {
            categoryName: category,
            imageUrl: image
        };

    } catch (e) {
        console.error("Scrape failed:", e);
        return null;
    }
}
