// Track added elements for cleanup
let addedElements = [];

// Check initial state
chrome.storage.local.get(['isEnabled'], function (result) {
    if (result.isEnabled) {
        runAttendanceScript();
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'toggleAttendance') {
        if (message.isEnabled) {
            runAttendanceScript();
        } else {
            removeAttendanceData();
        }
    }
});

function removeAttendanceData() {
    // Remove previously added elements
    addedElements.forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    // Clear the tracking array
    addedElements = [];
}

function runAttendanceScript() {
    console.log("Attendance script running...");

    let tableBody = document.querySelector("#table1 tbody");
    if (!tableBody) {
        console.error("Attendance table not found!");
        return;
    }

    let tableRows = tableBody.querySelectorAll("tr");

    // Add headers
    let headerRow = document.querySelector("#table1 thead tr:nth-of-type(2)");
    if (headerRow && !headerRow.querySelector(".canSkipHeader")) {
        let skipHeader = document.createElement("th");
        skipHeader.textContent = "Can Skip";
        skipHeader.classList.add("canSkipHeader");
        headerRow.appendChild(skipHeader);
        addedElements.push(skipHeader);

        let attendHeader = document.createElement("th");
        attendHeader.textContent = "Need to Attend";
        attendHeader.classList.add("attendHeader");
        headerRow.appendChild(attendHeader);
        addedElements.push(attendHeader);
    }

    tableRows.forEach((row) => {
        let cols = row.querySelectorAll("td");
        if (cols.length < 9) return;

        // Remove any previously added cells
        let existingSkipCell = row.querySelector(".skip-cell");
        let existingAttendCell = row.querySelector(".attend-cell");
        if (existingSkipCell) existingSkipCell.remove();
        if (existingAttendCell) existingAttendCell.remove();

        let delivered = parseInt(cols[6].innerText.trim(), 10);
        let attended = parseInt(cols[7].innerText.trim(), 10);

        let percentage = (attended / delivered) * 100;
        let extraLecturesToSkip = 0;
        let extraLecturesToAttend = 0;

        let tempDelivered = delivered;
        let tempAttended = attended;

        if (percentage >= 75) {
            while (((tempAttended / (tempDelivered + 1)) * 100) >= 75) {
                tempDelivered++;
                extraLecturesToSkip++;
            }
        } else {
            while ((tempAttended / tempDelivered) * 100 < 75) {
                tempAttended++;
                tempDelivered++;
                extraLecturesToAttend++;
            }
        }

        let skipCell = document.createElement("td");
        skipCell.classList.add("skip-cell");
        skipCell.textContent = extraLecturesToSkip || "-";
        skipCell.style.color = "green";
        row.appendChild(skipCell);
        addedElements.push(skipCell);

        let attendCell = document.createElement("td");
        attendCell.classList.add("attend-cell");
        attendCell.textContent = extraLecturesToAttend || "-";
        attendCell.style.color = "red";
        row.appendChild(attendCell);
        addedElements.push(attendCell);
    });

    console.log("Attendance data updated successfully!");
}
