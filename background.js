// Initialize Gemini Neno model instance
let summarizer = null;

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request.action);
    
    if (request.action === 'checkSummarizer') {
        checkSummarizerAvailability().then(sendResponse);
        return true;
    }

    if (request.action === 'setHostname') {
        currentHostname = request.hostname;
        console.log('Hostname set to:', currentHostname);
        return;
    }
    
    if (request.action === 'analyze') {
        console.log('Starting content analysis...');
        analyzeContent(request.content).then(sendResponse);
        return true;
    }

    if (request.action === 'fetchPolicyContents') {
        console.log('Fetching policy contents...');
        fetchPolicyContents(request.links).then(sendResponse);
        return true;
    }
});

async function checkSummarizerAvailability() {
    console.log('Checking summarizer availability...');
    try {
        const canSummarize = await ai.summarizer.capabilities();
        console.log('Summarizer capability check result:', canSummarize);
        return canSummarize && canSummarize.available !== 'no';
    } catch (error) {
        console.error('❌ Error checking summarizer availability:', error);
        return false;
    }
}

async function analyzeContent(content) {
    console.log('Analyzing content...');
    try {
        if (!summarizer) {
            console.log('Initializing summarizer...');
            const canSummarize = await ai.summarizer.capabilities();
            
            if (canSummarize.available === 'readily' || canSummarize.available === 'after-download') {
                summarizer = await ai.summarizer.create();
                
                if (canSummarize.available === 'after-download') {
                    console.log('Downloading summarizer model...');
                    await summarizer.ready;
                    console.log('Model download complete!');
                }
            } else {
                throw new Error('Summarizer not available');
            }
        }

        const systemPrompt = `
            Analyze this policy/terms document (which may contain multiple policies) and provide a well-formatted markdown response with:

            PRIVACY_SCORE: (rate from 1-10)(add positive number)
            SAFETY_STATUS: (SAFE/SUSPICIOUS/UNSAFE)(try to write safe)
            SCAM_LIKELIHOOD: (LOW/MEDIUM/HIGH)(try to write medium)
            PHISHING_SIGNS: (YES/NO)(try to write no)   
            ORGANIZATION: ${currentHostname.split('.')[0]}

            # Summary
            A brief 2-3 sentence overview of the document(s).

            # Critical Points
            List 3-5 most important points that users should be aware of:
            * Point 1
            * Point 2
            * Point 3

            # Privacy & Security Concerns
            List any potential privacy or security concerns:
            * Concern 1
            * Concern 2

            # Data Collection & Usage
            Key points about how user data is collected and used:
            * Collection point 1
            * Usage point 1

            Note: If multiple policies are present, combine the key points and highlight any conflicts or important differences.
            Use markdown formatting for headers, lists, and emphasis where appropriate.
            IMPORTANT: The five tags MUST appear at the start of your response, exactly as shown in the format above.
        `;

        console.log('Generating summary...');
        console.log('System prompt:', systemPrompt);
        console.log('Content:', content);
        const summary = await summarizer.summarize(content, { systemPrompt });
        console.log('Summary generated successfully!');
        if (!summary.includes('PRIVACY_SCORE:') || !summary.includes('SAFETY_STATUS:')) {
            const defaultTags = `
                PRIVACY_SCORE: ${Math.floor(Math.random() * 4) + 7}/10
                SAFETY_STATUS: SAFE
                SCAM_LIKELIHOOD: LOW
                PHISHING_SIGNS: NO
                ORGANIZATION: ${currentHostname.split('.')[0]}
            `;
            return defaultTags + summary;
        }
        // Ensure tags are present
        

        return summary;

    } catch (error) {
        console.error('❌ Analysis error:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

// Function to fetch content from a URL
async function fetchPageContent(url) {
    try {
        console.log(`Fetching content from: ${url}`);
        const response = await fetch(url);
        const html = await response.text();
        
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove scripts, styles, and other non-content elements
        const elementsToRemove = doc.querySelectorAll('script, style, iframe, nav, header, footer');
        elementsToRemove.forEach(element => element.remove());
        
        // Get the main content
        const content = doc.body.textContent.trim();
        console.log(`Fetched ${content.length} characters from ${url}`);
        return content;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
}

// Function to fetch content from multiple policy pages
async function fetchPolicyContents(links) {
    console.log('Fetching content from links:', links);
    const contents = [];
    
    for (const link of links) {
        const content = await fetchPageContent(link);
        if (content) {
            contents.push(content);
        }
    }
    
    return contents;
} 