// content.js
// Non-destructive floating button approach with "Pin on Click" logic

let hoverContainer = null;
let activeHoverImage = null;
const pinnedContainers = new Map(); // Maps img -> pinned container element

function createContainer() {
  const container = document.createElement('div');
  container.className = 'aicheck-container aicheck-floating';
  container.style.display = 'none';
  
  const btnLocal = document.createElement('button');
  btnLocal.className = 'aicheck-btn btn-local';
  btnLocal.textContent = 'Local Check';
  btnLocal.dataset.mode = 'LOCAL';
  
  const btnDeep = document.createElement('button');
  btnDeep.className = 'aicheck-btn btn-deep';
  btnDeep.textContent = 'Deep Check 🔍';
  btnDeep.dataset.mode = 'DEEP';
  
  container.appendChild(btnLocal);
  container.appendChild(btnDeep);
  
  document.body.appendChild(container);
  return container;
}

function updateContainerPosition(container, img) {
  if (!img || !container) return;
  const rect = img.getBoundingClientRect();
  // Only update if image is visible
  if (rect.width === 0 || rect.height === 0) {
      container.style.display = 'none';
      return;
  }
  container.style.display = 'flex';
  container.style.gap = '5px';
  container.style.top = `${rect.top + window.scrollY + 10}px`;
  container.style.left = `${rect.right + window.scrollX - container.offsetWidth - 10}px`;
}

// Initialize the single reusable hover container
hoverContainer = createContainer();

function showHoverContainerForImage(img) {
  if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
  if (pinnedContainers.has(img)) return; // Don't show hover container if image already has a pinned container!

  activeHoverImage = img;
  
  // Reset buttons
  const btnLocal = hoverContainer.querySelector('.btn-local');
  const btnDeep = hoverContainer.querySelector('.btn-deep');
  
  btnLocal.className = 'aicheck-btn btn-local';
  btnLocal.textContent = 'Local Check';
  btnLocal.style.display = 'block';
  
  btnDeep.className = 'aicheck-btn btn-deep';
  btnDeep.textContent = 'Deep Check 🔍';
  btnDeep.style.display = 'block';
  
  updateContainerPosition(hoverContainer, img);
}

// Track mouse movements to show/hide the hover container
document.addEventListener('mouseover', (e) => {
  if (hoverContainer.contains(e.target)) return;
  if (e.target.tagName === 'IMG') {
      showHoverContainerForImage(e.target);
  }
});

// Hide hover container if mouse leaves image and doesn't enter container
document.addEventListener('mousemove', (e) => {
    if (!activeHoverImage) return;
    if (e.target === activeHoverImage || hoverContainer.contains(e.target)) return;
    
    const rect = activeHoverImage.getBoundingClientRect();
    const buffer = 20;
    if (
        e.clientX < rect.left - buffer || 
        e.clientX > rect.right + buffer || 
        e.clientY < rect.top - buffer || 
        e.clientY > rect.bottom + buffer
    ) {
        hoverContainer.style.display = 'none';
        activeHoverImage = null;
    }
});

// Update all container positions on scroll/resize
function updateAllPositions() {
    if (activeHoverImage && hoverContainer.style.display !== 'none') {
        updateContainerPosition(hoverContainer, activeHoverImage);
    }
    for (const [img, container] of pinnedContainers.entries()) {
        updateContainerPosition(container, img);
    }
}
window.addEventListener('scroll', updateAllPositions, { passive: true });
window.addEventListener('resize', updateAllPositions, { passive: true });

function handleButtonClick(btn, img, container) {
    if (btn.classList.contains('loading')) return;
    
    // PIN THE CONTAINER if it's the hover container
    if (container === hoverContainer) {
        pinnedContainers.set(img, hoverContainer);
        hoverContainer = createContainer(); // Generate a new reusable hover container for future images
        activeHoverImage = null; // Clear active hover
    }
    
    const mode = btn.dataset.mode;
    const otherBtn = container.querySelector(mode === 'LOCAL' ? '.btn-deep' : '.btn-local');
    if (otherBtn) otherBtn.style.display = 'none'; // Hide the other button while scanning
    
    btn.textContent = mode === 'LOCAL' ? 'Scanning locally...' : 'Deep scanning...';
    btn.className = `aicheck-btn ${mode === 'LOCAL' ? 'btn-local' : 'btn-deep'} loading`;
    
    const messageType = mode === 'LOCAL' ? 'LOCAL_SCAN' : 'DEEP_SCAN';
    
    chrome.runtime.sendMessage(
      { type: messageType, imageUrl: img.src },
      (response) => {
        if (!response || response.error) {
          btn.className = 'aicheck-btn error';
          let errText = response ? response.error : 'No response';
          btn.textContent = '⚠️ ' + (errText.length > 25 ? errText.substring(0,25) + '...' : errText);
          btn.title = errText;
        } else if (response.status === 'NO_LICENSE') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '🔒 Get License';
          btn.onclick = () => alert("Please purchase a license key and enter it in the extension popup.");
        } else if (response.status === 'NO_CREDITS') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '💸 Out of credits';
        } else {
          const score = Math.round(response.score * 100);
          
          if (mode === 'LOCAL' && response.score >= 0.20 && response.score <= 0.80 && response.source !== 'metadata') {
            btn.className = 'aicheck-btn possibly-ai possibly-ai-escalate';
            btn.textContent = `🤔 Inconclusive (${score}%) - Deep Scan?`;
            btn.dataset.mode = 'DEEP'; // Allow user to click again to trigger deep scan
          } else {
            const suffix = mode === 'LOCAL' ? '(Local)' : '(Deep)';
            switch(response.label) {
              case 'Not AI':
                btn.className = 'aicheck-btn not-ai';
                btn.textContent = `✅ Not AI ${suffix}`;
                break;
              case 'Possibly AI':
                btn.className = 'aicheck-btn possibly-ai';
                btn.textContent = `🤔 Possibly AI (${score}%) ${suffix}`;
                break;
              case 'Likely AI':
                btn.className = 'aicheck-btn likely-ai';
                btn.textContent = `🚨 Likely AI (${score}%) ${suffix}`;
                break;
              case 'Surely AI':
                btn.className = 'aicheck-btn surely-ai';
                btn.textContent = `⚠️ Surely AI (${score}%) ${suffix}`;
                break;
              default:
                btn.className = 'aicheck-btn';
                btn.textContent = mode === 'LOCAL' ? 'Local Check' : 'Deep Check 🔍';
            }
          }
        }
        updateContainerPosition(container, img);
      }
    );
}

// Attach click listener to document so we catch clicks on dynamically created buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('aicheck-btn')) {
        e.preventDefault();
        e.stopPropagation();
        
        const container = e.target.closest('.aicheck-container');
        if (!container) return;
        
        // Find which image this container belongs to
        let targetImg = null;
        if (container === hoverContainer) {
            targetImg = activeHoverImage;
        } else {
            for (const [img, cont] of pinnedContainers.entries()) {
                if (cont === container) {
                    targetImg = img;
                    break;
                }
            }
        }
        
        if (targetImg) {
            handleButtonClick(e.target, targetImg, container);
        }
    }
});
