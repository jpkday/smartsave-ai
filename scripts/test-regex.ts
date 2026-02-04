
const itemName = "(2 pack) Great Value 100% Apple Juice, 96 fl oz";

const leadingSizeMatch = itemName.match(/^(\(?\d+(\.\d+)?\s?("|in|inch|lb|lbs|oz|kg|g|count|ct|pack)\)?\s?[-]?\s?)/i);

console.log("Match:", leadingSizeMatch);

if (leadingSizeMatch) {
    console.log("Captured:", leadingSizeMatch[0]);
    console.log("Remaining:", itemName.substring(leadingSizeMatch[0].length));
} else {
    console.log("No Match at Start");
}
