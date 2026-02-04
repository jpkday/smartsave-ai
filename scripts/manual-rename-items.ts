
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BRANDS = [
    // Costco
    'Kirkland Signature', 'Kirkland', 'Member\'s Mark',
    // Walmart / General
    'Great Value', 'Equate', 'Marketside', 'Sam\'s Choice', 'Parent\'s Choice',
    'Mainstays', 'Better Homes & Gardens',
    // Popular CPG
    'Bibigo', 'Dyson', 'Tide', 'Charmin', 'Bounty', 'Dixie', 'French\'s', 'Hefty', 'Ziploc', 'Reynolds',
    'Chobani', 'Yoplait', 'Daisy', 'Tyson', 'Perdue', 'Foster Farms', 'Just Bare', 'Aidells', 'Hillshire Farm',
    'Starbucks', 'Peet\'s', 'Folgers', 'Nestle', 'Swiss Miss', 'Carnation',
    'Kellogg\'s', 'General Mills', 'Post', 'Quaker', 'Nature Valley',
    'Campbell\'s', 'Progresso', 'Prego', 'Rao\'s', 'Bertolli', 'Barilla',
    'Kraft', 'Heinz', 'Hellmann\'s', 'Best Foods', 'Skippy', 'Jif',
    'Oreo', 'Chips Ahoy', 'Ritz', 'Cheez-It', 'Goldfish', 'Pringles',
    'Doritos', 'Lay\'s', 'Ruffles', 'Tostitos', 'Cheetos', 'Fritos',
    'Coke', 'Coca-Cola', 'Pepsi', 'Sprite', 'Dr Pepper', 'Gatorade',
    'Tropicana', 'Minute Maid', 'Ocean Spray', 'Welch\'s', 'Mott\'s',
    'Band-Aid', 'Colgate', 'Crest', 'Dove', 'Pantene', 'Head & Shoulders',
    'Purina', 'Blue Buffalo', 'Iams', 'Pedigree', 'Meow Mix', 'Fancy Feast',
    'Jus-Rol'
];

function cleanName(original: string): string {
    let name = original.trim();
    let detectedBrand = '';
    let detectedSize = '';

    // 0. Detect Leading Dimensions/Counts (e.g., '10" ', '(2 pack) ', '3 lb ')
    // Supports optional parens
    const leadingSizeMatch = name.match(/^(\(?\d+(\.\d+)?\s?("|in|inch|lb|lbs|oz|kg|g|count|ct|pack)\)?\s?[-]?\s?)/i);
    if (leadingSizeMatch) {
        let sizeVal = leadingSizeMatch[0].trim().replace(/-$/, '');
        // Strip parens for cleaner merging
        sizeVal = sizeVal.replace(/[()]/g, '').trim();

        if (!detectedSize) detectedSize = sizeVal;
        else detectedSize = `${sizeVal}, ${detectedSize}`;

        name = name.substring(leadingSizeMatch[0].length).trim();
        name = name.replace(/^[,.\s-]+/, '').trim();
    }

    // 0.5. Move Leading "100%" (e.g. "100% Apple Juice" -> "Apple Juice, 100%")
    const percentMatch = name.match(/^(100%)\s+/);
    if (percentMatch) {
        // Remove from start
        name = name.substring(percentMatch[0].length).trim();
        // Insert after first comma, or append
        const commaIndex = name.indexOf(',');
        if (commaIndex !== -1) {
            name = name.slice(0, commaIndex) + ", 100%" + name.slice(commaIndex);
        } else {
            name = `${name}, 100%`;
        }
    }

    // 1. Detect Brand at Start
    for (const brand of BRANDS) {
        if (name.toLowerCase().startsWith(brand.toLowerCase())) {
            detectedBrand = brand;
            name = name.substring(brand.length).trim();
            name = name.replace(/^[,.\s-]+/, '').trim();
            break;
        }
    }

    // 2. Detect Size at End
    const sizeMatch = name.match(/,?\s?(\(?\d+(\.\d+)?\s?(oz|lb|lbs|g|kg|ct|count|pack|fl oz|ml|l|gal|Can)[\w\s-]*\)?)$/i);
    // Added parens support to end match too, and 'Can'
    if (sizeMatch) {
        let possibleSize = sizeMatch[1].trim();
        // Strip parens
        possibleSize = possibleSize.replace(/[()]/g, '').trim();

        // Append to existing size if any (e.g. "2 pack, 5oz")
        if (!detectedSize) detectedSize = possibleSize;
        else detectedSize = `${detectedSize}, ${possibleSize}`; // Append to end

        name = name.substring(0, sizeMatch.index).trim();
    }

    // Remove any trailing comma
    if (name.endsWith(',')) name = name.slice(0, -1).trim();

    // Construct New Name
    let final = name;
    const suffixes: string[] = [];
    if (detectedBrand) suffixes.push(detectedBrand);
    if (detectedSize) suffixes.push(`(${detectedSize})`);

    if (suffixes.length > 0) {
        final = `${final}, ${suffixes.join(' ')}`;
    }

    return final;
}

async function main() {
    console.log("🛠️  Starting Manual Renaming...");

    // Fetch ALL items (Supabase defaults to 1000 limit, so we must paginate)
    let allItems: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data: batch, error } = await supabase
            .from('items')
            .select('id, name')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) { console.error("DB Error:", error); break; }
        if (!batch || batch.length === 0) break;

        allItems = allItems.concat(batch);
        page++;
        if (batch.length < pageSize) break; // Last page
    }

    console.log(`Processing ${allItems.length} items...`);

    let updatesCount = 0;

    for (const item of allItems) {
        const newName = cleanName(item.name);

        if (newName !== item.name) {
            // console.log(`"${item.name}" \n -> "${newName}"`);

            const { error: updateError } = await supabase
                .from('items')
                .update({ name: newName })
                .eq('id', item.id);

            if (!updateError) {
                updatesCount++;
                if (updatesCount % 50 === 0) process.stdout.write('.');
            }
        }
    }

    console.log(`\n✅ Updated ${updatesCount} items.`);
}

main();
