// Application Review Portal
let applications = [];
let filteredApplications = [];
let comments = {};
try {
    const commentsStr = localStorage.getItem('applicationComments');
    if (commentsStr) {
        comments = JSON.parse(commentsStr);
    }
} catch (e) {
    console.warn('Failed to parse comments from localStorage:', e);
    comments = {};
}
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid
let currentSort = '';
let viewMode = localStorage.getItem('viewMode') || 'grid'; // 'grid' or 'list'

// Determine which data file to load
function getDataFile() {
    // Check if we're on the allapplications page
    // Check pathname, href, and also check the HTML title or body class
    const path = window.location.pathname;
    const href = window.location.href;
    const title = document.title || '';
    
    // Multiple ways to detect allapplications page
    const isAllApplications = path.includes('allapplications') || 
                             path.includes('all_applications') ||
                             href.includes('allapplications') ||
                             title.includes('All Applications');
    
    if (isAllApplications) {
        // All applications page: load all 1186 applications
        console.log('✓ Detected allapplications page');
        console.log('  Pathname:', path);
        console.log('  Href:', href);
        return '/Applications_1186_final_final.json'; // Use absolute path
    }
    // Default view: load shortlisted applications (383 from CSV) - summarized version
    console.log('✓ Detected default page');
    console.log('  Pathname:', path);
    return '/shortlisted_applications_summarized.json'; // Use absolute path
}

// Load applications from JSON
async function loadApplications() {
    try {
        const dataFile = getDataFile();
        console.log('Loading data file:', dataFile);
        
        // dataFile is already an absolute path (starts with /)
        const dataUrl = dataFile;
        console.log('Fetching from URL:', dataUrl);
        
        const response = await fetch(dataUrl);
        
        console.log('Response status:', response.status);
        console.log('Response content-type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText.substring(0, 200));
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Response is not JSON. First 200 chars:', text.substring(0, 200));
            throw new Error(`Expected JSON but got ${contentType || 'unknown type'}`);
        }
        
        applications = await response.json();
        console.log(`Loaded ${applications.length} applications`);
        
        if (!applications || applications.length === 0) {
            throw new Error('No applications found in data file');
        }
        
        filteredApplications = applications;
        populateFilters();
        renderApplications();
        updateStats();
        // Initialize view mode after data loads
        updateViewMode();
        // Check if there's a hash in the URL to show detail view
        checkInitialHash();
    } catch (error) {
        console.error('Error loading applications:', error);
        console.error('Error stack:', error.stack);
        const errorMsg = `<div class="empty-state">
            <h2>Error Loading Data</h2>
            <p>${error.message}</p>
            <p>Expected file: ${getDataFile()}</p>
            <p>Please check the browser console for more details.</p>
        </div>`;
        document.getElementById('applicationsGrid').innerHTML = errorMsg;
        if (document.getElementById('applicationsList')) {
            document.getElementById('applicationsList').innerHTML = errorMsg;
        }
    }
}

// Populate filter checkboxes
function populateFilters() {
    const segmentFilterGroup = document.getElementById('segmentFilterGroup');
    const segments = new Set();
    
    applications.forEach(app => {
        // Handle both old format and new summarized format
        const segment = app.Segment || app['Select the primary segment for your innovation: (Select only one)'];
        if (segment && segment.trim()) segments.add(segment.trim());
    });
    
    // Sort segments alphabetically
    const sortedSegments = Array.from(segments).sort();
    
    // Clear existing checkboxes
    segmentFilterGroup.innerHTML = '';
    
    sortedSegments.forEach(segment => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'filter-checkbox';
        checkbox.setAttribute('data-filter', 'segment');
        checkbox.value = segment;
        
        const span = document.createElement('span');
        span.textContent = segment;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        segmentFilterGroup.appendChild(label);
    });
    
    // Add event listeners to all checkboxes
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', filterApplications);
    });
}

// Sort applications
function sortApplications() {
    const sortBy = document.getElementById('sortBy').value;
    currentSort = sortBy;
    
    // First apply filters, then sort
    filteredApplications = getFilteredApplications();
    
    if (!sortBy) {
        // No sorting, just render filtered results
        currentPage = 1;
        renderApplications();
        updateStats();
        return;
    }
    
    // Create a copy to sort
    let appsToSort = [...filteredApplications];
    
    switch(sortBy) {
        case 'most-funded':
            appsToSort.sort((a, b) => {
                // Helper to extract funding amount from either format
                const getFundingAmount = (app) => {
                    // Old format: direct field
                    if (app['Total Funding Raised']) {
                        const value = app['Total Funding Raised'];
                        if (typeof value === 'number') return isNaN(value) ? 0 : value;
                        if (typeof value === 'string') {
                            const cleaned = value.replace(/[^\d.-]/g, '');
                            const parsed = parseFloat(cleaned);
                            return isNaN(parsed) ? 0 : parsed;
                        }
                    }
                    
                    // New summarized format: extract from "Funding/Grants" text
                    if (app['Traction and Achievements'] && app['Traction and Achievements']['Funding/Grants']) {
                        const fundingText = app['Traction and Achievements']['Funding/Grants'];
                        // Look for patterns like "Raised ₹200,000,000" or "₹200,000,000"
                        const patterns = [
                            /raised\s*₹?\s*([\d,]+)/i,
                            /₹\s*([\d,]+)/,
                            /([\d,]+)\s*(?:in funding|in grants)/i
                        ];
                        
                        for (const pattern of patterns) {
                            const match = fundingText.match(pattern);
                            if (match) {
                                const cleaned = match[1].replace(/,/g, '');
                                const parsed = parseFloat(cleaned);
                                if (!isNaN(parsed)) {
                                    return parsed;
                                }
                            }
                        }
                    }
                    
                    return 0;
                };
                
                const aFunding = getFundingAmount(a);
                const bFunding = getFundingAmount(b);
                
                // Descending order (highest first)
                return bFunding - aFunding;
            });
            break;
        case 'largest-team':
            appsToSort.sort((a, b) => {
                // Helper to extract team size from either format
                const getTeamSize = (app) => {
                    // Old format: direct field
                    if (app['Team Size (full-time equivalents)']) {
                        const value = app['Team Size (full-time equivalents)'];
                        if (typeof value === 'number') return isNaN(value) ? 0 : value;
                        if (typeof value === 'string') {
                            const parsed = parseInt(value);
                            return isNaN(parsed) ? 0 : parsed;
                        }
                    }
                    
                    // New summarized format: extract from "Team" text
                    if (app['Traction and Achievements'] && app['Traction and Achievements']['Team']) {
                        const teamText = app['Traction and Achievements']['Team'];
                        const match = teamText.match(/Team of (\d+)/i);
                        if (match) {
                            return parseInt(match[1]) || 0;
                        }
                    }
                    
                    return 0;
                };
                
                const aTeam = getTeamSize(a);
                const bTeam = getTeamSize(b);
                return bTeam - aTeam;
            });
            break;
        case 'alphabetical':
            appsToSort.sort((a, b) => {
                // Handle both old and new formats
                const aName = (a['Company Name'] || a['Venture Name'] || a['Startup/Company Popular (Brand) Name (if any)'] || a['Innovation Title'] || '').toLowerCase();
                const bName = (b['Company Name'] || b['Venture Name'] || b['Startup/Company Popular (Brand) Name (if any)'] || b['Innovation Title'] || '').toLowerCase();
                return aName.localeCompare(bName);
            });
            break;
        case 'trl-highest':
            appsToSort.sort((a, b) => {
                const aTRL = parseInt((a['TRL Level'] || a['Technology Readiness Level (TRL)'] || 0));
                const bTRL = parseInt((b['TRL Level'] || b['Technology Readiness Level (TRL)'] || 0));
                return bTRL - aTRL;
            });
            break;
        case 'most-awarded':
            appsToSort.sort((a, b) => {
                const aAwards = (a.awards || []).length;
                const bAwards = (b.awards || []).length;
                return bAwards - aAwards;
            });
            break;
        case 'most-recognized':
            appsToSort.sort((a, b) => {
                const aMedia = ((a['Media Coverage'] || a.media_coverage) || []).length;
                const bMedia = ((b['Media Coverage'] || b.media_coverage) || []).length;
                return bMedia - aMedia;
            });
            break;
    }
    
    filteredApplications = appsToSort;
    currentPage = 1;
    renderApplications();
    updateStats();
}

