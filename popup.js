document.getElementById("modifyTitle").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        const tab = tabs[0];

        // If it's any tab, inject the script
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const resetSentimentDisplay = () => {
        document.getElementById('neutral-comments').textContent = "Neutral Comments: 0 (Score: 0.00)";
        document.getElementById('negative-comments').textContent = "Negative Comments: 0 (Score: 0.00)";
        document.getElementById('positive-comments').textContent = "Positive Comments: 0 (Score: 0.00)";
        document.getElementById('total-sentiment').textContent = "Total Sentiment Score: 0.00";
    };

    const updateSentimentDisplay = () => {
        chrome.storage.local.get(['sentimentData', 'totalSentiment'], (result) => {
            if (result.sentimentData && result.totalSentiment !== undefined) {
                const sentimentData = result.sentimentData;
                const totalSentiment = result.totalSentiment;

                document.getElementById('neutral-comments').textContent = `Neutral Comments: ${sentimentData[0][1]} (Score: ${sentimentData[0][0].toFixed(2)})`;
                document.getElementById('negative-comments').textContent = `Negative Comments: ${sentimentData[1][1]} (Score: ${sentimentData[1][0].toFixed(2)})`;
                document.getElementById('positive-comments').textContent = `Positive Comments: ${sentimentData[2][1]} (Score: ${sentimentData[2][0].toFixed(2)})`;
                document.getElementById('total-sentiment').textContent = `Total Sentiment Score: ${totalSentiment.toFixed(2)}`;
            } else {
                resetSentimentDisplay();
            }
        });
    };

    // Reset display when popup loads
    resetSentimentDisplay();

    // Update display with stored data
    updateSentimentDisplay();

    // Listen for changes in any tab (any page opened or switched)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            console.log("New page detected! Resetting sentiment data...");

            // Reset sentiment data in local storage
            chrome.storage.local.set({
                sentimentData: [
                    [0, 0],
                    [0, 0],
                    [0, 0]
                ],
                totalSentiment: 0
            });

            // Reset sentiment display
            resetSentimentDisplay();
        }
    });
});
