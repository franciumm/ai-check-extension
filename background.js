// background.js

const BACKEND_URL = 'https://ai-check-backend.vercel.app';
let creatingOffscreen; // Promise tracking offscreen creation

// Ensure offscreen document exists
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['WORKERS'], // Transformers.js uses workers
      justification: 'Run local AI models via Transformers.js'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
    
    // Initialize model eagerly once created
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_INIT' });
  }
}

async function getBase64Image(url) {
  if (url.startsWith('data:')) return url; // Already base64
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image fetch failed with status: ${response.status}`);
  
  const buffer = await response.arrayBuffer();
  
  // High-performance ArrayBuffer to Base64 conversion for Service Workers
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Chunk to avoid call stack limits
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  
  const base64 = btoa(binary);
  const type = response.headers.get('content-type') || 'image/jpeg';
  return `data:${type};base64,${base64}`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOCAL_SCAN') {
    (async () => {
      try {
        await setupOffscreenDocument();
        
        // Fetch image in the background script to bypass CORS restrictions
        const dataUrl = await getBase64Image(request.imageUrl);
        
        const response = await chrome.runtime.sendMessage({
          type: 'OFFSCREEN_SCAN',
          imageUrl: dataUrl
        });
        sendResponse(response);
      } catch (err) {
        console.error("Local Scan Error:", err);
        sendResponse({ error: 'Local scan failed: ' + err.message });
      }
    })();
    return true; // async
  }

  if (request.type === 'DEEP_SCAN') {
    handleDeepScan(request.imageUrl).then(sendResponse).catch(err => {
      console.error(err);
      sendResponse({ error: err.message || 'Unknown error' });
    });
    return true; // async
  }
  
  if (request.type === 'GET_LICENSE') {
      chrome.storage.local.get(['licenseKey'], (res) => {
          sendResponse({ licenseKey: res.licenseKey || null });
      });
      return true;
  }
  
  if (request.type === 'SET_LICENSE') {
      chrome.storage.local.set({ licenseKey: request.licenseKey }, () => {
          sendResponse({ success: true });
      });
      return true;
  }
});

async function handleDeepScan(imageUrl) {
  const storage = await chrome.storage.local.get(['licenseKey']);
  const licenseKey = storage.licenseKey;
  
  if (!licenseKey) {
    return { status: 'NO_LICENSE' };
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageUrl, licenseKey })
    });
    
    if (response.status === 403) {
        return { status: 'NO_CREDITS' };
    }
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return {
      score: data.score,
      label: data.label,
      source: 'cloud',
      generators: data.generators || []
    };
  } catch (err) {
    return { error: err.message };
  }
}

