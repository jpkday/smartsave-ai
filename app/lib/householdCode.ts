export function getHouseholdCode(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('household_code');
  }
  
  export function setHouseholdCode(code: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('household_code', code.toUpperCase());
  }