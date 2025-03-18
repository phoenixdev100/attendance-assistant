// Track added elements for cleanup
let addedElements = [];
let isProcessing = false; // Prevent multiple simultaneous calculations

// Check initial state
chrome.storage.local.get(['isEnabled', 'requiredAttendance'], function (result) {
    if (result.isEnabled) {
        runAttendanceScript();
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'toggleAttendance') {
        // Prevent multiple simultaneous operations
        if (isProcessing) {
            sendResponse({ status: 'busy' });
            return true;
        }

        isProcessing = true;
        
        try {
            // Always remove existing data first
            removeAttendanceData();
            
            // Then add new data if enabled
            if (message.isEnabled) {
                runAttendanceScript();
            }
            
            sendResponse({ status: 'success' });
        } catch (error) {
            console.error('Error in toggle handling:', error);
            sendResponse({ status: 'error', message: error.message });
        } finally {
            isProcessing = false;
        }
    }
    return true; // Keep the message channel open for sendResponse
});

function removeAttendanceData() {
    // Remove previously added elements
    addedElements.forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    addedElements = [];
}

function runAttendanceScript() {
    chrome.storage.local.get(['requiredAttendance'], function(result) {
        const requiredPercentage = result.requiredAttendance || 75;
        
        const tableBody = document.querySelector("#table1 tbody");
        if (!tableBody) {
            console.error("Attendance table not found!");
            return;
        }

        // Create headers once
        addHeadersIfNeeded();

        // Process rows in chunks to prevent UI freezing
        const rows = Array.from(tableBody.querySelectorAll("tr"));
        processRowsInChunks(rows, requiredPercentage);
    });
}

function addHeadersIfNeeded() {
    const headerRow = document.querySelector("#table1 thead tr:nth-of-type(2)");
    if (!headerRow || headerRow.querySelector(".canSkipHeader")) return;

    const headers = [
        { text: "Can Skip", class: "canSkipHeader" },
        { text: "Need to Attend", class: "attendHeader" }
    ];

    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header.text;
        th.classList.add(header.class);
        headerRow.appendChild(th);
        addedElements.push(th);
    });
}

function processRowsInChunks(rows, requiredPercentage, chunkSize = 10) {
    let currentIndex = 0;

    function processNextChunk() {
        const chunk = rows.slice(currentIndex, currentIndex + chunkSize);
        if (chunk.length === 0) return;

        chunk.forEach(row => processRow(row, requiredPercentage));
        currentIndex += chunkSize;

        if (currentIndex < rows.length) {
            // Schedule next chunk with a small delay to prevent UI freezing
            setTimeout(processNextChunk, 0);
        }
    }

    processNextChunk();
}

function processRow(row, requiredPercentage) {
    const cols = row.querySelectorAll("td");
    if (cols.length < 9) return;

    // Remove existing cells
    row.querySelector(".skip-cell")?.remove();
    row.querySelector(".attend-cell")?.remove();

    // Parse attendance data
    const delivered = parseInt(cols[6].innerText.trim(), 10) || 0;
    const attended = parseInt(cols[7].innerText.trim(), 10) || 0;

    if (delivered === 0) return; // Skip invalid data

    const { canSkip, needToAttend } = calculateAttendance(attended, delivered, requiredPercentage);

    // Add new cells
    addCell(row, canSkip, "skip-cell", "green");
    addCell(row, needToAttend, "attend-cell", "red");
}

function calculateAttendance(attended, delivered, requiredPercentage) {
    // Convert to numbers and handle decimals properly
    attended = Number(attended);
    delivered = Number(delivered);
    requiredPercentage = Number(requiredPercentage);
    
    const currentPercentage = (attended / delivered) * 100;
    let canSkip = 0;
    let needToAttend = 0;

    if (currentPercentage >= requiredPercentage) {
        // Calculate how many classes can be skipped
        let tempDelivered = delivered;
        while (((attended / (tempDelivered + 1)) * 100) >= requiredPercentage) {
            tempDelivered++;
            canSkip++;
            if (canSkip > 100) break; // Safety limit
        }
    } else {
        // Calculate minimum classes needed to reach required percentage
        // Formula: (attended + x) / (delivered + x) = required/100
        // where x is the number of classes needed to attend
        
        // Solve for x: x = (required * delivered - 100 * attended) / (100 - required)
        const x = Math.ceil((requiredPercentage * delivered - 100 * attended) / (100 - requiredPercentage));
        needToAttend = Math.max(0, x); // Ensure we don't get negative values
        
        // Verify the calculation
        const finalPercentage = ((attended + needToAttend) / (delivered + needToAttend)) * 100;
        
        // Add one more class if we're still slightly below the required percentage
        if (finalPercentage < requiredPercentage) {
            needToAttend++;
        }
        
        // Safety limit
        if (needToAttend > 100) {
            needToAttend = 100;
        }
    }

    return { canSkip, needToAttend };
}

function addCell(row, value, className, color) {
    const cell = document.createElement("td");
    cell.classList.add(className);
    cell.textContent = value || "-";
    cell.style.color = color;
    
    // Add title attribute to show percentage after attending/skipping these classes
    const cols = row.querySelectorAll("td");
    const delivered = Number(cols[6].innerText.trim()) || 0;
    const attended = Number(cols[7].innerText.trim()) || 0;
    
    if (className === "skip-cell" && value > 0) {
        const futurePercentage = (attended / (delivered + value)) * 100;
        cell.title = `After skipping: ${futurePercentage.toFixed(2)}%`;
    } else if (className === "attend-cell" && value > 0) {
        const futurePercentage = ((attended + value) / (delivered + value)) * 100;
        cell.title = `After attending: ${futurePercentage.toFixed(2)}%`;
    }
    
    row.appendChild(cell);
    addedElements.push(cell);
}
