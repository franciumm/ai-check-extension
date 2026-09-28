// content.js
// Non-destructive floating button approach with "Pin on Click" logic

let hoverButton = null;
let activeHoverImage = null;
const pinnedButtons = new Map(); // Maps img -> pinned button element

function createButton() {
  const btn = document.createElement('button');
  btn.className = 'aicheck-btn aicheck-floating';
  btn.textContent = 'Check?';
  btn.style.display = 'none';
  document.body.appendChild(btn);
  return btn;
}

function updateButtonPosition(btn, img) {
  if (!img || !btn) return;
  const rect = img.getBoundingClientRect();
  // Only update if image is visible
  if (rect.width === 0 || rect.height === 0) {
      btn.style.display = 'none';
      return;
  }
  btn.style.display = 'block';
  btn.style.top = `${rect.top + window.scrollY + 10}px`;
  btn.style.left = `${rect.right + window.scrollX - btn.offsetWidth - 10}px`;
}

// Initialize the single reusable hover button
hoverButton = createButton();
let currentMode = 'LOCAL';

function showHoverButtonForImage(img) {
  if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
  if (pinnedButtons.has(img)) return; // Don't show hover button if image already has a pinned button!

  activeHoverImage = img;
  currentMode = 'LOCAL';
  hoverButton.className = 'aicheck-btn aicheck-floating';
  hoverButton.textContent = 'Check?';
  
  updateButtonPosition(hoverButton, img);
}

// Track mouse movements to show/hide the hover button
document.addEventListener('mouseover', (e) => {
  if (e.target === hoverButton) return;
  if (e.target.tagName === 'IMG') {
      showHoverButtonForImage(e.target);
  }
});

// Hide hover button if mouse leaves image and doesn't enter button
document.addEventListener('mousemove', (e) => {
    if (!activeHoverImage) return;
    if (e.target === activeHoverImage || e.target === hoverButton) return;
    
    const rect = activeHoverImage.getBoundingClientRect();
    const buffer = 20;
    if (
        e.clientX < rect.left - buffer || 
        e.clientX > rect.right + buffer || 
        e.clientY < rect.top - buffer || 
        e.clientY > rect.bottom + buffer
    ) {
        hoverButton.style.display = 'none';
        activeHoverImage = null;
    }
});

// Update all button positions on scroll/resize
function updateAllPositions() {
    if (activeHoverImage && hoverButton.style.display !== 'none') {
        updateButtonPosition(hoverButton, activeHoverImage);
    }
    for (const [img, btn] of pinnedButtons.entries()) {
        updateButtonPosition(btn, img);
    }
}
window.addEventListener('scroll', updateAllPositions, { passive: true });
window.addEventListener('resize', updateAllPositions, { passive: true });

function handleButtonClick(btn, img) {
    if (btn.classList.contains('loading')) return;
    
    // PIN THE BUTTON if it's the hover button
    if (btn === hoverButton) {
        pinnedButtons.set(img, hoverButton);
        hoverButton = createButton(); // Generate a new reusable hover button for future images
        activeHoverImage = null; // Clear active hover
    }
    
    btn.textContent = currentMode === 'LOCAL' ? 'Scanning locally...' : 'Deep scanning...';
    btn.className = 'aicheck-btn aicheck-floating loading';
    
    const messageType = currentMode === 'LOCAL' ? 'LOCAL_SCAN' : 'DEEP_SCAN';
    
    chrome.runtime.sendMessage(
      { type: messageType, imageUrl: img.src },
      (response) => {
        if (!response || response.error) {
          btn.className = 'aicheck-btn aicheck-floating error';
          let errText = response ? response.error : 'No response';
          btn.textContent = '⚠️ ' + (errText.length > 25 ? errText.substring(0,25) + '...' : errText);
          btn.title = errText;
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
        updateButtonPosition(btn, img);
      }
    );
}

// Attach click listener to document so we catch clicks on dynamically created hover/pinned buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('aicheck-btn')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Find which image this button belongs to
        let targetImg = null;
        if (e.target === hoverButton) {
            targetImg = activeHoverImage;
        } else {
            for (const [img, btn] of pinnedButtons.entries()) {
                if (btn === e.target) {
                    targetImg = img;
                    break;
                }
            }
        }
        
        if (targetImg) {
            handleButtonClick(e.target, targetImg);
        }
    }
});

