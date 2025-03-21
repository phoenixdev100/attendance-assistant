document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleButton');
    const statusText = document.getElementById('statusText');

    // Get initial state
    chrome.storage.local.get(['isEnabled'], (result) => {
        const currentState = result.isEnabled || false;
        toggleButton.checked = currentState;
        updateStatusText(currentState);
    });

    // Handle toggle changes
    toggleButton.addEventListener('change', () => {
        const newState = toggleButton.checked;
        
        // Update storage
        chrome.storage.local.set({ isEnabled: newState }, () => {
            updateStatusText(newState);
            
            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleAttendance',
                        isEnabled: newState
                    }).catch(err => {
                        console.log('Tab not ready yet');
                    });
                }
            });
        });
    });

    function updateStatusText(isEnabled) {
        statusText.textContent = isEnabled ? 'Active' : 'Inactive';
        statusText.className = `status-text ${isEnabled ? 'status-active' : 'status-inactive'}`;
    }
});
