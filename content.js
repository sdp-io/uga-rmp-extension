/**
 * The maximum number of attempts to reconnect to the background script
 * before giving up and refreshing the page.
 */
const MAX_RETRIES = 3;

// Regex to extract the primary professor's name (used in normalizeProfessorName)
const PRIMARY_PROFESSOR_REGEX = /([\w-]+)\s+(?:[A-Z]\.\s+)?([\w-]+)\s*\(Primary\)/;

// Establish a long-lived connection with the service worker
let port = chrome.runtime.connect({name: "professorMetrics"});

// Store processed professor names as keys and their metrics as values
const profMap = new Map();

let observer;

/**
 * Retrieves professor metrics from the background service worker.
 *
 * @param {string} professorName - The name of the professor to retrieve metrics for.
 * @returns {Promise<Object>}  A Promise that resolves with an object containing the professor's name and metrics
 *                             or rejects with an Error if the retrieval fails. The resolved object has the form:
 *                             { name: professorName, metrics: { ... metrics data ... } }
 */
async function getProfessorMetrics(professorName) {
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
 * Normalizes a professor's name from the format used on the registration page.
 * This function assumes the name is in the format "FirstName LastName (Primary)"
 * or similar variations (e.g., with middle initials, hyphens, or assisting professor names).
 *
 * @param {string} name - The professor's name to normalize.
 * @return {string} The normalized professor name in the format "FirstName LastName",
 *                  or the original name if the input format is not recognized.
 */
function normalizeProfessorName(name) {
    const match = name.match(PRIMARY_PROFESSOR_REGEX);
    return match ? `${match[1]} ${match[2]}` : name;
}

/**
 * Processes an array of table elements containing professor names.
 * retrieves metrics for each professor, and updates the `profMap`.
 *
 * @param {NodeListOf<Element>} tables - An array of table elements (<td>) representing professor names.
 * @param {number} retryCount - The current retry attempt count (used internally for reconnections).
 * @returns {Promise<void>} A promise that resolves when all professors have been processed.
 */
async function processProfessorTables(tables, retryCount = 0) {
    for (const element of tables) {
        let professorName = element.textContent.trim();

        // Check for empty table cells BEFORE normalization
        if (professorName.length === 0) {
            continue; // Skip to the next iteration if professor name is blank
        }

        // Normalize the professor's name
        professorName = normalizeProfessorName(professorName);

        // Check if the normalized name has already been processed
        if (profMap.has(professorName)) {
            continue; // Skip to the next iteration
        }

        try {
            const metrics = await getProfessorMetrics(professorName);
            profMap.set(professorName, metrics);
        } catch (error) {
            if (error.message.includes('Extension context invalidated.')) {
                window.location.reload(); // Refresh the current tab to re-inject the content script
                return; // Exit the function early as further processing will fail
            }

            if (error.message.includes('Attempting to use a disconnected port object')) {
                // The connection to the background script has been lost
                if (retryCount >= MAX_RETRIES) {
                    console.error(`Max retries (${MAX_RETRIES}) exceeded. Refreshing page.`);
                    window.location.reload();
                    return;
                }
                // Attempt to reconnect to the background script and retry processing the professor tables
                port = chrome.runtime.connect({name: "professorMetrics"});
                return await processProfessorTables(tables, retryCount + 1);
            }

            profMap.set(professorName, null); // Store null to indicate failure
        }
    }
}

/**
 * Creates a span element with the given text content.
 *
 * @param {string} text - The text content for the span.
 * @return {HTMLSpanElement} The created span element.
 */

function createSpan(text) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

/**
 * Creates a DOM element to display professor ratings.
 *
 * @param {Object} metrics - The professor's rating metrics.
 * @param {number} metrics.avgRating - The average overall rating (e.g., 4.5).
 * @param {number} metrics.avgDifficulty - The average difficulty rating (e.g., 3.2).
 * @param {number} metrics.numRatings - The total number of ratings.
 * @param {number} metrics.wouldTakeAgainPercent - The percentage of students who would take the course again (0-100).
 * @param {string} metrics.RMPLink - The link to the professor's RateMyProfessor page.
 * @returns {HTMLDivElement} The created DOM element.
 */
function createRatingElement(metrics) {
    const ratingDiv = document.createElement('div');

    // Handle cases where the professor page does not exist
    if (metrics === null) {
        ratingDiv.appendChild(createSpan("No page found."));
        return ratingDiv; // Return early if no metrics found
    }

    // Create and append overall rating, difficulty, and total ratings
    const ratingInfo = [
        `Overall: ${metrics.avgRating} / 5`,
        `Difficulty: ${metrics.avgDifficulty} / 5`,
        `Total Ratings: ${metrics.numRatings}`
    ];

    ratingInfo.forEach(info => {
        ratingDiv.appendChild(createSpan(info))
        ratingDiv.appendChild(document.createElement('br'));
    });

    // Handle cases where no ratings exist or append "would take again" percentage
    if (metrics.wouldTakeAgainPercent === -1) {
        ratingDiv.appendChild(createSpan("No ratings available yet."));
    } else {
        const roundedPercentage = Math.round(metrics.wouldTakeAgainPercent);
        ratingDiv.appendChild(createSpan(`Would take again: ${roundedPercentage}%`));
    }

    ratingDiv.appendChild(document.createElement('br'));

    // Create and append link to the professor's RateMyProfessor page
    const RMPLinkAnchor = document.createElement('a');
    RMPLinkAnchor.href = metrics.RMPLink;
    RMPLinkAnchor.textContent = "View on RMP »";
    RMPLinkAnchor.target = "_blank";
    ratingDiv.appendChild(RMPLinkAnchor);

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
        const professorName = normalizeProfessorName(cell.textContent.trim());

        // Remove any existing rating div elements from the cell to prevent duplicates
        const existingRatings = cell.querySelector('div');
        if (existingRatings) {
            existingRatings.remove();
        }

        if (!professorName) { // Skip empty cells
            continue;
        }

        const metrics = profMap.get(professorName);
        const ratingElement = createRatingElement(metrics);
        insertRating(cell, ratingElement);
    }
}

/**
 * Callback function for the MutationObserver.
 * Detects changes in the DOM and processes new professor table elements.
 */
async function handleMutations() {
    const tables = document.querySelectorAll('td[data-property="instructor"]');

    if (tables.length > 0) {
        await processProfessorTables(tables);
        await updateProfessorRatings(); // Insert professor ratings into the DOM after processing new tables
    }
}

/**
 * Initializes the extension by setting up the MutationObserver.
 */
function initializeExtension() {
    // Set up the MutationObserver to observe changes in the document body
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true });
}

// Run the initialization when the content script loads
initializeExtension();