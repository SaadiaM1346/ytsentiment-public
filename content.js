async function updateSentiment() {
    // Assuming oversallSentiment is a promise
    let resolvedSentiment = await oversallSentiment;

    // Check if resolvedSentiment is a valid number
    if (!isNaN(resolvedSentiment)) {
        button.innerText = parseFloat(resolvedSentiment.toFixed(1)); // Convert to number
    } else {
        console.error("oversallSentiment is not a valid number:", resolvedSentiment);
        button.innerText = "Invalid Sentiment"; // Fallback text
    }
}

function toggleSentimentButton() {
    let videoTitleElement = document.querySelector("yt-formatted-string.style-scope.ytd-watch-metadata");
    if (!videoTitleElement) return;

    let existingButton = document.querySelector(".sentiment-button");

    if (existingButton) {
        existingButton.remove();
    } else {
        let button = document.createElement("button");
        button.innerText = "Get Sentiment";
        button.classList.add("sentiment-button");

        button.classList.add("yt-spec-button-shape-next", 
                             "yt-spec-button-shape-next--tonal", 
                             "yt-spec-button-shape-next--mono", 
                             "yt-spec-button-shape-next--size-m");

        button.style.display = "inline";
        button.style.width = "auto";
        button.style.verticalAlign = "middle";
        button.style.marginLeft = "10px";
        videoTitleElement.parentNode.insertBefore(button, videoTitleElement.nextSibling);

        button.addEventListener('click', async function() {
            let videoId = window.location.href.split('v=')[1].split('&')[0];
            let lines = await getYouTubeComments(videoId, 10000);
            let vader = makeVaderStruct();
            let overallSentiment = sentenceScoring(lines, vader);

            overallSentiment.then(resolvedSentiment => {
                if (!isNaN(resolvedSentiment)) {
                    button.innerText = parseFloat(resolvedSentiment.toFixed(1));
                } else {
                    console.error("overallSentiment is not a valid number:", resolvedSentiment);
                    button.innerText = "Invalid Sentiment";
                }
            });
        });
    }
}

// Function to get all YouTube comments efficiently
async function getYouTubeComments(videoId, maxComments = 10000) {
    const apiKey = 'YOUR_YOUTUBE_API_KEY';  // Replace this with your actual API key
    let apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${apiKey}`;
    
    let commentsArray = [];
    let nextPageToken = '';

    try {
        while (commentsArray.length < maxComments) {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!data.items) {
                console.log('No comments found.');
                break;
            }

            // Extract and format comments
            data.items.forEach(comment => {
                if (commentsArray.length < maxComments) {
                    let commentText = comment.snippet.topLevelComment.snippet.textDisplay;
                    commentText = commentText.replace(/\n/g, ' '); // Replace newlines inside comments with spaces
                    commentsArray.push(commentText);
                }
            });

            // Check if there's another page of comments
            nextPageToken = data.nextPageToken;
            if (!nextPageToken || commentsArray.length >= maxComments) break;

            apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${nextPageToken}&key=${apiKey}`;
        }

        console.log(`Retrieved ${commentsArray.length} comments.`);

        return commentsArray; // pass to the sentiment analysis function

    } catch (error) {
        console.error('Error fetching comments:', error);
        return ''; // Return empty string in case of an error
    }
}

async function makeVaderStruct() {
    let fileContent;

    try {
        const response = await fetch(chrome.runtime.getURL('vader_lexicon.txt'));  // Use fetch to get the lexicon file
        if (!response.ok) throw new Error('Failed to load lexicon file');
        fileContent = await response.text();
    } catch (err) {
        console.error("Error fetching the lexicon file:", err);
        return null;  // Return null if there's an error fetching the lexicon
    }

    const lines = fileContent.split('\n');
    const vaderWords = [];

    lines.forEach((line, index) => {
        const regex = /^([^\t]+)\t+([-?\d.]+)\s+([-?\d.]+)\s+\[([\d,\s-]+)\]$/;
        const match = line.match(regex);

        if (match) {
            const w = match[1];
            const s = parseFloat(match[2]);
            vaderWords.push({ word: w, score: s});
        } else {
            console.error(`Incorrect format on line ${index + 1}: ${line}`);
        }
    });
    return vaderWords;
}

// Call the function to toggle the sentiment button
toggleSentimentButton();

