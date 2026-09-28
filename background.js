// background.js

const BACKEND_URL = 'https://YOUR_VERCEL_URL';
const FREE_DAILY_LIMIT = 3;

// Helper to get today's date string YYYY-MM-DD
function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['usage'], (result) => {
    if (!result.usage) {
      chrome.storage.local.set({
        usage: {
          date: getTodayDateString(),
          count: 0
        }
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_IMAGE') {
    handleCheckImage(request.imageUrl).then(sendResponse).catch(err => {
      console.error(err);
      sendResponse({ error: err.message || 'Unknown error' });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'GET_USAGE') {
    getUsage().then(sendResponse);
    return true;
  }
  
  if (request.type === 'RESET_USAGE') {
    const newUsage = { date: getTodayDateString(), count: 0 };
    chrome.storage.local.set({ usage: newUsage }, () => {
      sendResponse(newUsage);
    });
    return true;
  }
});

async function getUsage() {
  const result = await chrome.storage.local.get(['usage']);
  const today = getTodayDateString();
  
  let usage = result.usage || { date: today, count: 0 };
  
  // Reset if it's a new day
  if (usage.date !== today) {
    usage = { date: today, count: 0 };
    await chrome.storage.local.set({ usage });
  }
  
  return {
    used: usage.count,
    limit: FREE_DAILY_LIMIT,
    date: usage.date
  };
}

async function handleCheckImage(imageUrl) {
  const usageStats = await getUsage();
  
  if (usageStats.used >= usageStats.limit) {
    return { status: 'FREE_LIMIT' };
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageUrl })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Increment usage on success
    const today = getTodayDateString();
    await chrome.storage.local.set({
      usage: {
        date: today,
        count: usageStats.used + 1
      }
    });
    
    return {
      score: data.score,
      label: data.label,
      generators: data.generators || []
    };
  } catch (err) {
    return { error: err.message };
  }
}
