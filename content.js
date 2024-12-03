// Function to check if current page is a policy page
function isPolicyPage() {
	const policyKeywords = [
		'privacy', 'policy', 'terms', 'conditions', 'legal', 
		'tos', 'terms-of-service', 'privacy-policy'
	];
	
	// Check URL
	const url = window.location.href.toLowerCase();
	const urlMatch = policyKeywords.some(keyword => url.includes(keyword));
	
	// Check page title
	const title = document.title.toLowerCase();
	const titleMatch = policyKeywords.some(keyword => title.includes(keyword));
	
	// Check main headings
	const headings = document.querySelectorAll('h1, h2');
	const headingMatch = Array.from(headings).some(h => 
		policyKeywords.some(keyword => h.textContent.toLowerCase().includes(keyword))
	);
	
	return urlMatch || titleMatch || headingMatch;
}

// Function to find policy links in the page
function findPolicyLinks() {
	const policyKeywords = [
		'privacy', 'policy', 'terms', 'conditions', 'legal', 
		'tos', 'terms-of-service', 'privacy-policy'
	];
	
	const links = Array.from(document.getElementsByTagName('a'));
	return links.filter(link => {
		const href = link.href.toLowerCase();
		const text = link.textContent.toLowerCase();
		return policyKeywords.some(keyword => href.includes(keyword) || text.includes(keyword));
	});
}

// Create and inject the analyze button
function createAnalyzeButton() {
	console.log('Creating analyze button...');
	try {
		// Remove existing button if present
		const existingButton = document.getElementById('policy-analyzer-btn');
		if (existingButton) {
			existingButton.remove();
		}

		const button = document.createElement('button');
		button.id = 'policy-analyzer-btn';
		button.textContent = 'Analyze Policy';
		button.addEventListener('click', analyzePage);
		document.body.appendChild(button);
		console.log('Analyze button created and injected');
	} catch (error) {
		console.error('Error creating analyze button:', error);
	}
}

// Extract text content from the page
function extractPageContent() {
	console.log('Extracting page content...');
	try {
		// Find the main content container
		const mainContent = findMainContent();
		const content = mainContent ? mainContent.innerText : document.body.innerText;
		
		console.log(`Extracted ${content.length} characters of content`);
		console.log('First 200 characters of content:', content.substring(0, 200));
		return content;
	} catch (error) {
		console.error('Error extracting content:', error);
		return '';
	}
}

// Find the main content container
function findMainContent() {
	const selectors = [
		'main',
		'article',
		'[role="main"]',
		'#main-content',
		'.main-content',
		'.content',
		'.policy-content',
		'.terms-content'
	];
	
	for (const selector of selectors) {
		const element = document.querySelector(selector);
		if (element) return element;
	}
	
	return null;
}

// Function to handle the analysis
async function analyzePage() {
	const button = document.getElementById('policy-analyzer-btn');
	
	try {
		console.log('Starting page analysis...');
		showNotification('Checking AI capabilities...', 'info');
		
		const canSummarize = await chrome.runtime.sendMessage({ action: 'checkSummarizer' });
		console.log('Can summarize:', canSummarize);
		
		if (!canSummarize) {
			showNotification('Your browser does not support the Neno AI summarizer.', 'error');
			return;
		}

		button.textContent = 'Analyzing...';
		button.disabled = true;

		// Check if we're already on a policy page
		const isPolicyPageResult = isPolicyPage();
		console.log('Is policy page:', isPolicyPageResult);

		if (isPolicyPageResult) {
			console.log('Currently on a policy page, analyzing content...');
			showNotification('Analyzing policy content...', 'info');
			const content = extractPageContent();
			
			if (!content || content.length < 100) {
				throw new Error('Not enough content found on the page');
			}
			
			await processContent(content);
		} else {
			console.log('Not on a policy page, searching for policy pages...');
			showNotification('Searching for policy pages...', 'info');
			
			// Find policy links on the current page
			const policyLinks = findPolicyLinks();
			console.log('Found policy links:', policyLinks.map(link => link.href));

			if (policyLinks.length > 0) {
				// Send links to background script for processing
				const policyContents = await chrome.runtime.sendMessage({
					action: 'fetchPolicyContents',
					links: policyLinks.map(link => link.href)
				});

				console.log('Fetched policy contents:', policyContents ? policyContents.length : 0);

				if (policyContents && policyContents.length > 0) {
					const combinedContent = policyContents.join('\n\n=== Next Policy Document ===\n\n');
					await processContent(combinedContent);
				} else {
					throw new Error('No policy content could be fetched');
				}
			} else {
				showNotification('No policy pages found. Please visit the privacy policy page directly.', 'warning');
			}
		}

	} catch (error) {
		console.error('❌ Analysis failed:', error);
		showNotification(`Analysis failed: ${error.message}`, 'error');
	} finally {
		button.textContent = 'Analyze Policy';
		button.disabled = false;
	}
}

// Helper function to process content
async function processContent(content) {
	if (content.length < 100) {
		showNotification('Not enough content to analyze.', 'warning');
		return;
	}

	console.log('Sending content for analysis, length:', content.length);
	const summary = await chrome.runtime.sendMessage({
		action: 'analyze',
		content: content,
		url: window.location.href
	});
	
	console.log('Received summary:', summary);
	
	if (!summary) {
		throw new Error('No summary received from analysis');
	}

	showResults(summary);
	showNotification('Analysis complete!', 'success');
}

