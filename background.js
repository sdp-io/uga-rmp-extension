/**
 * Base URL for the Rate My Professors GraphQL API.
 * @type {string}
 */
URL = "https://www.ratemyprofessors.com/graphql"

/**
 * Authentication token for accessing the RMP GraphQL API.
 * This is a publicly known token provided by Rate My Professors for testing and development.
 * @type {string}
 */
AUTH_TOKEN = "dGVzdDp0ZXN0"

/**
 * Base64 encoded school ID for the University of Georgia.
 * @type {string}
 */
SCHOOL_ID = "U2Nob29sLTExMDE="

/**
 * Fetches professor data from the RMP GraphQL API and returns the ID of the first match.
 *
 * @param {string} professorName - The name of the professor to search for.
 * @returns {Promise<string|null>} A promise that resolves with the professor's ID (string) if found,
 *                                 or `null` if no matching professor is found (or if an error occurs.)
 */
async function getProfessorID(professorName) {
    const query = `
    query NewSearchTeachersQuery($name: String!, $schoolID: ID!) {
        newSearch {
          teachers(query: {text: $name, schoolID: $schoolID}) {
            edges {
              cursor
              node {
                id
                firstName
                lastName
                school {
                  name
                  id
                }
              }
            }
          }
        }
      }`; // GraphQL query to fetch professor data

    const variables = {
        name: professorName,
        schoolID: SCHOOL_ID
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${AUTH_TOKEN}`
        },
        body: JSON.stringify({query, variables})
    };

    const [profFirstName, profLastName] = professorName.split(" ");

    // Get the ID of the most relevant professor from the API response
    try {
        const response = await fetch(URL, options);
        const data = await response.json();
        const edges = data?.data?.newSearch?.teachers?.edges;

        if (!edges || edges.length === 0) {
            return null; // No professor found in search results
        }

        const firstNode = edges[0].node;

        // Verify that the first node matches the provided professor name
        if (firstNode.firstName !== profFirstName || firstNode.lastName !== profLastName) {
            return null; // Professor name mismatch
        }

        // Handle cases with multiple search results for the same professor
        if (edges.length >= 2) {
            const secondNode = edges[1].node;

            // Handle cases where a professor has two nodes
            if (firstNode.firstName === secondNode.firstName && firstNode.lastName === secondNode.lastName) {
                // Fetch metrics for both nodes
                const firstMetrics = await getProfessorMetrics(firstNode.id);
                const secondMetrics = await getProfessorMetrics(secondNode.id);

                // Return the ID of the node with more ratings (or the first node if this number is equal)
                if (firstMetrics && secondMetrics) {
                    return firstMetrics.numRatings >= secondMetrics.numRatings ? firstNode.id : secondNode.id;
                }
            }
        }

        // Default: Return the first node's ID (if it passed the name check)
        return firstNode.id;

    } catch (error) {
        console.error("Error fetching professor ID:", error); // TODO: Consider removing/improving error handling
        return null; // Return null to indicate error
    }
}

/**
 * Retrieves detailed metrics for a professor from the RMP GraphQL API.
 *
 * @param {string} professorID - The RMP ID of the professor.
 * @returns {Promise<{Object}|null>} A promise that resolves with an object containing professor metrics
 *                                   or `null` if no professor is found with the given ID (or if an error
 *                                   occurs.) The metrics object has the following structure:
 *                                   {
 *                                      avgDifficulty: number,
 *                                      avgRating: number,
 *                                      numRatings: number,
 *                                      wouldTakeAgainPercent: number
 *                                   }
 */
async function getProfessorMetrics(professorID) {
    const query = `    
    query TeacherRatingsPageQuery($profID: ID!) {
        node(id: $profID) {
          ... on Teacher {
            id
            firstName
            lastName
            school {
              name
              id
              city
              state
            }
            avgDifficulty
            avgRating
            numRatings
            legacyId
            wouldTakeAgainPercent
          }
          id
        }
      }`; // GraphQL query to retrieve professor metrics

    const variables = {
        profID: professorID
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${AUTH_TOKEN}`
        },
        body: JSON.stringify({query, variables})
    };

    try {
        const response = await fetch(URL, options);
        const data = await response.json();
        const node = data?.data?.node;

        if (node) {
            return {
                avgDifficulty: node.avgDifficulty,
                avgRating: node.avgRating,
                numRatings: node.numRatings,
                wouldTakeAgainPercent: node.wouldTakeAgainPercent
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error Fetching Professor Metrics:", error); // TODO: Consider removing/improving error handling
        return null;
    }
}

/**
 * Constructs the Rate My Professor link for a given professor ID.
 *
 * @param {string} professorID - The base64-encoded professor ID. When decoded, this string must be in the format
 *                               "Teacher-XXXXXXXX", where XXXXXXXX is the numeric ID.
 * @return {null|string} The Rate My Professor URL, or null if an error occurred during decoding.
 */
function getRMPProfessorLink(professorID) {
    try {
        const decodedProfID = atob(professorID); // Decode the base64 ID
        const binaryProfID = decodedProfID.replace("Teacher-", ""); // Extract numeric ID

        return `https://www.ratemyprofessors.com/professor/${binaryProfID}`;
    } catch (error) {
        console.error("Error decoding or constructing RateMyProfessor link"); // TODO: Consider removing/improving
        return null;
    }
}

/**
 * Retrieves professor metrics and includes the RateMyProfessor link for the professor.
 *
 * @param {string} professorID - The base64-encoded professor ID.
 * @return {Promise<{Object}|null>} A promise that resolves with an object containing the professor's metrics
 *                                  and RateMyProfessor link, or null if no metrics were found or if an error
 *                                  occurred. If successful, the returned object will have the following
 *                                  structure:
 *                                  {
 *                                      // ... other metrics (avgRating, avgDifficulty, etc.)
 *                                      RMPLink: string // The RateMyProfessor link
 *                                  }
 */
async function getProfessorMetricsWithLink(professorID) {
    const metrics = await getProfessorMetrics(professorID);

    if (metrics) {
        metrics.RMPLink = getRMPProfessorLink(professorID); // Add the RMP link to the metrics object
    }

    return metrics;
}

/**
 * Event listener for establishing connection with the extension's content script.
 * Listens for messages containing professor names, then retrieves their metrics from the RMP API.
 */
chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(async function(msg) {
        if (msg.professorName) {
            const profID = await getProfessorID(msg.professorName);

            if (profID === null) {
                port.postMessage({professorMetrics: null});
                return;
            }

            const profMetrics = await getProfessorMetricsWithLink(profID);
            port.postMessage({professorMetrics: profMetrics});
        } else {
            console.error("Error checking msg.professorName"); // Log errors
        }
    });
});