// Function to check if words with spaces appear in the sentence
function hasSpaceWords(vaderWords, sentence, totalScore, numWords) {
    let tempSentence = sentence.toLowerCase(); // Convert sentence to lowercase

    for (let i = 0; i < vaderWords.length; i++) {
        let word = vaderWords[i].word;
        let score = vaderWords[i].score;

        if (word.includes(" ")) { // Check if the word contains a space
            if (sentence.includes(word)) {
                numWords++;
                totalScore += score;
                sentence = sentence.replace(word, ' '.repeat(word.length));
            } else if (tempSentence.includes(word)) {
                numWords++;
                totalScore += score < 0 ? score - 1 : score + 1;
                let index = tempSentence.indexOf(word);
                tempSentence = tempSentence.replace(word, ' '.repeat(word.length));
                sentence = sentence.substring(0, index) + ' '.repeat(word.length) + sentence.substring(index + word.length);
            }
        }
    }
    return { updatedSentence: sentence, updatedTotalScore: totalScore, updatedNumWords: numWords };
}

function decodeHtmlEntities(str) {
    var doc = new DOMParser().parseFromString(str, "text/html");
    return doc.documentElement.textContent;
}

function ispunct(char) {
    const punctuation = "!\"#$%&()*+,-./:;<=>?@[\\]^_`{|}~";
    return punctuation.includes(char);
}
// Function to remove the punctuation of a token
// Keeps track of number of exclamation marks if present
function removePunct(token, numExclamation) {
    // Set number of excalmation points to zero
    numExclamation = 0; 

    // Loop through every character in token
    for (i = 0; i < token.length; i++) {
        // Check if character is an exclamation point
        if (token[i]=='!') {
            numExclamation += 1; // Increase by 1 if character is an exclamation point
        }

        // Check is character is punctuation
        if (ispunct(token[i])) { 
            token = token.replace(token[i], ""); // Removes it from string
            i--;
        }
    }    

    return token;
}

// Background script (background.js)

async function sentenceScoring(validationLines, vaderWordsPromise) {
    let sentimentData = [[0,0],[0,0],[0,0]];
    let totalSentiment = 0;

    let vaderWords;
    try {
        vaderWords = await vaderWordsPromise; // Wait for the promise to resolve
    } catch (error) {
        console.error("Error resolving vaderWords:", error);
        return 0;
    }

    const vaderWordsMap = {};
    vaderWords.forEach(entry => {
        vaderWordsMap[entry.word.toLowerCase()] = entry.score;
    });

    if (!Array.isArray(validationLines)) {
        console.error("Error: validationLines is not an array", validationLines);
        return 0;
    }

    let totalScore = 0;
    let numSentences = 0;

    validationLines.forEach(sentence => {
        if (typeof sentence !== "string") return; // Ensure it's a string
        sentence = sentence.trim(); // Remove extra spaces

        if (sentence === "" || sentence.split('').every(char => char === ' ')) return;

        let tokenScore = 0;
        let numWords = 0;
        let processedSentence = sentence;

        let { updatedSentence, updatedTotalScore, updatedNumWords } = hasSpaceWords(vaderWords, processedSentence, tokenScore, numWords);
        processedSentence = updatedSentence;
        tokenScore = updatedTotalScore;
        numWords = updatedNumWords;

        let tokens = processedSentence.split(" ").filter(token => token !== "");
        tokens.forEach(token => {
            token = decodeHtmlEntities(token);

            let numExclamation = (token.match(/!/g) || []).length;
            let tempToken = removePunct(token, numExclamation); 

            const score = vaderWordsMap[tempToken.toLowerCase()];
            if (score !== undefined) {
                tokenScore += score;
                tokenScore += score < 0 ? -0.1 * numExclamation : 0.1 * numExclamation;
            }

            numWords++;
        });

        if (numWords > 0) tokenScore /= numWords; // Average score for this sentence
        totalScore += tokenScore;
        numSentences++;

        // Track the sentiment for each comment
        if (tokenScore < -0.1) {
            sentimentData[1][0] += tokenScore;  // Negative
            sentimentData[1][1] += 1;  // Negative count
        } else if (tokenScore > 0.1) {
            sentimentData[2][0] += tokenScore;  // Positive
            sentimentData[2][1] += 1;  // Positive count
        } else {
            sentimentData[0][0] += tokenScore;  // Neutral
            sentimentData[0][1] += 1;  // Neutral count
        }
    });

    totalSentiment = totalScore; // Update the total sentiment score
    
       // Store the sentiment data in chrome storage
    chrome.storage.local.set({
        sentimentData: sentimentData,
        totalSentiment: totalSentiment
    });

    return totalScore;
}

