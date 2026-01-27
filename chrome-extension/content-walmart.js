// Content script for Walmart pages
// This runs automatically on Walmart receipt pages

(function() {
    // Add a floating badge to indicate the extension is active
    const badge = document.createElement('div');
    badge.className = 'smartsave-sync-badge';
    badge.innerHTML = '🛒 SmartSave Ready';
    badge.title = 'Click to sync this receipt to SmartSave';
    document.body.appendChild(badge);

    // Badge click handler - trigger sync via popup
    badge.addEventListener('click', () => {
        badge.innerHTML = '⏳ Open extension popup to sync...';
    });

    console.log('[SmartSave] Extension loaded on Walmart page');
})();
