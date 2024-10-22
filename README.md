# uga-rmp-extension
**Description:** This Chrome extension seamlessly integrates Rate My Professors (RMP) data directly into the University of Georgia's Athena course registration page, providing you with valuable professor insights and metrics right where you need them. 

## Preview
![Extension Demo](./assets/demo.png)
*Red outline indicates where RateMyProfessor metrics are automatically inserted*

## Features
* Automatic professor detection and metric integration
* Real-time data fetching from RateMyProfessor via the RateMyProfessor GraphQL API
* Direct display of comprehensive metrics including:
    * Overall Rating (out of 5)
    * Difficulty Score (out of 5)
    * Total Number of Ratings
    * Would Take Again Percentage
* Clickable links to full RateMyProfessor profiles
* Fallback handling for professors without RateMyProfessor pages

## Installation
### Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store page (link coming soon)
2. Click "Add to Chrome"
3. Follow the prompts to complete installation

### Manual Installation (For Development)
1. Clone this repository: `git clone https://github.com/[your-username]/uga-rmp-extension.git`
2. Open Chrome and navigate to chrome://extensions/
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked"
5. Select the directory containing the extension files

## Usage
1. Navigate to the Athena registration page and make a search within the **Register for Classes** or **Browse Classes** sections.
2. The extension automatically detects professor names found in the search results
3. Within a few seconds, metrics will appear in each professor's table cell in the following format:
    * Overall Rating (out of 5)
    * Difficulty Score (out of 5)
    * Total Number of Ratings
    * Would Take Again Percentage
    * View on RMP »
4. Click "View on RMP »" to visit the professor's full RateMyProfessor profile based on their most relevant department
5. For professors without a RateMyProfessorPage, "No page found." will be displayed

## Configuration
This extension currently operates without requiring any configuration. It automatically:
* Detects professor names in schedule tables
* Fetches and displays relevant metrics
* Updates information when the page changes

## Browser Support
* Chrome/Chromium-based browsers
* Other browsers not currently supported
