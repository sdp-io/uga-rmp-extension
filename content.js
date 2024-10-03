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
        console.log("Sending professor name:", professorName); // TODO: Consider removing
        port.postMessage({professorName: professorName});

        /**
         * Event listener for messages from the service worker.
         * Resolves or rejects the Promise based on the received message.
         *
         * @param msg - The message received from the service worker.
         */
        function messageListener(msg) {
            if (msg.professorMetrics) {
                console.log(`Data for professor ${professorName} received. Metric.avgRating is: ${msg.professorMetrics.avgRating}`); // TODO: Consider removing
                port.onMessage.removeListener(messageListener);
                resolve({name: professorName, metrics: msg.professorMetrics});
            } else {
                console.log(`Error receiving metrics for professor ${professorName} from service worker.`); // TODO: Consider removing/improving error handling
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
 * @param {Array<HTMLElement>} tables - An array of table elements (<td>) representing professor names.
 * @returns {Promise<void>} A promise that resolves when all professors have been processed.
 */
async function processProfessorTables(tables) {
    for (const element of tables) {
        const professorName = element.textContent;
        if (professorName.length > 0 && !profMap.has(professorName)) {
            try {
                const metrics = await getProfessorMetrics(professorName);
                profMap.set(professorName, metrics);
                console.log(`Updated metrics for ${professorName}:`, metrics); // TODO: Consider removing
            } catch (error) {
                console.error(`Failed to get metrics for professor ${professorName}:`, error);
                profMap.set(professorName, null); // Store null to indicate failure
            }
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

    // Filter out professors that already exist in profMap
    const newTables = Array.from(tables).filter(table => !profMap.has(table.textContent.trim()));

    if (newTables.length > 0) {
        console.log("New professor tables detected, processing..."); // TODO: Consider removing
        await processProfessorTables(newTables);
        console.log("Updated global professor map:", profMap); // TODO: Consider removing
    }

    // TODO: Use profMap here to update the displayed professor information.
}

/**
 * Initializes the extension by setting up the MutationObserver.
 */
function initializeExtension() {
    console.log("Initializing extension..."); // TODO: Consider removing

    // Set up the MutationObserver to observe changes in the document body
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true });
}

// Run the initialization when the content script loads
initializeExtension();