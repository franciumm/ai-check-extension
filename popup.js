// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const licenseInput = document.getElementById('license-key');
    const saveBtn = document.getElementById('save-license');

    // Load existing license
    chrome.runtime.sendMessage({ type: 'GET_LICENSE' }, (res) => {
        if (res && res.licenseKey) {
            licenseInput.value = res.licenseKey;
            saveBtn.textContent = 'License Saved ✓';
            saveBtn.style.background = '#059669';
        }
    });

    // Save license
    saveBtn.addEventListener('click', () => {
        const key = licenseInput.value.trim();
        chrome.runtime.sendMessage({ type: 'SET_LICENSE', licenseKey: key }, () => {
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = '#059669';
            setTimeout(() => {
                saveBtn.textContent = 'Save License';
                saveBtn.style.background = '#3b82f6';
            }, 2000);
        });
    });
});
