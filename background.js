// Link to access the RMP GraphQL API.
URL = "https://www.ratemyprofessors.com/graphql"

// Publicly available authentication token to access RMP GraphQL API.
AUTH_TOKEN = "dGVzdDp0ZXN0"

// Base64 encoded identifier for the University of Georgia.
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

    // Get the ID of the first matching professor from the API response's 'edges' array.
    try {
        const response = await fetch(URL, options);
        const data = await response.json();
        const firstEdge = data?.data?.newSearch?.teachers?.edges?.[0];

        if (firstEdge) {
            const node = firstEdge.node;
            return node.id;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching professor ID:", error); // TODO: Consider removing/improving error handling
        return null;
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
 *                                      department: string,
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
            department
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
                department: node.department,
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
 * Event listener for establishing connection with the extension's content script.
 * Listens for messages containing professor names, then retrieves their metrics from the RMP API.
 */
chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(async function(msg) {
        if (msg.professorName) {
            const profID = await getProfessorID(msg.professorName);
            const profMetrics = await getProfessorMetrics(profID);
            console.log(`Received professor ${msg.professorName} received. ID is: ${profID}`) // TODO: Consider removing
            console.log('Professor metrics resolved:', profMetrics) // TODO: Consider removing
            port.postMessage({professorMetrics: profMetrics});
        } else {
            console.error("Error checking msg.professorName"); // Log errors
        }
    });
});