document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('attendanceToggle');
    const statusText = document.getElementById('statusText');
    const customAttendance = document.getElementById('customAttendance');
    const saveAttendance = document.getElementById('saveAttendance');

    // Initialize the toggle state
    chrome.storage.local.get(['isEnabled', 'requiredAttendance'], (result) => {
        toggle.checked = result.isEnabled || false;
        updateStatusText(toggle.checked);
        
        if (result.requiredAttendance) {
            customAttendance.value = result.requiredAttendance;
        }
    });

    // Handle toggle changes
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ isEnabled }, () => {
            updateStatusText(isEnabled);
            
            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleAttendance',
                        isEnabled: isEnabled
                    });
                }
            });
        });
    });

    // Handle save attendance button
    saveAttendance.addEventListener('click', () => {
        const attendanceValue = customAttendance.value ? parseInt(customAttendance.value) : 75;
        
        if (attendanceValue < 1 || attendanceValue > 100) {
            alert('Please enter a valid attendance percentage between 1 and 100');
            return;
        }

        chrome.storage.local.set({ requiredAttendance: attendanceValue }, () => {
            // If extension is enabled, update the display
            if (toggle.checked) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'toggleAttendance',
                            isEnabled: true
                        });
                    }
                });
            }
            // alert('Attendance requirement updated successfully!');
        });
    });

    function updateStatusText(isEnabled) {
        statusText.textContent = isEnabled ? 'Active' : 'Inactive';
        statusText.className = `status-text ${isEnabled ? 'status-active' : 'status-inactive'}`;
    }
});
