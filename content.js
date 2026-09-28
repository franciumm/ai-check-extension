// content.js

// Keep track of processing to debounce MutationObserver
let processTimeout = null;

// Function to process a single image
function processImage(img) {
  // Skip if already processed
  if (img.dataset.aicheck) return;
  
  // Skip small images
  if (img.naturalWidth < 100 || img.naturalHeight < 100) {
    // If not loaded yet, wait for load
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
  
  // Mark as processed
  img.dataset.aicheck = 'true';
  
  // Ensure wrapper
  let parent = img.parentElement;
  if (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (!['relative', 'absolute', 'fixed'].includes(parentStyle.position)) {
          // Wrap the image to ensure the button can be positioned relative to it
          const wrapper = document.createElement('div');
          wrapper.className = 'aicheck-wrapper';
          wrapper.style.display = window.getComputedStyle(img).display;
          if (wrapper.style.display === 'inline') wrapper.style.display = 'inline-block';
          
          img.parentNode.insertBefore(wrapper, img);
          wrapper.appendChild(img);
          parent = wrapper;
      }
  }

  // Create button
  const btn = document.createElement('button');
  btn.className = 'aicheck-btn';
  btn.textContent = 'Check?';
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple clicks
    if (btn.classList.contains('loading')) return;
    
    btn.textContent = '...';
    btn.className = 'aicheck-btn loading';
    
    chrome.runtime.sendMessage(
      { type: 'CHECK_IMAGE', imageUrl: img.src },
      (response) => {
        if (!response || response.error) {
          btn.className = 'aicheck-btn error';
          btn.textContent = '⚠️ Error';
        } else if (response.status === 'NOT_PAID') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '🔒 Subscribe';
        } else if (response.status === 'FREE_LIMIT') {
          btn.className = 'aicheck-btn locked';
          btn.textContent = '🔒 Limit reached';
        } else {
          // Success case
          const score = Math.round(response.score * 100);
          switch(response.label) {
            case 'Not AI':
              btn.className = 'aicheck-btn not-ai';
              btn.textContent = '✓ Not AI';
              break;
            case 'Possibly AI':
              btn.className = 'aicheck-btn possibly-ai';
              btn.textContent = `⚠ Possibly AI (${score}%)`;
              break;
            case 'Likely AI':
              btn.className = 'aicheck-btn likely-ai';
              btn.textContent = `⚡ Likely AI (${score}%)`;
              break;
            case 'Surely AI':
              btn.className = 'aicheck-btn surely-ai';
              btn.textContent = `🤖 Surely AI (${score}%)`;
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
      parent.style.position = 'relative'; // Ensure it's relative
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
