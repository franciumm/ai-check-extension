// content.js

// Keep track of processing to debounce MutationObserver
let processTimeout = null;

// Function to process a single image
function processImage(img) {
  // Skip if already processed
  if (img.dataset.aicheck) return;
  
  // Skip small images
  if (img.naturalWidth < 100 || img.naturalHeight < 100) {
    if (img.complete) {
        return;
    } else {
        img.addEventListener('load', () => {
            if (img.naturalWidth >= 100 && img.naturalHeight >= 100) {
                processImage(img);
            }
        }, { once: true });
        return;
    }
  }
  
  img.dataset.aicheck = 'true';
  
  let parent = img.parentElement;
  if (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (!['relative', 'absolute', 'fixed'].includes(parentStyle.position)) {
          const wrapper = document.createElement('div');
          wrapper.className = 'aicheck-wrapper';
          wrapper.style.display = window.getComputedStyle(img).display;
          if (wrapper.style.display === 'inline') wrapper.style.display = 'inline-block';
          
          img.parentNode.insertBefore(wrapper, img);
          wrapper.appendChild(img);
          parent = wrapper;
      }
  }

  const btn = document.createElement('button');
  btn.className = 'aicheck-btn';
  btn.textContent = 'Check?';
  
  let currentMode = 'LOCAL'; // 'LOCAL' or 'DEEP'
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (btn.classList.contains('loading')) return;
    
    btn.textContent = currentMode === 'LOCAL' ? 'Scanning locally...' : 'Deep scanning...';
    btn.className = 'aicheck-btn loading';
    
    const messageType = currentMode === 'LOCAL' ? 'LOCAL_SCAN' : 'DEEP_SCAN';
    
    chrome.runtime.sendMessage(
      { type: messageType, imageUrl: img.src },
      (response) => {
        if (!response || response.error) {
          btn.className = 'aicheck-btn error';
          btn.textContent = '⚠️ Error';
        } else if (response.status === 'NO_LICENSE') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '🔒 Get License';
          btn.onclick = () => alert("Please purchase a license key and enter it in the extension popup.");
        } else if (response.status === 'NO_CREDITS') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '💳 Out of credits';
        } else {
          // Success case
          const score = Math.round(response.score * 100);
          
          // Escalation logic: If local scan is inconclusive (20% to 80%)
          if (currentMode === 'LOCAL' && response.score >= 0.20 && response.score <= 0.80 && response.source !== 'metadata') {
            btn.className = 'aicheck-btn possibly-ai possibly-ai-escalate';
            btn.textContent = `⚠ Inconclusive (${score}%) - Deep Scan?`;
            currentMode = 'DEEP'; // Next click will run deep scan
            return;
          }
          
          // Otherwise, show final result
          const suffix = currentMode === 'LOCAL' ? '(Local)' : '(Deep)';
          
          switch(response.label) {
            case 'Not AI':
              btn.className = 'aicheck-btn not-ai';
              btn.textContent = `✓ Not AI ${suffix}`;
              break;
            case 'Possibly AI':
              btn.className = 'aicheck-btn possibly-ai';
              btn.textContent = `⚠ Possibly AI (${score}%) ${suffix}`;
              break;
            case 'Likely AI':
              btn.className = 'aicheck-btn likely-ai';
              btn.textContent = `⚡ Likely AI (${score}%) ${suffix}`;
              break;
            case 'Surely AI':
              btn.className = 'aicheck-btn surely-ai';
              btn.textContent = `🤖 Surely AI (${score}%) ${suffix}`;
              break;
            default:
              btn.className = 'aicheck-btn';
              btn.textContent = 'Check?';
          }
        }
      }
    );
  });
  
  if (parent) {
      parent.style.position = 'relative';
      parent.appendChild(btn);
  }
}

// Process all current images
function scanImages() {
  const images = document.querySelectorAll('img:not([data-aicheck])');
  images.forEach(processImage);
}

// Initial scan
scanImages();

// Setup observer for dynamically added images
const observer = new MutationObserver((mutations) => {
  let shouldScan = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      shouldScan = true;
      break;
    }
  }
  
  if (shouldScan) {
    clearTimeout(processTimeout);
    processTimeout = setTimeout(scanImages, 250);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
