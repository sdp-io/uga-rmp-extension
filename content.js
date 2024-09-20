// Mutation observer to catch when table elements are added to the DOM (probably a better way to do this)
const mutationObserver = new MutationObserver(entries => {
    // Check if any table cells with the data-property "instructor" exist
    if (document.contains(document.querySelector('td[data-property="instructor"]'))) {
        // Get all table cells containing professor names
        const tables = document.querySelectorAll('td[data-property="instructor"]');

        // Iterate over the professor name cells and log their names
        tables.forEach(function(element) {
            const professorName = element.textContent;
            if (professorName.length > 0) {
                console.log(professorName);
            }
        });
    }
});

// Observe changes within the entire document body
const docBody = document.body
mutationObserver.observe(docBody, {childList: true});