// Function to show notifications
function showNotification(message, type = 'info') {
	try {
		// Remove any existing notifications
		const existingNotifications = document.querySelectorAll('.policy-analyzer-notification');
		existingNotifications.forEach(notification => notification.remove());

		const notification = document.createElement('div');
		notification.className = `policy-analyzer-notification ${type}`;
		notification.textContent = message;
		document.body.appendChild(notification);
		
		setTimeout(() => {
			notification.classList.add('fade-out');
			setTimeout(() => notification.remove(), 500);
		}, 3000);
	} catch (error) {
		console.error('Error showing notification:', error);
	}
}

// Function to display results
function showResults(summary) {
	try {
		const existingResults = document.getElementById('policy-analysis-results');
		if (existingResults) {
			existingResults.remove();
		}

		const resultsDiv = document.createElement('div');
		resultsDiv.id = 'policy-analysis-results';
		resultsDiv.innerHTML = `
			<div class="results-content">
				<div class="results-header">
					<h3>Policy Analysis Summary</h3>
					<button class="close-button">×</button>
				</div>
				<div class="results-body markdown-content">
					${formatSummary(summary)}
				</div>
				<div class="results-footer">
					<button class="action-button">Close</button>
					<button class="action-button view-details">View Detailed Analysis</button>
				</div>
			</div>
		`;

		// Add event listeners
		const closeButtons = resultsDiv.querySelectorAll('.close-button, .action-button:not(.view-details)');
		closeButtons.forEach(button => {
			button.addEventListener('click', () => resultsDiv.remove());
		});

		// Add event listener for view details button
		const viewDetailsButton = resultsDiv.querySelector('.view-details');
		if (viewDetailsButton) {
			viewDetailsButton.addEventListener('click', () => {
				const detailsUrl = summary.match(/\[Click here for detailed analysis\]\((.*?)\)/)?.[1];
				if (detailsUrl) {
					window.open(detailsUrl, '_blank');
				}
			});
		}

		document.body.appendChild(resultsDiv);
	} catch (error) {
		console.error('Error showing results:', error);
		showNotification('Error displaying results', 'error');
	}
}

// Function to format markdown summary to HTML
function formatSummary(summary) {
	// Extract tags and content
	const lines = summary.split('\n');
	let tags = {};
	let contentStart = 0;

	// Parse tags
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.includes(':')) {
			const [key, value] = line.split(':').map(s => s.trim());
			if (['PRIVACY_SCORE', 'SAFETY_STATUS', 'SCAM_LIKELIHOOD', 'PHISHING_SIGNS', 'ORGANIZATION'].includes(key)) {
				tags[key] = value;
				contentStart = i + 1;
			} else {
				break;
			}
		}
	}

	// Format tags HTML
	const tagsHtml = `
		<div class="tag-container">
			<div class="tag tag-privacy">
				<span class="tag-label">Privacy Score</span>
				<span class="tag-value">${tags['PRIVACY_SCORE'] || '5'}</span>
			</div>
			<div class="tag tag-safety">
				<span class="tag-label">Safety Status</span>
				<span class="tag-value ${(tags['SAFETY_STATUS'] || '').toLowerCase()}">${tags['SAFETY_STATUS'] || 'UNKNOWN'}</span>
			</div>
			<div class="tag tag-scam">
				<span class="tag-label">Scam Risk</span>
				<span class="tag-value ${(tags['SCAM_LIKELIHOOD'] || '').toLowerCase()}">${tags['SCAM_LIKELIHOOD'] || 'UNKNOWN'}</span>
			</div>
			<div class="tag tag-phishing">
				<span class="tag-label">Phishing Signs</span>
				<span class="tag-value ${(tags['PHISHING_SIGNS'] || '').toLowerCase()}">${tags['PHISHING_SIGNS'] || 'UNKNOWN'}</span>
			</div>
			<div class="tag tag-whois" style="grid-column: span 2;">
				<span class="tag-label">Organization</span>
				<span class="tag-value">${tags['ORGANIZATION'] || 'Unknown'}</span>
			</div>
		</div>
	`;

	// Format the rest of the content
	const contentHtml = markdownToHtml(lines.slice(contentStart + 1).join('\n'))
		.replace(/•/g, '•')
		.replace(/(\d+\.|-)([^\n]+)/g, '<br>$1$2');

	return tagsHtml + contentHtml;
}

// Markdown to HTML converter
function markdownToHtml(markdown) {
	return markdown
		// Headers
		.replace(/^### (.*$)/gm, '<h3>$1</h3>')
		.replace(/^## (.*$)/gm, '<h2>$1</h2>')
		.replace(/^# (.*$)/gm, '<h1>$1</h1>')
		
		// Bold
		.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
		.replace(/__(.*?)__/g, '<strong>$1</strong>')
		
		// Italic
		.replace(/\*(.*?)\*/g, '<em>$1</em>')
		.replace(/_(.*?)_/g, '<em>$1</em>')
		
		// Lists
		.replace(/^\s*\d+\.\s+(.*)/gm, '<li>$1</li>')
		.replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>')
		
		// Wrap lists in ul/ol
		.replace(/(<li>.*?<\/li>)\s*\n/g, '<ul>$1</ul>')
		
		// Links
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
		
		// Paragraphs
		.replace(/\n\s*\n/g, '</p><p>')
		
		// Line breaks
		.replace(/\n/g, '<br>')
		
		// Wrap in paragraph if not already wrapped
		.replace(/^(.+)$/, '<p>$1</p>');
}

// Initialize the button when the page loads
console.log('Initializing Policy Analyzer...');
document.addEventListener('DOMContentLoaded', createAnalyzeButton);
// Also create button now in case DOMContentLoaded already fired
createAnalyzeButton();

// Send the hostname to the background script
chrome.runtime.sendMessage({
    action: 'setHostname',
    hostname: window.location.hostname
});