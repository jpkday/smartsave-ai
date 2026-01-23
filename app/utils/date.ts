/**
 * Centralized date utility for SmartSaveAI 
 * 
 * Corrects common timezone-related date shift issues by ensuring YYYY-MM-DD
 * strings are interpreted as local time rather than UTC midnight.
 */

/**
 * Parses a YYYY-MM-DD string into a local Date object.
 * This avoids the day-shift that happens with new Date("2024-01-23") 
 * when interpreted as UTC.
 */
export const parseLocalDate = (dateString: string): Date => {
    if (!dateString) return new Date();

    // Handle strings like "2024-01-23T10:21:57" or just "2024-01-23"
    const baseDate = dateString.split('T')[0];
    const [year, month, day] = baseDate.split('-').map(Number);

    // Date constructor with year, monthIndex, day uses local time
    return new Date(year, month - 1, day);
};

/**
 * Returns today's date (or a specific date) in YYYY-MM-DD local format.
 */
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Formats a YYYY-MM-DD string for display in local time.
 * e.g., "2024-01-23" -> "1/23/2024" (or local equivalent)
 */
export const formatLocalDate = (dateString: string, options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
}): string => {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString(undefined, options);
};
