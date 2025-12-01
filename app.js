// Application Review Portal
let applications = [];
let filteredApplications = [];
let comments = JSON.parse(localStorage.getItem('applicationComments') || '{}');
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid
let currentSort = '';
let viewMode = localStorage.getItem('viewMode') || 'grid'; // 'grid' or 'list'

// Load applications from JSON
async function loadApplications() {
    try {
        const response = await fetch('Applications_1186_final_final.json');
        applications = await response.json();
        filteredApplications = applications;
        populateFilters();
        renderApplications();
        updateStats();
        // Initialize view mode after data loads
        updateViewMode();
    } catch (error) {
        console.error('Error loading applications:', error);
        document.getElementById('applicationsGrid').innerHTML = 
            '<div class="empty-state"><h2>Error Loading Data</h2><p>Please ensure Applications_1186_final_final.json is in the same directory.</p></div>';
    }
}

// Populate filter dropdowns
function populateFilters() {
    const segmentFilter = document.getElementById('segmentFilter');
    const segments = new Set();
    
    applications.forEach(app => {
        const segment = app['Select the primary segment for your innovation: (Select only one)'];
        if (segment && segment.trim()) segments.add(segment.trim());
    });
    
    // Sort segments alphabetically
    const sortedSegments = Array.from(segments).sort();
    
    sortedSegments.forEach(segment => {
        const option = document.createElement('option');
        option.value = segment;
        option.textContent = segment;
        segmentFilter.appendChild(option);
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
                const aFunding = a['Total Funding Raised'] || 0;
                const bFunding = b['Total Funding Raised'] || 0;
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
    const segmentFilter = document.getElementById('segmentFilter').value;
    const trlFilter = document.getElementById('trlFilter').value;
    const fundingFilter = document.getElementById('fundingFilter').value;
    const recognitionFilter = document.getElementById('recognitionFilter').value;
    
    return applications.filter(app => {
        const matchesSearch = !searchTerm || 
            app.ApplicationId?.toLowerCase().includes(searchTerm) ||
            app.Name?.toLowerCase().includes(searchTerm) ||
            app['Venture Name']?.toLowerCase().includes(searchTerm) ||
            app['Innovation Title']?.toLowerCase().includes(searchTerm);
        
        const matchesSegment = !segmentFilter || 
            (app['Select the primary segment for your innovation: (Select only one)'] && 
             app['Select the primary segment for your innovation: (Select only one)'].trim() === segmentFilter);
        
        const matchesTRL = !trlFilter || 
            app['Technology Readiness Level (TRL)'] === trlFilter;
        
        const matchesFunding = !fundingFilter || 
            app['Are you funded by any VC/Angel/Govt?'] === fundingFilter;
        
        // Recognition filter logic
        let matchesRecognition = true;
        if (recognitionFilter) {
            const hasAwards = app.awards && app.awards.length > 0 && 
                            app.awards.some(award => {
                                return award['Award/Recognition'] || award['Awarding Body'] || award['Details'];
                            });
            
            const hasMedia = app.media_coverage && app.media_coverage.length > 0 && 
                           app.media_coverage.some(media => {
                                return media['Type'] || media['Website links'] || media['Details'];
                           });
            
            if (recognitionFilter === 'Award Winners') {
                matchesRecognition = hasAwards;
            } else if (recognitionFilter === 'Media recognized') {
                matchesRecognition = hasMedia;
            } else if (recognitionFilter === 'Others') {
                matchesRecognition = !hasAwards && !hasMedia;
            }
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
        <div class="application-card" onclick="showDetail('${app.ApplicationId}')">
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
            <button class="view-btn" onclick="event.stopPropagation(); showDetail('${app.ApplicationId}')">View Details</button>
        </div>
    `).join('');
    
    // Render list view
    if (list) {
        list.innerHTML = paginatedApps.map(app => `
            <div class="application-list-item" onclick="showDetail('${app.ApplicationId}')">
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
                    <button class="list-view-btn" onclick="event.stopPropagation(); showDetail('${app.ApplicationId}')">View Details</button>
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
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const segmentFilter = document.getElementById('segmentFilter').value;
    const trlFilter = document.getElementById('trlFilter').value;
    const fundingFilter = document.getElementById('fundingFilter').value;
    const recognitionFilter = document.getElementById('recognitionFilter').value;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    filteredApplications = applications.filter(app => {
        const matchesSearch = !searchTerm || 
            app.ApplicationId?.toLowerCase().includes(searchTerm) ||
            app.Name?.toLowerCase().includes(searchTerm) ||
            app['Venture Name']?.toLowerCase().includes(searchTerm) ||
            app['Innovation Title']?.toLowerCase().includes(searchTerm);
        
        const matchesSegment = !segmentFilter || 
            (app['Select the primary segment for your innovation: (Select only one)'] && 
             app['Select the primary segment for your innovation: (Select only one)'].trim() === segmentFilter);
        
        const matchesTRL = !trlFilter || 
            app['Technology Readiness Level (TRL)'] === trlFilter;
        
        const matchesFunding = !fundingFilter || 
            app['Are you funded by any VC/Angel/Govt?'] === fundingFilter;
        
        // Recognition filter logic
        let matchesRecognition = true;
        if (recognitionFilter) {
            const hasAwards = app.awards && app.awards.length > 0 && 
                            app.awards.some(award => {
                                // Check if award has valid data (not all empty)
                                return award['Award/Recognition'] || award['Awarding Body'] || award['Details'];
                            });
            
            const hasMedia = app.media_coverage && app.media_coverage.length > 0 && 
                           app.media_coverage.some(media => {
                                // Check if media has valid data (not all empty)
                                return media['Type'] || media['Website links'] || media['Details'];
                           });
            
            if (recognitionFilter === 'Award Winners') {
                matchesRecognition = hasAwards;
            } else if (recognitionFilter === 'Media recognized') {
                matchesRecognition = hasMedia;
            } else if (recognitionFilter === 'Others') {
                // Others = no awards AND no media
                matchesRecognition = !hasAwards && !hasMedia;
            }
        }
        
        return matchesSearch && matchesSegment && matchesTRL && matchesFunding && matchesRecognition;
    });
    
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

// Show application detail
function showDetail(applicationId) {
    const app = applications.find(a => a.ApplicationId === applicationId);
    if (!app) return;
    
    const modal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    
    // Reset scroll position to top before showing modal
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
    
    modalBody.innerHTML = `
        <div class="modal-section">
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

        <div class="modal-section">
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

        <div class="modal-section">
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

        <div class="modal-section">
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
        <div class="modal-section">
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
        <div class="modal-section">
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
        <div class="modal-section">
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

        <div class="modal-section">
            <h3>Documents & Links</h3>
            <div class="detail-grid">
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
    
    modal.style.display = 'block';
    
    // Prevent body scroll when modal is open
    document.body.classList.add('modal-open');
    
    // Ensure modal content scrolls to top after content is rendered
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    }, 10);
}

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

// Close modal
document.querySelector('.close').onclick = function() {
    const modal = document.getElementById('detailModal');
    const modalContent = document.querySelector('.modal-content');
    modal.style.display = 'none';
    // Re-enable body scroll when modal is closed
    document.body.classList.remove('modal-open');
    // Reset scroll position when closing
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('detailModal');
    if (event.target == modal) {
        const modalContent = document.querySelector('.modal-content');
        modal.style.display = 'none';
        // Re-enable body scroll when modal is closed
        document.body.classList.remove('modal-open');
        // Reset scroll position when closing
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    }
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', filterApplications);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') filterApplications();
});
document.getElementById('searchBtn').addEventListener('click', filterApplications);
document.getElementById('clearBtn').addEventListener('click', function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('segmentFilter').value = '';
    document.getElementById('trlFilter').value = '';
    document.getElementById('fundingFilter').value = '';
    document.getElementById('recognitionFilter').value = '';
    document.getElementById('sortBy').value = '';
    currentSort = '';
    filterApplications();
});
document.getElementById('segmentFilter').addEventListener('change', filterApplications);
document.getElementById('trlFilter').addEventListener('change', filterApplications);
document.getElementById('fundingFilter').addEventListener('change', filterApplications);
document.getElementById('recognitionFilter').addEventListener('change', filterApplications);
document.getElementById('sortBy').addEventListener('change', sortApplications);

// Load applications on page load
loadApplications();

