// content.js
// Non-destructive floating button approach to prevent breaking React/Vue layouts (like Twitter)

let activeImage = null;
let currentMode = 'LOCAL';

// Create the floating button
const btn = document.createElement('button');
btn.className = 'aicheck-btn aicheck-floating';
btn.textContent = 'Check?';
btn.style.display = 'none'; // Hidden by default
document.body.appendChild(btn);

// Map to store results for images we've already checked so we don't lose them
const resultsCache = new WeakMap();

function updateButtonPosition(img) {
  const rect = img.getBoundingClientRect();
  btn.style.top = `${rect.top + window.scrollY + 10}px`;
  btn.style.left = `${rect.right + window.scrollX - btn.offsetWidth - 10}px`;
}

function showButtonForImage(img) {
  if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
  
  activeImage = img;
  
  // Restore state if we already checked it
  if (resultsCache.has(img)) {
      const state = resultsCache.get(img);
      btn.className = state.className;
      btn.textContent = state.text;
      currentMode = state.mode;
  } else {
      btn.className = 'aicheck-btn aicheck-floating';
      btn.textContent = 'Check?';
      currentMode = 'LOCAL';
  }
  
  btn.style.display = 'block';
  updateButtonPosition(img);
}

// Track mouse movements to show/hide the button
document.addEventListener('mouseover', (e) => {
  if (e.target === btn) return; // Don't hide if hovering the button itself
  
  if (e.target.tagName === 'IMG') {
      showButtonForImage(e.target);
  }
});

// Hide button if mouse leaves image and doesn't enter button
document.addEventListener('mousemove', (e) => {
    if (!activeImage) return;
    if (e.target === activeImage || e.target === btn) return;
    
    // Allow a small buffer zone
    const rect = activeImage.getBoundingClientRect();
    const buffer = 20;
    if (
        e.clientX < rect.left - buffer || 
        e.clientX > rect.right + buffer || 
        e.clientY < rect.top - buffer || 
        e.clientY > rect.bottom + buffer
    ) {
        // Only hide if we aren't currently loading
        if (!btn.classList.contains('loading')) {
            btn.style.display = 'none';
            activeImage = null;
        }
    }
});

// Update position on scroll/resize if button is visible
window.addEventListener('scroll', () => {
    if (activeImage && btn.style.display !== 'none') updateButtonPosition(activeImage);
}, { passive: true });
window.addEventListener('resize', () => {
    if (activeImage && btn.style.display !== 'none') updateButtonPosition(activeImage);
}, { passive: true });

// Handle clicks
btn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (btn.classList.contains('loading') || !activeImage) return;
  
  btn.textContent = currentMode === 'LOCAL' ? 'Scanning locally...' : 'Deep scanning...';
  btn.className = 'aicheck-btn aicheck-floating loading';
  
  const messageType = currentMode === 'LOCAL' ? 'LOCAL_SCAN' : 'DEEP_SCAN';
  const imgToScan = activeImage;
  
  chrome.runtime.sendMessage(
    { type: messageType, imageUrl: imgToScan.src },
    (response) => {
      // If we hovered away while loading, we might still want to save the result
      if (!response || response.error) {
        btn.className = 'aicheck-btn aicheck-floating error';
        btn.textContent = '⚠️ Error';
      } else if (response.status === 'NO_LICENSE') {
        btn.className = 'aicheck-btn aicheck-floating locked';
        btn.textContent = '🔒 Get License';
        btn.onclick = () => alert("Please purchase a license key and enter it in the extension popup.");
      } else if (response.status === 'NO_CREDITS') {
        btn.className = 'aicheck-btn aicheck-floating locked';
        btn.textContent = '💳 Out of credits';
      } else {
        const score = Math.round(response.score * 100);
        
        if (currentMode === 'LOCAL' && response.score >= 0.20 && response.score <= 0.80 && response.source !== 'metadata') {
          btn.className = 'aicheck-btn aicheck-floating possibly-ai possibly-ai-escalate';
          btn.textContent = `⚠ Inconclusive (${score}%) - Deep Scan?`;
          currentMode = 'DEEP';
        } else {
          const suffix = currentMode === 'LOCAL' ? '(Local)' : '(Deep)';
          switch(response.label) {
            case 'Not AI':
              btn.className = 'aicheck-btn aicheck-floating not-ai';
              btn.textContent = `✓ Not AI ${suffix}`;
              break;
            case 'Possibly AI':
              btn.className = 'aicheck-btn aicheck-floating possibly-ai';
              btn.textContent = `⚠ Possibly AI (${score}%) ${suffix}`;
              break;
            case 'Likely AI':
              btn.className = 'aicheck-btn aicheck-floating likely-ai';
              btn.textContent = `⚡ Likely AI (${score}%) ${suffix}`;
              break;
            case 'Surely AI':
              btn.className = 'aicheck-btn aicheck-floating surely-ai';
              btn.textContent = `🤖 Surely AI (${score}%) ${suffix}`;
              break;
            default:
              btn.className = 'aicheck-btn aicheck-floating';
              btn.textContent = 'Check?';
          }
        }
      }
      
      // Save result so it persists if they hover away and come back
      resultsCache.set(imgToScan, {
          className: btn.className,
          text: btn.textContent,
          mode: currentMode
      });
      
      if (activeImage === imgToScan) {
          updateButtonPosition(activeImage);
      }
    }
  );
});

