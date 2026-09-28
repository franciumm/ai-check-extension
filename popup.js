// popup.js

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ type: 'GET_USAGE' }, (response) => {
    if (response) {
      const { used, limit } = response;
      
      const usageCountEl = document.getElementById('usage-count');
      const progressFillEl = document.getElementById('progress-fill');
      
      usageCountEl.textContent = `${used} / ${limit}`;
      
      const percentage = Math.min((used / limit) * 100, 100);
      progressFillEl.style.width = `${percentage}%`;
      
      if (percentage >= 100) {
        progressFillEl.style.backgroundColor = '#f44336'; // Red when limit reached
      } else if (percentage >= 66) {
        progressFillEl.style.backgroundColor = '#ff9800'; // Orange when close to limit
      }
    }
  });
});