// Helper function to get filtered applications (before sorting)
function getFilteredApplications() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Get selected checkboxes
    const selectedSegments = Array.from(document.querySelectorAll('.filter-checkbox[data-filter="segment"]:checked')).map(cb => cb.value);
    const selectedTRLs = Array.from(document.querySelectorAll('.filter-checkbox[data-filter="trl"]:checked')).map(cb => cb.value);
    const selectedFunding = Array.from(document.querySelectorAll('.filter-checkbox[data-filter="funding"]:checked')).map(cb => cb.value);
    const selectedRecognition = Array.from(document.querySelectorAll('.filter-checkbox[data-filter="recognition"]:checked')).map(cb => cb.value);
    
    return applications.filter(app => {
        // Handle both old format and new summarized format
        const companyName = app['Company Name'] || app['Venture Name'] || '';
        const matchesSearch = !searchTerm || 
            app.ApplicationId?.toLowerCase().includes(searchTerm) ||
            app.Name?.toLowerCase().includes(searchTerm) ||
            companyName?.toLowerCase().includes(searchTerm) ||
            app['Innovation Title']?.toLowerCase().includes(searchTerm);
        
        // Segment filter: if no segments selected, show all; otherwise match if app segment is in selected list
        // Handle both old format and new summarized format
        const appSegment = app.Segment || app['Select the primary segment for your innovation: (Select only one)'];
        const matchesSegment = selectedSegments.length === 0 || 
            (appSegment && selectedSegments.includes(appSegment.trim()));
        
        // TRL filter: if no TRLs selected, show all; otherwise match if app TRL is in selected list
        // Handle both old format and new summarized format
        const appTRL = app['TRL Level'] || app['Technology Readiness Level (TRL)'];
        const matchesTRL = selectedTRLs.length === 0 || 
            selectedTRLs.includes(String(appTRL));
        
        // Funding filter: if no funding statuses selected, show all; otherwise match if app funding status is in selected list
        // For summarized format, check if there's funding info in Traction and Achievements
        const fundingStatus = app['Are you funded by any VC/Angel/Govt?'] || 
                             (app['Traction and Achievements'] && app['Traction and Achievements']['Funding/Grants'] && 
                              !app['Traction and Achievements']['Funding/Grants'].includes('No funding') ? 'Yes' : null);
        const matchesFunding = selectedFunding.length === 0 || 
            (fundingStatus && selectedFunding.includes(fundingStatus));
        
        // Recognition filter logic
        let matchesRecognition = true;
        if (selectedRecognition.length > 0) {
            // Handle both old format (awards, media_coverage) and new summarized format (Traction and Achievements)
            const awards = app.awards || [];
            const mediaCoverage = app['Media Coverage'] || app.media_coverage || [];
            
            const hasAwards = awards.length > 0 && 
                            awards.some(award => {
                                return award['Award/Recognition'] || award['Awarding Body'] || award['Details'] || 
                                       (typeof award === 'string' && award.trim());
                            });
            
            const hasMedia = mediaCoverage.length > 0 && 
                           mediaCoverage.some(media => {
                                return media['Type'] || media['Website links'] || media['Details'] || 
                                       (media.link && media.description);
                           });
            
            // Check if any selected recognition type matches
            matchesRecognition = selectedRecognition.some(rec => {
                if (rec === 'Award Winners') return hasAwards;
                if (rec === 'Media recognized') return hasMedia;
                if (rec === 'Others') return !hasAwards && !hasMedia;
                return false;
            });
        }
        
        return matchesSearch && matchesSegment && matchesTRL && matchesFunding && matchesRecognition;
    });
}

