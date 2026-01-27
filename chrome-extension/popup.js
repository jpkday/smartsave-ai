// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const { householdCode, apiUrl } = await chrome.storage.sync.get(['householdCode', 'apiUrl']);

  if (householdCode) {
    document.getElementById('householdCode').value = householdCode;
  }
  if (apiUrl) {
    document.getElementById('apiUrl').value = apiUrl;
  }

  // Enable sync button if settings are configured
  updateSyncButton();
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', async () => {
  const householdCode = document.getElementById('householdCode').value.trim();
  const apiUrl = document.getElementById('apiUrl').value.trim().replace(/\/$/, ''); // Remove trailing slash

  if (!householdCode || !apiUrl) {
    showStatus('status', 'Please fill in all fields', 'error');
    return;
  }

  await chrome.storage.sync.set({ householdCode, apiUrl });
  showStatus('status', 'Settings saved!', 'success');
  updateSyncButton();
});

// Sync current page
document.getElementById('syncBtn').addEventListener('click', async () => {
  const syncBtn = document.getElementById('syncBtn');
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';

  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('walmart.com') && !tab.url.includes('costco.com')) {
      showStatus('syncStatus', 'Please navigate to a Walmart or Costco receipt page', 'error');
      return;
    }

    // Execute content script and get receipt data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeReceiptData
    });

    const receiptData = results[0]?.result;

    if (!receiptData || !receiptData.items || receiptData.items.length === 0) {
      showStatus('syncStatus', 'No receipt data found on this page. Make sure you\'re viewing a receipt.', 'error');
      return;
    }

    // Get settings
    const { householdCode, apiUrl } = await chrome.storage.sync.get(['householdCode', 'apiUrl']);

    // Send to API
    const response = await fetch(`${apiUrl}/api/receipts/import-external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-household-code': householdCode
      },
      body: JSON.stringify(receiptData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync receipt');
    }

    const result = await response.json();
    showStatus('syncStatus', `Synced ${receiptData.items.length} items!`, 'success');

  } catch (err) {
    showStatus('syncStatus', err.message, 'error');
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync Current Page';
  }
});

function showStatus(elementId, message, type) {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = `status ${type}`;
}

function updateSyncButton() {
  chrome.storage.sync.get(['householdCode', 'apiUrl'], ({ householdCode, apiUrl }) => {
    document.getElementById('syncBtn').disabled = !householdCode || !apiUrl;
  });
}

// This function runs in the context of the page
function scrapeReceiptData() {
  const url = window.location.href;

  // Detect which site we're on
  if (url.includes('walmart.com')) {
    return scrapeWalmartReceipt();
  } else if (url.includes('costco.com')) {
    return scrapeCostcoReceipt();
  }

  return null;

  function scrapeWalmartReceipt() {
    const items = [];

    // Walmart receipt lookup page structure
    // Look for item rows - this may need adjustment based on actual DOM
    const itemRows = document.querySelectorAll('[data-testid="item-row"], .receipt-item, tr[class*="item"]');

    if (itemRows.length === 0) {
      // Try alternative selectors for different Walmart receipt formats
      const altRows = document.querySelectorAll('.line-item, [class*="lineItem"], [class*="receipt"] li');
      altRows.forEach(row => {
        const text = row.textContent || '';
        // Try to parse price from text
        const priceMatch = text.match(/\$(\d+\.?\d*)/);
        if (priceMatch) {
          items.push({
            name: text.replace(/\$[\d.]+/g, '').trim().substring(0, 100),
            price: parseFloat(priceMatch[1]),
            quantity: 1,
            sku: ''
          });
        }
      });
    } else {
      itemRows.forEach(row => {
        const nameEl = row.querySelector('[class*="description"], [class*="name"], td:first-child');
        const priceEl = row.querySelector('[class*="price"], td:last-child');
        const skuEl = row.querySelector('[class*="sku"], [class*="upc"]');
        const qtyEl = row.querySelector('[class*="qty"], [class*="quantity"]');

        if (nameEl) {
          const priceText = priceEl?.textContent || '';
          const priceMatch = priceText.match(/\$?(\d+\.?\d*)/);

          items.push({
            name: nameEl.textContent?.trim() || '',
            price: priceMatch ? parseFloat(priceMatch[1]) : 0,
            quantity: parseInt(qtyEl?.textContent || '1') || 1,
            sku: skuEl?.textContent?.trim() || ''
          });
        }
      });
    }

    // Try to get store info and date
    const storeEl = document.querySelector('[class*="store"], [class*="location"]');
    const dateEl = document.querySelector('[class*="date"], time');

    return {
      source: 'walmart',
      store: storeEl?.textContent?.trim() || 'Walmart',
      date: dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0],
      items: items.filter(i => i.name && i.price > 0)
    };
  }

  function scrapeCostcoReceipt() {
    const items = [];

    // Costco order detail page structure
    const itemRows = document.querySelectorAll('[class*="product"], [class*="item-row"], .order-item');

    itemRows.forEach(row => {
      const nameEl = row.querySelector('[class*="name"], [class*="description"], h3, h4');
      const priceEl = row.querySelector('[class*="price"], [class*="cost"]');
      const skuEl = row.querySelector('[class*="item-number"], [class*="sku"]');
      const qtyEl = row.querySelector('[class*="qty"], [class*="quantity"]');

      if (nameEl) {
        const priceText = priceEl?.textContent || '';
        const priceMatch = priceText.match(/\$?(\d+\.?\d*)/);

        items.push({
          name: nameEl.textContent?.trim() || '',
          price: priceMatch ? parseFloat(priceMatch[1]) : 0,
          quantity: parseInt(qtyEl?.textContent || '1') || 1,
          sku: skuEl?.textContent?.trim().replace(/[^\d]/g, '') || ''
        });
      }
    });

    const dateEl = document.querySelector('[class*="order-date"], [class*="date"]');

    return {
      source: 'costco',
      store: 'Costco',
      date: dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0],
      items: items.filter(i => i.name && i.price > 0)
    };
  }
}
