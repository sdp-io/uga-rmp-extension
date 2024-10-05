// Establish a long-lived connection with the service worker
const port = chrome.runtime.connect({name: "professorMetrics"});

// Store processed professor names as keys and their metrics as values.
const profMap = new Map();

/**
 * Retrieves professor metrics from the background service worker.
 *
 * @param {string} professorName - The name of the professor to retrieve metrics for.
 * @returns {Promise<Object>}  A Promise that resolves with an object containing the professor's name and metrics
 *                             or rejects with an Error if the retrieval fails. The resolved object has the form:
 *                             { name: professorName, metrics: { ... metrics data ... } }
 */
function getProfessorMetrics(professorName) {
    return new Promise((resolve, reject) => {
        port.postMessage({professorName: professorName});

        /**
         * Event listener for messages from the service worker.
         * Resolves or rejects the Promise based on the received message.
         *
         * @param msg - The message received from the service worker.
         */
        function messageListener(msg) {
            if (msg.professorMetrics) {
                port.onMessage.removeListener(messageListener);
                resolve(msg.professorMetrics);
            } else {
                port.onMessage.removeListener(messageListener);
                reject(new Error(`Failed to get metrics for professor ${professorName}`));
            }
        }

        port.onMessage.addListener(messageListener);
    });
}

/**
 * Processes an array of table elements containing professor names.
 * retrieves metrics for each professor, and updates the `profMap`.
 *
 * @param {NodeListOf<Element>} tables - An array of table elements (<td>) representing professor names.
 * @returns {Promise<void>} A promise that resolves when all professors have been processed.
 */
async function processProfessorTables(tables) {
    for (const element of tables) {
        const professorName = element.textContent.trim();
        if (professorName.length > 0 && !profMap.has(professorName)) {
            try {
                const metrics = await getProfessorMetrics(professorName);
                profMap.set(professorName, metrics);
            } catch (error) {
                console.error(`processProfessorTables -> Failed to get metrics for professor ${professorName}:`, error);
                profMap.set(professorName, null); // Store null to indicate failure
            }
        }
    }
}

/**
 * Creates a DOM element to display professor ratings.
 *
 * @param {Object} metrics - The professor's rating metrics.
 * @param {number} metrics.avgRating - The average overall rating (e.g., 4.5).
 * @param {number} metrics.avgDifficulty - The average difficulty rating (e.g., 3.2).
 * @param {number} metrics.numRatings - The total number of ratings.
 * @param {number} metrics.wouldTakeAgainPercent - The percentage of students who would take the course again (0-100).
 * @returns {HTMLDivElement} The created DOM element.
 */
function createRatingElement(metrics) {
    const ratingDiv = document.createElement('div');

    // Create and append overall rating
    const overallSpan = document.createElement('span');
    overallSpan.textContent = "Overall: " + metrics.avgRating + " / 5";
    ratingDiv.appendChild(overallSpan);
    ratingDiv.appendChild(document.createElement('br'));

    // Create and append difficulty rating
    const difficultySpan = document.createElement('span');
    difficultySpan.textContent = "Difficulty: " + metrics.avgDifficulty + " / 5";
    ratingDiv.appendChild(difficultySpan);
    ratingDiv.appendChild(document.createElement('br'));

    // Create and append total number of ratings
    const numRatingsSpan = document.createElement('span');
    numRatingsSpan.textContent = "Total Ratings: " + metrics.numRatings;
    ratingDiv.appendChild(numRatingsSpan);
    ratingDiv.appendChild(document.createElement('br'));

    // Create and append "would take again" percentage
    const wouldTakeAgainSpan = document.createElement('span');
    const roundedPercentage = Math.round(metrics.wouldTakeAgainPercent);
    wouldTakeAgainSpan.textContent = "Would Take Again: " + roundedPercentage + "%";
    ratingDiv.appendChild(wouldTakeAgainSpan);

    return ratingDiv;
}

/**
 * Inserts the rating element into the correct table cell.
 *
 * @param {HTMLTableCellElement} professorCell - The name of the professor.
 * @param {HTMLDivElement} ratingElement - The element containing the formatted rating.
 */
function insertRating(professorCell, ratingElement) {
    professorCell.append(ratingElement);
}

/**
 * Updates the displayed professor ratings based on the profMap.
 */
async function updateProfessorRatings() {
    const professorCells = document.querySelectorAll('td[data-property="instructor"]');

    for (const cell of professorCells) {
        const professorName = cell.textContent.trim(); // TODO: Maybe could do without trimming?
        const metrics = profMap.get(professorName);

        if (metrics) {
            const ratingElement = createRatingElement(metrics);
            insertRating(cell, ratingElement);
        }
    }
}

/**
 * Callback function for the MutationObserver.
 * Detects changes in the DOM and processes new professor table elements.
 *
 * @param mutations - An array of MutationRecord objects describing the changes.
 * @param observer - The MutationObserver instance.
 */
async function handleMutations(mutations, observer) {
    const tables = document.querySelectorAll('td[data-property="instructor"]');

    if (tables.length > 0) {
        await processProfessorTables(tables);
        await updateProfessorRatings(); // Insert professor ratings into the DOM after processing new tables
    }

    // TODO: Use profMap here to update the displayed professor information.
}

/**
 * Initializes the extension by setting up the MutationObserver.
 */
function initializeExtension() {
    // Set up the MutationObserver to observe changes in the document body
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true });
}

// Run the initialization when the content script loads
initializeExtension();