// Render applications with pagination
function renderApplications() {
    const grid = document.getElementById('applicationsGrid');
    const list = document.getElementById('applicationsList');
    
    if (filteredApplications.length === 0) {
        const emptyMsg = '<div class="empty-state"><h2>No Applications Found</h2><p>Try adjusting your search or filters.</p></div>';
        grid.innerHTML = emptyMsg;
        if (list) list.innerHTML = emptyMsg;
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedApps = filteredApplications.slice(startIndex, endIndex);
    
    // Render grid view
    grid.innerHTML = paginatedApps.map(app => {
        // Handle both old format and new summarized format
        const companyName = app['Company Name'] || app['Venture Name'] || app['Startup/Company Popular (Brand) Name (if any)'] || 'N/A';
        const trl = app['TRL Level'] || app['Technology Readiness Level (TRL)'] || 'N/A';
        const segment = app.Segment || app['Select the primary segment for your innovation: (Select only one)'] || 'N/A';
        
        // Extract team size from Traction and Achievements
        let teamSize = app['Team Size (full-time equivalents)'] || null;
        if (!teamSize && app['Traction and Achievements'] && app['Traction and Achievements']['Team']) {
            const teamText = app['Traction and Achievements']['Team'];
            // Extract number from text like "Team of 70 members"
            const teamMatch = teamText.match(/Team of (\d+)/i);
            if (teamMatch) {
                teamSize = teamMatch[1];
            }
        }
        teamSize = teamSize || 'N/A';
        
        // Extract funding status from Traction and Achievements
        let funded = app['Are you funded by any VC/Angel/Govt?'] || null;
        if (!funded && app['Traction and Achievements'] && app['Traction and Achievements']['Funding/Grants']) {
            const fundingText = app['Traction and Achievements']['Funding/Grants'].toLowerCase();
            // Check for negative indicators first
            if (fundingText.includes('no funding') || fundingText.includes('not reported') || fundingText.includes('no grants')) {
                funded = 'No';
            } else if (fundingText.includes('raised') || fundingText.includes('received') || fundingText.includes('₹')) {
                // Positive indicators: "raised", "received", or currency symbol
                funded = 'Yes';
            } else {
                funded = 'No';
            }
        }
        funded = funded || 'N/A';
        
        return `
        <div class="application-card">
            <div class="app-id">${app.ApplicationId}</div>
            <div class="app-title">${app['Innovation Title'] || 'No Title'}</div>
            <div class="app-venture">${companyName}</div>
            <div class="app-details">
                <div class="app-detail-item">
                    <span class="app-detail-label">Segment:</span>
                    <span class="app-detail-value">${segment}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">TRL Level:</span>
                    <span class="app-detail-value">${trl}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">Team Size:</span>
                    <span class="app-detail-value">${teamSize}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">Funded:</span>
                    <span class="app-detail-value">${funded}</span>
                </div>
            </div>
            <button class="view-btn" onclick="openApplicationInNewTab('${app.ApplicationId}')">View Details</button>
        </div>
        `;
    }).join('');
    
    // Render list view
    if (list) {
        list.innerHTML = paginatedApps.map(app => {
            // Handle both old format and new summarized format
            const companyName = app['Company Name'] || app['Venture Name'] || app['Startup/Company Popular (Brand) Name (if any)'] || 'N/A';
            const trl = app['TRL Level'] || app['Technology Readiness Level (TRL)'] || 'N/A';
            const segment = app.Segment || app['Select the primary segment for your innovation: (Select only one)'] || 'N/A';
            const awards = app.awards || [];
            const mediaCoverage = app['Media Coverage'] || app.media_coverage || [];
            
            // Extract team size from Traction and Achievements
            let teamSize = app['Team Size (full-time equivalents)'] || null;
            if (!teamSize && app['Traction and Achievements'] && app['Traction and Achievements']['Team']) {
                const teamText = app['Traction and Achievements']['Team'];
                const teamMatch = teamText.match(/Team of (\d+)/i);
                if (teamMatch) {
                    teamSize = teamMatch[1];
                }
            }
            teamSize = teamSize || 'N/A';
            
            // Extract funding status from Traction and Achievements
            let funded = app['Are you funded by any VC/Angel/Govt?'] || null;
            if (!funded && app['Traction and Achievements'] && app['Traction and Achievements']['Funding/Grants']) {
                const fundingText = app['Traction and Achievements']['Funding/Grants'].toLowerCase();
                // Check for negative indicators first
                if (fundingText.includes('no funding') || fundingText.includes('not reported') || fundingText.includes('no grants')) {
                    funded = 'No';
                } else if (fundingText.includes('raised') || fundingText.includes('received') || fundingText.includes('₹')) {
                    // Positive indicators: "raised", "received", or currency symbol
                    funded = 'Yes';
                } else {
                    funded = 'No';
                }
            }
            funded = funded || 'N/A';
            
            return `
            <div class="application-list-item">
                <div class="list-item-id">${app.ApplicationId}</div>
                <div class="list-item-content">
                    <h3 class="list-item-title">${app['Innovation Title'] || 'No Title'}</h3>
                    <div class="list-item-venture">${companyName}</div>
                    <div class="list-item-details">
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Segment:</span>
                            <span class="list-item-detail-value">${segment}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">TRL:</span>
                            <span class="list-item-detail-value">${trl}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Team Size:</span>
                            <span class="list-item-detail-value">${teamSize}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Funded:</span>
                            <span class="list-item-detail-value">${funded}</span>
                        </div>
                        ${awards.length > 0 ? `
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Awards:</span>
                            <span class="list-item-detail-value">${awards.length}</span>
                        </div>
                        ` : ''}
                        ${mediaCoverage.length > 0 ? `
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Media:</span>
                            <span class="list-item-detail-value">${mediaCoverage.length}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="list-view-btn" onclick="openApplicationInNewTab('${app.ApplicationId}')">View Details</button>
                </div>
            </div>
            `;
        }).join('');
    }
    
    // Render pagination (totalPages already calculated above)
    renderPagination(totalPages);
    
    // Update view mode display
    updateViewMode();
}

// Set view mode (grid or list)
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('viewMode', mode);
    updateViewMode();
}

// Update view mode display
function updateViewMode() {
    const grid = document.getElementById('applicationsGrid');
    const list = document.getElementById('applicationsList');
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    
    if (viewMode === 'grid') {
        grid.classList.remove('hidden');
        if (list) list.classList.remove('active');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        grid.classList.add('hidden');
        if (list) list.classList.add('active');
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    }
}

// Search and filter
function filterApplications() {
    // Reset to first page when filtering
    currentPage = 1;
    
    // Use the shared getFilteredApplications function
    filteredApplications = getFilteredApplications();
    
    // Apply sorting if active, otherwise just render
    if (currentSort) {
        // Re-apply sorting after filtering
        const sortBy = document.getElementById('sortBy');
        if (sortBy && sortBy.value) {
            sortApplications();
        } else {
            currentSort = '';
            renderApplications();
            updateStats();
        }
    } else {
        renderApplications();
        updateStats();
    }
}

// Update stats
function updateStats() {
    document.getElementById('totalCount').textContent = applications.length;
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredApplications.length);
    if (filteredApplications.length > 0) {
        document.getElementById('showingCount').textContent = `${startIndex}-${endIndex} of ${filteredApplications.length}`;
    } else {
        document.getElementById('showingCount').textContent = '0';
    }
}

// Render pagination controls
function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination">';
    
    // Previous button
    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Previous</button>`;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="page-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="page-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next ›</button>`;
    
    paginationHTML += '</div>';
    pagination.innerHTML = paginationHTML;
}

// Go to specific page
function goToPage(page) {
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderApplications();
    updateStats();
    
    // Scroll to top of applications grid
    document.getElementById('applicationsGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Open application detail in new tab/window
function openApplicationInNewTab(applicationId) {
    // Determine if we're on allapplications page or default page
    const path = window.location.pathname;
    const isAllApplications = path.includes('allapplications');
    
    // Build URL with path-based routing
    const currentUrl = window.location.origin;
    
    if (isAllApplications) {
        // For allapplications page: /allapplications/ApplicationId
        const newUrl = currentUrl + '/allapplications/' + applicationId;
        window.open(newUrl, '_blank');
    } else {
        // For default page: use path-based /ApplicationId
        const newUrl = currentUrl + '/' + applicationId;
        window.open(newUrl, '_blank');
    }
}

// Show application detail in new view (called when path or hash is present)
function showDetail(applicationId) {
    // Check if we're on allapplications page
    const path = window.location.pathname;
    const isAllApplications = path.includes('allapplications');
    
    if (isAllApplications) {
        // Use path-based routing for allapplications page: /allapplications/ApplicationId
        const newPath = '/allapplications/' + applicationId;
        window.history.pushState({applicationId: applicationId}, '', newPath);
    } else {
        // Use path-based routing for default page: /ApplicationId
        const newPath = '/' + applicationId;
        window.history.pushState({applicationId: applicationId}, '', newPath);
    }
    
    renderDetailView(applicationId);
}

// Render detail view
let isRendering = false; // Guard to prevent double rendering
let lastRenderedId = null; // Track last rendered ID

function renderDetailView(applicationId) {
    // Prevent double rendering
    if (isRendering && lastRenderedId === applicationId) {
        console.log('Already rendering this application, skipping...');
        return;
    }
    
    // Wait for applications to load if not loaded yet
    if (!applications || applications.length === 0) {
        console.log('Applications not loaded yet, waiting...');
        // Wait a bit and try again
        setTimeout(() => {
            renderDetailView(applicationId);
        }, 200);
        return;
    }
    
    // Set rendering flag
    isRendering = true;
    lastRenderedId = applicationId;
    console.log('Rendering detail view for:', applicationId);
    
    const app = applications.find(a => a.ApplicationId === applicationId);
    if (!app) {
        console.log(`Application not found: ${applicationId}`);
        console.log(`Total applications loaded: ${applications.length}`);
        // Application not found, go back to list
        goBack();
        return;
    }
    
    const detailView = document.getElementById('detailView');
    const detailBody = document.getElementById('detailBody');
    
    // Hide main content (header, sidebar, main layout) and show detail view
    const header = document.querySelector('.header');
    const mainLayout = document.querySelector('.main-layout');
    
    if (header) header.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'none';
    
    detailView.classList.remove('hidden');
    
    // Reset scroll position
    window.scrollTo(0, 0);
    
    // Check if this is summarized data structure
    const isSummarized = app.About !== undefined;
    
    if (isSummarized) {
        // New summarized format - Card-based design
        detailBody.innerHTML = `
            <!-- Hero Section Card -->
            <div class="detail-hero-card">
                <h1 class="detail-hero-title">${app['Innovation Title'] || 'Application Details'}</h1>
                <div class="detail-meta-badges">
                    <span class="detail-badge detail-badge-id">${app.ApplicationId}</span>
                    ${app.Segment ? `<span class="detail-badge detail-badge-segment">${app.Segment}</span>` : ''}
                    ${app['TRL Level'] ? `<span class="detail-badge detail-badge-trl">TRL ${app['TRL Level']}</span>` : ''}
                </div>
            </div>

            <!-- About Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">About</h2>
                <div class="about-content">
                    <p>${app.About.paragraph1 || 'No description available.'}</p>
                    ${app.About.paragraph2 ? `<p>${app.About.paragraph2}</p>` : ''}
                </div>
            </div>

            <!-- Traction and Achievements Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">Traction and Achievements</h2>
                <div class="traction-grid">
                    <div class="traction-card">
                        <div class="traction-icon">💰</div>
                        <h3 class="traction-title">Funding / Grants</h3>
                        <p class="traction-text">${app['Traction and Achievements']['Funding/Grants'] || 'No funding or grants reported.'}</p>
                    </div>
                    <div class="traction-card">
                        <div class="traction-icon">📜</div>
                        <h3 class="traction-title">Patents & IP</h3>
                        <p class="traction-text">${app['Traction and Achievements']['Patents & IP'] || 'No patent information available.'}</p>
                    </div>
                    <div class="traction-card">
                        <div class="traction-icon">🏆</div>
                        <h3 class="traction-title">Awards and Achievements</h3>
                        <p class="traction-text">${app['Traction and Achievements']['Awards and Achievements'] || 'No awards reported.'}</p>
                    </div>
                    <div class="traction-card">
                        <div class="traction-icon">👥</div>
                        <h3 class="traction-title">Team</h3>
                        <p class="traction-text">${app['Traction and Achievements']['Team'] || 'Team information not available.'}</p>
                    </div>
                </div>
            </div>

            ${app['Media Coverage'] && app['Media Coverage'].length > 0 ? `
            <!-- Media Coverage Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">Media Coverage & Other Links</h2>
                <div class="media-links-grid">
                    ${app['Media Coverage'].map(media => `
                        <a href="${media.link}" target="_blank" class="media-link-card">
                            <div class="media-link-header">
                                <span class="media-link-type">${media.type || 'Media Coverage'}</span>
                            </div>
                            <div class="media-link-content">
                                <span class="media-link-icon">🔗</span>
                                <span class="media-link-text">${media.description || 'View Link'}</span>
                                <span class="media-link-arrow">→</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${app['Team Members'] && app['Team Members'].length > 0 ? `
            <!-- Team Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">Team</h2>
                <div class="team-cards-grid">
                    ${app['Team Members'].map(member => `
                        <div class="team-member-card">
                            <div class="team-member-header">
                                <div class="team-member-avatar">${(member.name || 'T').charAt(0).toUpperCase()}</div>
                                <div class="team-member-info">
                                    <h3 class="team-member-name">${member.name}</h3>
                                    ${member.role ? `<p class="team-role">${member.role}</p>` : ''}
                                </div>
                            </div>
                            ${member.credentials ? `<p class="team-credentials">${member.credentials}</p>` : ''}
                            ${member.email ? `<a href="mailto:${member.email}" class="team-contact-link">${member.email}</a>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Documents & Links Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">Documents & Links</h2>
                ${checkDocumentsAccess() ? `
                <div class="detail-grid" id="documentsContent">
                    ${app['Original Data'] && app['Original Data']['Demo Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Demo Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['Demo Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['High Res Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">High Res Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['High Res Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Presentation Deck'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Presentation Deck</span>
                        <span class="detail-value"><a href="${app['Original Data']['Presentation Deck']}" target="_blank">View Deck</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Patent Documentation'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Patent Documentation</span>
                        <span class="detail-value"><a href="${app['Original Data']['Patent Documentation']}" target="_blank">View Document</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Publications'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Publications</span>
                        <span class="detail-value"><a href="${app['Original Data']['Publications']}" target="_blank">View Publications</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Team CVs'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Team CVs</span>
                        <span class="detail-value"><a href="${app['Original Data']['Team CVs']}" target="_blank">View CVs</a></span>
                    </div>
                    ` : ''}
                </div>
                ` : `
                <div class="password-lock-screen" id="documentsLockScreen">
                    <div class="lock-icon">🔒</div>
                    <h4>Confidential Information</h4>
                    <p>Please enter credentials to access</p>
                    <div class="password-input-group">
                        <input type="password" id="documentsPassword" placeholder="Enter password" class="password-input">
                        <button onclick="unlockDocuments('${app.ApplicationId}')" class="unlock-btn">Unlock</button>
                    </div>
                    <div id="passwordError" class="password-error" style="display: none;">Incorrect password. Please try again.</div>
                </div>
                <div class="detail-grid" id="documentsContent" style="display: none;">
                    ${app['Original Data'] && app['Original Data']['Demo Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Demo Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['Demo Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['High Res Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">High Res Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['High Res Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Presentation Deck'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Presentation Deck</span>
                        <span class="detail-value"><a href="${app['Original Data']['Presentation Deck']}" target="_blank">View Deck</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Patent Documentation'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Patent Documentation</span>
                        <span class="detail-value"><a href="${app['Original Data']['Patent Documentation']}" target="_blank">View Document</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Publications'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Publications</span>
                        <span class="detail-value"><a href="${app['Original Data']['Publications']}" target="_blank">View Publications</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Team CVs'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Team CVs</span>
                        <span class="detail-value"><a href="${app['Original Data']['Team CVs']}" target="_blank">View CVs</a></span>
                    </div>
                    ` : ''}
                </div>
                `}
            </div>

            <!-- Review Comments Card -->
            <div class="detail-card">
                <h2 class="detail-card-title">Review Comments</h2>
                <div class="comment-form">
                    <textarea id="commentText" placeholder="Add your review comment here..."></textarea>
                    <button onclick="addComment('${app.ApplicationId}')">Add Comment</button>
                </div>
                <div class="comments-list" id="commentsList-${app.ApplicationId}">
                    ${renderComments(app.ApplicationId)}
                </div>
            </div>
        `;
    } else {
        // Old format - keep existing rendering for allapplications page
        detailBody.innerHTML = `
        <div class="detail-section">
            <h2>${app['Innovation Title'] || 'Application Details'}</h2>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Application ID</span>
                    <span class="detail-value">${app.ApplicationId}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Venture Name</span>
                    <span class="detail-value">${app['Venture Name'] || app['Startup/Company Popular (Brand) Name (if any)'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Legal Name</span>
                    <span class="detail-value">${app['Startup/Company Legal Name'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${app['Application Email'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Contact Number</span>
                    <span class="detail-value">${app['Contact Number'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Website</span>
                    <span class="detail-value">${app['Website Link or Link to Social Media Handle'] ? 
                        `<a href="${app['Website Link or Link to Social Media Handle']}" target="_blank">${app['Website Link or Link to Social Media Handle']}</a>` : 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Company Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Date of Incorporation</span>
                    <span class="detail-value">${app['Date of Incorporation'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Registration Number</span>
                    <span class="detail-value">${app['Company Registration Number (CIN/LLPIN)'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Registered Address</span>
                    <span class="detail-value">${app['Registered Address'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">DPIIT Certificate</span>
                    <span class="detail-value">${app['DPIIT Certificate Number'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Team Size</span>
                    <span class="detail-value">${app['Team Size (full-time equivalents)'] || 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Innovation Details</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Technology Readiness Level</span>
                    <span class="detail-value">${app['Technology Readiness Level (TRL)'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Primary Segment</span>
                    <span class="detail-value">${app['Select the primary segment for your innovation: (Select only one)'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">IP Status</span>
                    <span class="detail-value">${app['Intellectual Property Status'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Patent Details</span>
                    <span class="detail-value">${app['Patent Details'] || 'N/A'}</span>
                </div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Problem Clarity</span>
                <div class="detail-text">${app['Problem Clarity'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Solution Strength</span>
                <div class="detail-text">${app['Solution Strength'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Innovation/Originality</span>
                <div class="detail-text">${app['Innovation/Originality'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Impact Potential</span>
                <div class="detail-text">${app['Impact Potential'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Scalability/Replicability</span>
                <div class="detail-text">${app['Scalability/Replicability'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Execution Feasibility</span>
                <div class="detail-text">${app['Execution Feasibility'] || 'N/A'}</div>
            </div>
            <div class="detail-item" style="margin-top: 15px;">
                <span class="detail-label">Team Capacity</span>
                <div class="detail-text">${app['Team Capacity'] || 'N/A'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h3>Funding Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Funded by VC/Angel/Govt?</span>
                    <span class="detail-value">${app['Are you funded by any VC/Angel/Govt?'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Funding Raised</span>
                    <span class="detail-value">${app['Total Funding Raised'] ? '₹' + app['Total Funding Raised'].toLocaleString() : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Lead Investors</span>
                    <span class="detail-value">${app['Lead Investors'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Grants/Institutional Support</span>
                    <span class="detail-value">${app['Have you received any grants or institutional support?'] || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Amount Received</span>
                    <span class="detail-value">${app['Total Amount Received'] ? '₹' + app['Total Amount Received'].toLocaleString() : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Fund Source</span>
                    <span class="detail-value">${app['Fund Source'] || 'N/A'}</span>
                </div>
            </div>
        </div>

        ${app.team_members && app.team_members.length > 0 ? `
        <div class="detail-section">
            <h3>Team Members (${app.team_members.length})</h3>
            <div class="team-grid">
                ${app.team_members.map(member => `
                    <div class="team-card">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${member.Name || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Role</span>
                            <span class="detail-value">${member.Role || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${member.Email || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Mobile</span>
                            <span class="detail-value">${member['Mobile Number'] || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Gender</span>
                            <span class="detail-value">${member.Gender || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Date of Birth</span>
                            <span class="detail-value">${member['Date of Birth'] && !member['Date of Birth'].toString().toLowerCase().includes('invalid') ? member['Date of Birth'] : 'Date not available'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${app.awards && app.awards.length > 0 ? `
        <div class="detail-section">
            <h3>Awards & Recognition (${app.awards.length})</h3>
            <div class="award-grid">
                ${app.awards.map(award => `
                    <div class="award-card">
                        <div class="detail-item">
                            <span class="detail-label">Award/Recognition</span>
                            <span class="detail-value">${award['Award/Recognition'] || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Awarding Body</span>
                            <span class="detail-value">${award['Awarding Body'] || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${award.Year && !award.Year.toString().toLowerCase().includes('invalid') ? award.Year : 'Date not available'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Details</span>
                            <span class="detail-value">${award.Details || 'N/A'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${app.media_coverage && app.media_coverage.length > 0 ? `
        <div class="detail-section">
            <h3>Media Coverage & Publications (${app.media_coverage.length})</h3>
            <div class="media-grid">
                ${app.media_coverage.map(media => `
                    <div class="media-card">
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${media.Type || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Website Links</span>
                            <span class="detail-value">${media['Website links'] ? 
                                `<a href="${media['Website links']}" target="_blank">${media['Website links']}</a>` : 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${media.Year && !media.Year.toString().toLowerCase().includes('invalid') ? media.Year : 'Date not available'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Details</span>
                            <span class="detail-value">${media.Details || 'N/A'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

            <div class="detail-section">
                <h3>Documents & Links</h3>
                ${checkDocumentsAccess() ? `
                <div class="detail-grid" id="documentsContent">
                    ${app['Original Data'] && app['Original Data']['Demo Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Demo Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['Demo Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['High Res Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">High Res Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['High Res Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Presentation Deck'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Presentation Deck</span>
                        <span class="detail-value"><a href="${app['Original Data']['Presentation Deck']}" target="_blank">View Deck</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Patent Documentation'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Patent Documentation</span>
                        <span class="detail-value"><a href="${app['Original Data']['Patent Documentation']}" target="_blank">View Document</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Publications'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Publications</span>
                        <span class="detail-value"><a href="${app['Original Data']['Publications']}" target="_blank">View Publications</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Team CVs'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Team CVs</span>
                        <span class="detail-value"><a href="${app['Original Data']['Team CVs']}" target="_blank">View CVs</a></span>
                    </div>
                    ` : ''}
                </div>
                ` : `
                <div class="password-lock-screen" id="documentsLockScreen">
                    <div class="lock-icon">🔒</div>
                    <h4>Confidential Information</h4>
                    <p>Please enter credentials to access</p>
                    <div class="password-input-group">
                        <input type="password" id="documentsPassword" placeholder="Enter password" class="password-input">
                        <button onclick="unlockDocuments('${app.ApplicationId}')" class="unlock-btn">Unlock</button>
                    </div>
                    <div id="passwordError" class="password-error" style="display: none;">Incorrect password. Please try again.</div>
                </div>
                <div class="detail-grid" id="documentsContent" style="display: none;">
                    ${app['Original Data'] && app['Original Data']['Demo Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Demo Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['Demo Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['High Res Video'] ? `
                    <div class="detail-item">
                        <span class="detail-label">High Res Video</span>
                        <span class="detail-value"><a href="${app['Original Data']['High Res Video']}" target="_blank">View Video</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Presentation Deck'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Presentation Deck</span>
                        <span class="detail-value"><a href="${app['Original Data']['Presentation Deck']}" target="_blank">View Deck</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Patent Documentation'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Patent Documentation</span>
                        <span class="detail-value"><a href="${app['Original Data']['Patent Documentation']}" target="_blank">View Document</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Publications'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Publications</span>
                        <span class="detail-value"><a href="${app['Original Data']['Publications']}" target="_blank">View Publications</a></span>
                    </div>
                    ` : ''}
                    ${app['Original Data'] && app['Original Data']['Team CVs'] ? `
                    <div class="detail-item">
                        <span class="detail-label">Team CVs</span>
                        <span class="detail-value"><a href="${app['Original Data']['Team CVs']}" target="_blank">View CVs</a></span>
                    </div>
                    ` : ''}
                </div>
                `}
            </div>

            <div class="modal-section comments-section">
                <h3>Review Comments</h3>
                <div class="comment-form">
                    <textarea id="commentText" placeholder="Add your review comment here..."></textarea>
                    <button onclick="addComment('${app.ApplicationId}')">Add Comment</button>
                </div>
                <div class="comments-list" id="commentsList-${app.ApplicationId}">
                    ${renderComments(app.ApplicationId)}
                </div>
            </div>
        `;
    }
    
    // Reset rendering flag after a short delay to allow DOM updates
    setTimeout(() => {
        isRendering = false;
        console.log('Finished rendering detail view for:', applicationId);
    }, 100);
}

// Check if documents access is granted (per-application, not session-wide)
function checkDocumentsAccess() {
    // Always return false - password must be entered for each application
    return false;
}

// Unlock documents section
function unlockDocuments(applicationId) {
    const passwordInput = document.getElementById('documentsPassword');
    const password = passwordInput.value;
    const errorDiv = document.getElementById('passwordError');
    const lockScreen = document.getElementById('documentsLockScreen');
    const contentDiv = document.getElementById('documentsContent');
    
    // Check password
    if (password === 'BI@2025') {
        // Correct password - unlock for this application only
        lockScreen.style.display = 'none';
        contentDiv.style.display = '';
        passwordInput.value = '';
        errorDiv.style.display = 'none';
    } else {
        // Incorrect password
        errorDiv.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Allow Enter key to submit password
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.id === 'documentsPassword') {
        const applicationId = window.location.hash.substring(1);
        if (applicationId) {
            unlockDocuments(applicationId);
        }
    }
});

// Add comment
function addComment(applicationId) {
    const textarea = document.getElementById('commentText');
    const comment = textarea.value.trim();
    
    if (!comment) {
        alert('Please enter a comment');
        return;
    }
    
    if (!comments[applicationId]) {
        comments[applicationId] = [];
    }
    
    comments[applicationId].push({
        text: comment,
        timestamp: new Date().toISOString(),
        reviewer: 'Reviewer ' + Math.floor(Math.random() * 1000) // In production, use actual user
    });
    
    localStorage.setItem('applicationComments', JSON.stringify(comments));
    textarea.value = '';
    
    const commentsList = document.getElementById(`commentsList-${applicationId}`);
    if (commentsList) {
        commentsList.innerHTML = renderComments(applicationId);
    }
}

// Render comments
function renderComments(applicationId) {
    if (!comments[applicationId] || comments[applicationId].length === 0) {
        return '<p style="color: #666; font-style: italic;">No comments yet. Be the first to comment!</p>';
    }
    
    return comments[applicationId].map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <span>${comment.reviewer}</span>
                <span>${new Date(comment.timestamp).toLocaleString()}</span>
            </div>
            <div class="comment-text">${comment.text}</div>
        </div>
    `).join('');
}

// Go back to applications list
function goBack() {
    const path = window.location.pathname;
    const isAllApplications = path.includes('allapplications');
    
    if (isAllApplications) {
        // For allapplications page: go back to /allapplications
        window.history.pushState({}, '', '/allapplications');
    } else {
        // For default page: go back to root
        window.history.pushState({}, '', '/');
    }
    
    // Show main content and hide detail view
    const detailView = document.getElementById('detailView');
    detailView.classList.add('hidden');
    
    // Show header and main layout
    const header = document.querySelector('.header');
    const mainLayout = document.querySelector('.main-layout');
    
    if (header) header.style.display = '';
    if (mainLayout) mainLayout.style.display = '';
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Extract application ID from URL (supports both hash and path-based routing)
function getApplicationIdFromUrl() {
    const path = window.location.pathname;
    const isAllApplications = path.includes('allapplications');
    
    if (isAllApplications) {
        // Extract from path: /allapplications/ApplicationId
        const pathParts = path.split('/').filter(part => part); // Remove empty parts
        const lastPart = pathParts[pathParts.length - 1];
        
        // Check if last part is an ApplicationId (starts with BHAR-)
        if (lastPart && lastPart.startsWith('BHAR-')) {
            return lastPart;
        }
        // Also check hash as fallback (in case server rewrites to hash)
        const hash = window.location.hash.substring(1);
        if (hash && hash.startsWith('BHAR-')) {
            return hash;
        }
        return null;
    } else {
        // For default page: check both path and hash
        // Path-based: /BHAR-XXXXX
        const pathParts = path.split('/').filter(part => part);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.startsWith('BHAR-')) {
            return lastPart;
        }
        // Hash-based: #BHAR-XXXXX
        const hash = window.location.hash.substring(1);
        if (hash && hash.startsWith('BHAR-')) {
            return hash;
        }
        return null;
    }
}

// Prevent duplicate event listeners
let popstateListenerAttached = false;
let hashchangeListenerAttached = false;

// Handle URL changes (browser back/forward, direct links)
if (!popstateListenerAttached) {
    popstateListenerAttached = true;
    window.addEventListener('popstate', function(event) {
        const applicationId = getApplicationIdFromUrl();
        if (applicationId) {
            console.log('popstate event - rendering:', applicationId);
            renderDetailView(applicationId);
        } else {
            goBack();
        }
    });
}

// Also handle hash changes for default page
if (!hashchangeListenerAttached) {
    hashchangeListenerAttached = true;
    window.addEventListener('hashchange', function() {
        const path = window.location.pathname;
        const isAllApplications = path.includes('allapplications');
        
        if (!isAllApplications) {
            // Only handle hash for default page
            const hash = window.location.hash.substring(1);
            if (hash) {
                console.log('hashchange event - rendering:', hash);
                renderDetailView(hash);
            } else {
                goBack();
            }
        }
    });
}

// Check if there's an application ID in URL on page load
let initialHashChecked = false; // Prevent multiple calls
let initialHashRendered = false; // Track if initial hash has been rendered

function checkInitialHash() {
    if (initialHashChecked) {
        console.log('Initial hash already checked, skipping...');
        return;
    }
    
    const applicationId = getApplicationIdFromUrl();
    if (applicationId) {
        initialHashChecked = true;
        initialHashRendered = false; // Reset flag for this check
        console.log('Checking initial hash for:', applicationId);
        
        // Wait for applications to be loaded before rendering
        // This is especially important when opening in a new tab
        const checkDataLoaded = setInterval(() => {
            if (applications && applications.length > 0) {
                clearInterval(checkDataLoaded);
                if (!initialHashRendered) {
                    initialHashRendered = true;
                    console.log('Initial hash - data loaded, rendering:', applicationId);
                    renderDetailView(applicationId);
                } else {
                    console.log('Initial hash - already rendered, skipping interval callback');
                }
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkDataLoaded);
            if (applications && applications.length > 0) {
                if (!initialHashRendered) {
                    initialHashRendered = true;
                    console.log('Initial hash - timeout, rendering:', applicationId);
                    renderDetailView(applicationId);
                } else {
                    console.log('Initial hash - already rendered, skipping timeout callback');
                }
            } else {
                console.error('Applications failed to load');
                initialHashChecked = false; // Allow retry
                initialHashRendered = false; // Reset for retry
            }
        }, 5000);
    } else {
        initialHashChecked = true; // Mark as checked even if no hash
    }
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', filterApplications);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') filterApplications();
});
document.getElementById('searchBtn').addEventListener('click', filterApplications);
document.getElementById('clearFiltersBtn').addEventListener('click', function() {
    // Clear search
    document.getElementById('searchInput').value = '';
    
    // Uncheck all filter checkboxes
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Clear sort
    document.getElementById('sortBy').value = '';
    currentSort = '';
    
    filterApplications();
});
document.getElementById('sortBy').addEventListener('change', sortApplications);

// Handle "View All Applications" link
const viewAllLink = document.getElementById('viewAllApplicationsLink');
if (viewAllLink) {
    viewAllLink.addEventListener('click', function(e) {
        e.preventDefault();
        // No password check here - the page itself will handle it
        const currentUrl = window.location.origin;
        const allAppsUrl = currentUrl + '/allapplications';
        window.open(allAppsUrl, '_blank');
    });
}

// Check if password is required for allapplications page
function checkAllApplicationsPassword() {
    const path = window.location.pathname;
    const isAllApplications = path.includes('allapplications');
    
    if (isAllApplications) {
        // Check if password was already entered in this session
        const passwordEntered = sessionStorage.getItem('allApplicationsPasswordEntered');
        
        if (passwordEntered !== 'true') {
            // Show password prompt
            showAllApplicationsPasswordPrompt();
            return false; // Don't load applications yet
        }
    }
    
    // Password already entered or not on allapplications page
    loadApplications();
    return true;
}

// Show password prompt for allapplications page
function showAllApplicationsPasswordPrompt() {
    // Hide main content
    const container = document.querySelector('.container');
    if (container) {
        container.style.display = 'none';
    }
    
    // Get current origin for redirect link
    const currentUrl = window.location.origin;
    
    // Create password overlay
    const overlay = document.createElement('div');
    overlay.id = 'allApplicationsPasswordOverlay';
    overlay.className = 'password-overlay';
    overlay.innerHTML = `
        <div class="password-box">
            <span class="lock-icon">🔒</span>
            <h2>Protected Page</h2>
            <p>This page contains all applications. Please enter the password to access.</p>
            <input type="password" id="allApplicationsPasswordInput" placeholder="Enter password" autofocus>
            <button onclick="checkAllApplicationsPasswordEntry()">Access</button>
            <p id="allApplicationsPasswordError" class="password-error"></p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #666; font-size: 0.95em; margin-bottom: 15px;">Don't have access?</p>
                <a href="${currentUrl}/" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 1em; transition: all 0.3s ease;" 
                   onmouseover="this.style.textDecoration='underline'; this.style.color='#764ba2';" 
                   onmouseout="this.style.textDecoration='none'; this.style.color='#667eea';">
                    ← Back to Phase 1 Shortlisted Applications
                </a>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Allow Enter key to submit
    document.getElementById('allApplicationsPasswordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkAllApplicationsPasswordEntry();
        }
    });
}

// Check password entry for allapplications page
function checkAllApplicationsPasswordEntry() {
    const passwordInput = document.getElementById('allApplicationsPasswordInput');
    const errorMessage = document.getElementById('allApplicationsPasswordError');
    const password = passwordInput.value;
    
    if (password === 'admin_BI2025') {
        // Correct password - store in sessionStorage
        sessionStorage.setItem('allApplicationsPasswordEntered', 'true');
        
        // Remove password overlay
        const overlay = document.getElementById('allApplicationsPasswordOverlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Show main content
        const container = document.querySelector('.container');
        if (container) {
            container.style.display = '';
        }
        
        // Now load applications
        loadApplications();
    } else {
        // Incorrect password
        errorMessage.textContent = 'Incorrect password. Please try again.';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Toggle filters on mobile
function setupMobileFiltersToggle() {
    const toggleBtn = document.getElementById('toggleFiltersBtn');
    const filtersSection = document.getElementById('sidebarFilters');
    
    console.log('Setting up mobile filters toggle...');
    console.log('Toggle button found:', !!toggleBtn);
    console.log('Filters section found:', !!filtersSection);
    
    if (!toggleBtn) {
        console.error('Toggle button not found!');
        return;
    }
    
    if (!filtersSection) {
        console.error('Filters section not found!');
        return;
    }
    
    // Function to update state based on screen size
    function updateFilterState() {
        const isMobile = window.innerWidth <= 768;
        console.log('Screen width:', window.innerWidth, 'isMobile:', isMobile);
        
        if (isMobile) {
            // On mobile, ensure collapsed initially (unless user has expanded it)
            // Don't force collapse if user has already expanded
            if (!filtersSection.classList.contains('expanded')) {
                filtersSection.classList.remove('expanded');
                toggleBtn.classList.add('collapsed');
                console.log('Mobile: Filters collapsed (display: none)');
            }
        } else {
            // Always expanded on desktop
            filtersSection.classList.add('expanded');
            toggleBtn.classList.remove('collapsed');
            console.log('Desktop: Filters expanded');
        }
    }
    
    // Set initial state
    updateFilterState();
    
    // Toggle on button click - Y Combinator style
    toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            const wasExpanded = filtersSection.classList.contains('expanded');
            const isNowExpanded = !wasExpanded;
            
            // Toggle the expanded class
            filtersSection.classList.toggle('expanded');
            toggleBtn.classList.toggle('collapsed');
            
            console.log('Toggle clicked. Was expanded:', wasExpanded, 'Now expanded:', isNowExpanded);
            console.log('Filters section display:', window.getComputedStyle(filtersSection).display);
            console.log('Has expanded class:', filtersSection.classList.contains('expanded'));
            
            // Force a reflow to ensure the animation triggers
            void filtersSection.offsetHeight;
        }
    });
    
    // Update on window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            updateFilterState();
        }, 250);
    });
}

// Setup mobile filters toggle - call after DOM is ready
function initializeMobileFilters() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMobileFiltersToggle);
    } else {
        // DOM is already ready, but wait a bit to ensure all elements are rendered
        setTimeout(setupMobileFiltersToggle, 100);
    }
}

// Load applications on page load (after password check if needed)
checkAllApplicationsPassword();

// Setup mobile filters toggle
initializeMobileFilters();

