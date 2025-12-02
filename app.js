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
    // Default view: load shortlisted applications (383 from CSV)
    console.log('✓ Detected default page');
    console.log('  Pathname:', path);
    return '/shortlisted_applications.json'; // Use absolute path
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
        const segment = app['Select the primary segment for your innovation: (Select only one)'];
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
                // Convert to number, handling strings with commas or other formatting
                const parseFunding = (value) => {
                    if (value === null || value === undefined || value === '') return 0;
                    if (typeof value === 'number') {
                        return isNaN(value) ? 0 : value;
                    }
                    if (typeof value === 'string') {
                        // Remove commas, spaces, and other non-numeric characters except decimal point and minus
                        const cleaned = value.toString().replace(/[^\d.-]/g, '');
                        const parsed = parseFloat(cleaned);
                        return isNaN(parsed) ? 0 : parsed;
                    }
                    return 0;
                };
                
                const aFunding = parseFunding(a['Total Funding Raised']);
                const bFunding = parseFunding(b['Total Funding Raised']);
                
                // Descending order (highest first)
                return bFunding - aFunding;
            });
            break;
        case 'largest-team':
            appsToSort.sort((a, b) => {
                const aTeam = a['Team Size (full-time equivalents)'] || 0;
                const bTeam = b['Team Size (full-time equivalents)'] || 0;
                return bTeam - aTeam;
            });
            break;
        case 'alphabetical':
            appsToSort.sort((a, b) => {
                const aName = (a['Venture Name'] || a['Startup/Company Popular (Brand) Name (if any)'] || a['Innovation Title'] || '').toLowerCase();
                const bName = (b['Venture Name'] || b['Startup/Company Popular (Brand) Name (if any)'] || b['Innovation Title'] || '').toLowerCase();
                return aName.localeCompare(bName);
            });
            break;
        case 'trl-highest':
            appsToSort.sort((a, b) => {
                const aTRL = parseInt(a['Technology Readiness Level (TRL)'] || 0);
                const bTRL = parseInt(b['Technology Readiness Level (TRL)'] || 0);
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
                const aMedia = (a.media_coverage || []).length;
                const bMedia = (b.media_coverage || []).length;
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
        const matchesSearch = !searchTerm || 
            app.ApplicationId?.toLowerCase().includes(searchTerm) ||
            app.Name?.toLowerCase().includes(searchTerm) ||
            app['Venture Name']?.toLowerCase().includes(searchTerm) ||
            app['Innovation Title']?.toLowerCase().includes(searchTerm);
        
        // Segment filter: if no segments selected, show all; otherwise match if app segment is in selected list
        const matchesSegment = selectedSegments.length === 0 || 
            (app['Select the primary segment for your innovation: (Select only one)'] && 
             selectedSegments.includes(app['Select the primary segment for your innovation: (Select only one)'].trim()));
        
        // TRL filter: if no TRLs selected, show all; otherwise match if app TRL is in selected list
        const matchesTRL = selectedTRLs.length === 0 || 
            selectedTRLs.includes(String(app['Technology Readiness Level (TRL)']));
        
        // Funding filter: if no funding statuses selected, show all; otherwise match if app funding status is in selected list
        const matchesFunding = selectedFunding.length === 0 || 
            selectedFunding.includes(app['Are you funded by any VC/Angel/Govt?']);
        
        // Recognition filter logic
        let matchesRecognition = true;
        if (selectedRecognition.length > 0) {
            const hasAwards = app.awards && app.awards.length > 0 && 
                            app.awards.some(award => {
                                return award['Award/Recognition'] || award['Awarding Body'] || award['Details'];
                            });
            
            const hasMedia = app.media_coverage && app.media_coverage.length > 0 && 
                           app.media_coverage.some(media => {
                                return media['Type'] || media['Website links'] || media['Details'];
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
    grid.innerHTML = paginatedApps.map(app => `
        <div class="application-card">
            <div class="app-id">${app.ApplicationId}</div>
            <div class="app-title">${app['Innovation Title'] || 'No Title'}</div>
            <div class="app-venture">${app['Venture Name'] || app['Startup/Company Popular (Brand) Name (if any)'] || 'N/A'}</div>
            <div class="app-details">
                <div class="app-detail-item">
                    <span class="app-detail-label">Applicant:</span>
                    <span class="app-detail-value">${app.Name || 'N/A'}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">TRL Level:</span>
                    <span class="app-detail-value">${app['Technology Readiness Level (TRL)'] || 'N/A'}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">Team Size:</span>
                    <span class="app-detail-value">${app['Team Size (full-time equivalents)'] || 'N/A'}</span>
                </div>
                <div class="app-detail-item">
                    <span class="app-detail-label">Funded:</span>
                    <span class="app-detail-value">${app['Are you funded by any VC/Angel/Govt?'] || 'N/A'}</span>
                </div>
            </div>
            <button class="view-btn" onclick="openApplicationInNewTab('${app.ApplicationId}')">View Details</button>
        </div>
    `).join('');
    
    // Render list view
    if (list) {
        list.innerHTML = paginatedApps.map(app => `
            <div class="application-list-item">
                <div class="list-item-id">${app.ApplicationId}</div>
                <div class="list-item-content">
                    <h3 class="list-item-title">${app['Innovation Title'] || 'No Title'}</h3>
                    <div class="list-item-venture">${app['Venture Name'] || app['Startup/Company Popular (Brand) Name (if any)'] || 'N/A'}</div>
                    <div class="list-item-details">
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Applicant:</span>
                            <span class="list-item-detail-value">${app.Name || 'N/A'}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">TRL:</span>
                            <span class="list-item-detail-value">${app['Technology Readiness Level (TRL)'] || 'N/A'}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Team Size:</span>
                            <span class="list-item-detail-value">${app['Team Size (full-time equivalents)'] || 'N/A'}</span>
                        </div>
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Funded:</span>
                            <span class="list-item-detail-value">${app['Are you funded by any VC/Angel/Govt?'] || 'N/A'}</span>
                        </div>
                        ${app.awards && app.awards.length > 0 ? `
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Awards:</span>
                            <span class="list-item-detail-value">${app.awards.length}</span>
                        </div>
                        ` : ''}
                        ${app.media_coverage && app.media_coverage.length > 0 ? `
                        <div class="list-item-detail">
                            <span class="list-item-detail-label">Media:</span>
                            <span class="list-item-detail-value">${app.media_coverage.length}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="list-view-btn" onclick="openApplicationInNewTab('${app.ApplicationId}')">View Details</button>
                </div>
            </div>
        `).join('');
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
                ${app['Innovation/Product Demo Video'] ? `
                <div class="detail-item">
                    <span class="detail-label">Demo Video</span>
                    <span class="detail-value"><a href="${app['Innovation/Product Demo Video']}" target="_blank">View Video</a></span>
                </div>
                ` : ''}
                ${app['Link to high resolution video file'] ? `
                <div class="detail-item">
                    <span class="detail-label">High Res Video</span>
                    <span class="detail-value"><a href="${app['Link to high resolution video file']}" target="_blank">View Video</a></span>
                </div>
                ` : ''}
                ${app['Presentation Deck (Max 15 slides)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Presentation Deck</span>
                    <span class="detail-value"><a href="${app['Presentation Deck (Max 15 slides)']}" target="_blank">View Deck</a></span>
                </div>
                ` : ''}
                ${app['Patent Documentation'] ? `
                <div class="detail-item">
                    <span class="detail-label">Patent Documentation</span>
                    <span class="detail-value"><a href="${app['Patent Documentation']}" target="_blank">View Document</a></span>
                </div>
                ` : ''}
                ${app['Publications'] ? `
                <div class="detail-item">
                    <span class="detail-label">Publications</span>
                    <span class="detail-value"><a href="${app['Publications']}" target="_blank">View Publications</a></span>
                </div>
                ` : ''}
                ${app['Team CVs (One single PDF)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Team CVs</span>
                    <span class="detail-value"><a href="${app['Team CVs (One single PDF)']}" target="_blank">View CVs</a></span>
                </div>
                ` : ''}
                ${app['Company Registration Certificate (for startups)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Registration Certificate</span>
                    <span class="detail-value"><a href="${app['Company Registration Certificate (for startups)']}" target="_blank">View Certificate</a></span>
                </div>
                ` : ''}
                ${app['Equity holding pattern (Upload cap table showing Indian founders hold >51%).'] ? `
                <div class="detail-item">
                    <span class="detail-label">Equity Holding Pattern</span>
                    <span class="detail-value"><a href="${app['Equity holding pattern (Upload cap table showing Indian founders hold >51%).']}" target="_blank">View Document</a></span>
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
                ${app['Innovation/Product Demo Video'] ? `
                <div class="detail-item">
                    <span class="detail-label">Demo Video</span>
                    <span class="detail-value"><a href="${app['Innovation/Product Demo Video']}" target="_blank">View Video</a></span>
                </div>
                ` : ''}
                ${app['Link to high resolution video file'] ? `
                <div class="detail-item">
                    <span class="detail-label">High Res Video</span>
                    <span class="detail-value"><a href="${app['Link to high resolution video file']}" target="_blank">View Video</a></span>
                </div>
                ` : ''}
                ${app['Presentation Deck (Max 15 slides)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Presentation Deck</span>
                    <span class="detail-value"><a href="${app['Presentation Deck (Max 15 slides)']}" target="_blank">View Deck</a></span>
                </div>
                ` : ''}
                ${app['Patent Documentation'] ? `
                <div class="detail-item">
                    <span class="detail-label">Patent Documentation</span>
                    <span class="detail-value"><a href="${app['Patent Documentation']}" target="_blank">View Document</a></span>
                </div>
                ` : ''}
                ${app['Publications'] ? `
                <div class="detail-item">
                    <span class="detail-label">Publications</span>
                    <span class="detail-value"><a href="${app['Publications']}" target="_blank">View Publications</a></span>
                </div>
                ` : ''}
                ${app['Team CVs (One single PDF)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Team CVs</span>
                    <span class="detail-value"><a href="${app['Team CVs (One single PDF)']}" target="_blank">View CVs</a></span>
                </div>
                ` : ''}
                ${app['Company Registration Certificate (for startups)'] ? `
                <div class="detail-item">
                    <span class="detail-label">Registration Certificate</span>
                    <span class="detail-value"><a href="${app['Company Registration Certificate (for startups)']}" target="_blank">View Certificate</a></span>
                </div>
                ` : ''}
                ${app['Equity holding pattern (Upload cap table showing Indian founders hold >51%).'] ? `
                <div class="detail-item">
                    <span class="detail-label">Equity Holding Pattern</span>
                    <span class="detail-value"><a href="${app['Equity holding pattern (Upload cap table showing Indian founders hold >51%).']}" target="_blank">View Document</a></span>
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

function checkInitialHash() {
    if (initialHashChecked) {
        console.log('Initial hash already checked, skipping...');
        return;
    }
    
    const applicationId = getApplicationIdFromUrl();
    if (applicationId) {
        initialHashChecked = true;
        console.log('Checking initial hash for:', applicationId);
        
        // Wait for applications to be loaded before rendering
        // This is especially important when opening in a new tab
        const checkDataLoaded = setInterval(() => {
            if (applications && applications.length > 0) {
                clearInterval(checkDataLoaded);
                console.log('Initial hash - data loaded, rendering:', applicationId);
                renderDetailView(applicationId);
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkDataLoaded);
            if (applications && applications.length > 0) {
                console.log('Initial hash - timeout, rendering:', applicationId);
                renderDetailView(applicationId);
            } else {
                console.error('Applications failed to load');
                initialHashChecked = false; // Allow retry
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

