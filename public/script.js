// Global variables
let allRequests = [];
let filteredRequests = [];

// API base URL
const API_BASE = '/api/requests';

// Utility functions
function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatPhone(phone) {
    // Simple phone formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

// Help Request Form Functionality
function initHelpRequestForm() {
    const form = document.getElementById('helpRequestForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        try {
            const formData = new FormData(form);
            const requestData = {
                name: formData.get('name').trim(),
                age: parseInt(formData.get('age')),
                phone: formData.get('phone').trim(),
                address: formData.get('address').trim(),
                helpType: formData.get('helpType'),
                notes: formData.get('notes').trim()
            };
            
            // Validate required fields
            if (!requestData.name || !requestData.age || !requestData.phone || 
                !requestData.address || !requestData.helpType) {
                throw new Error('Please fill in all required fields');
            }
            
            if (requestData.age < 1 || requestData.age > 120) {
                throw new Error('Please enter a valid age between 1 and 120');
            }
            
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to submit request');
            }
            
            // Success
            showMessage('Your help request has been submitted successfully! We will contact you soon.', 'success');
            form.reset();
            // Redirect to admin dashboard (read-only for elders)
            window.location.href = '/admin';
            
        } catch (error) {
            console.error('Error submitting request:', error);
            showMessage(error.message || 'Failed to submit request. Please try again.', 'error');
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Admin Dashboard Functionality
function initAdminDashboard() {
    if (!document.getElementById('requestsTableBody')) return;
    
    // If user is elder, make dashboard read-only
    if (window.userRole === 'elder') {
        // Disable all action buttons after table is rendered
        const observer = new MutationObserver(() => {
            disableAdminActions();
        });
        observer.observe(document.getElementById('requestsTableBody'), { childList: true, subtree: true });
        // Add read-only notice
        const dashHeader = document.querySelector('.dashboard-header');
        if (dashHeader && !document.getElementById('readonlyNotice')) {
            const notice = document.createElement('div');
            notice.id = 'readonlyNotice';
            notice.style.background = '#ffe0b2';
            notice.style.color = '#b26a00';
            notice.style.padding = '0.5rem 1rem';
            notice.style.margin = '1rem 0';
            notice.style.borderRadius = '5px';
            notice.style.fontWeight = 'bold';
            notice.innerHTML = '<i class="fas fa-eye"></i> You are viewing the dashboard in read-only mode.';
            dashHeader.parentNode.insertBefore(notice, dashHeader.nextSibling);
        }
    }
    // Load requests on page load
    loadRequests();
    // Set up event listeners
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRequests);
    }
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterRequests);
    }
}

async function loadRequests() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const requestsTable = document.getElementById('requestsTable');
    const noRequests = document.getElementById('noRequests');
    
    // Show loading state
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    if (requestsTable) requestsTable.classList.add('hidden');
    if (noRequests) noRequests.classList.add('hidden');
    
    try {
        const response = await fetch(API_BASE);
        
        if (!response.ok) {
            throw new Error('Failed to fetch requests');
        }
        
        allRequests = await response.json();
        filteredRequests = [...allRequests];
        
        updateStats();
        renderRequestsTable();
        
        // Show appropriate content
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        
        if (allRequests.length === 0) {
            if (noRequests) noRequests.classList.remove('hidden');
        } else {
            if (requestsTable) requestsTable.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error loading requests:', error);
        showMessage('Failed to load requests. Please try again.', 'error');
        
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        if (noRequests) noRequests.classList.remove('hidden');
    }
}

function updateStats() {
    const pendingCount = allRequests.filter(r => r.status === 'Pending').length;
    const inProgressCount = allRequests.filter(r => r.status === 'In Progress').length;
    const completedCount = allRequests.filter(r => r.status === 'Completed').length;
    const totalCount = allRequests.length;
    
    const pendingEl = document.getElementById('pendingCount');
    const inProgressEl = document.getElementById('inProgressCount');
    const completedEl = document.getElementById('completedCount');
    const totalEl = document.getElementById('totalCount');
    
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (inProgressEl) inProgressEl.textContent = inProgressCount;
    if (completedEl) completedEl.textContent = completedCount;
    if (totalEl) totalEl.textContent = totalCount;
}

function filterRequests() {
    const statusFilter = document.getElementById('statusFilter');
    const filterValue = statusFilter ? statusFilter.value : '';
    
    if (filterValue === '') {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(request => request.status === filterValue);
    }
    
    renderRequestsTable();
}

function renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;
    
    if (filteredRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-search"></i><br>
                    No requests match the current filter.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredRequests.map(request => `
        <tr>
            <td>
                <strong>${escapeHtml(request.name)}</strong>
            </td>
            <td>${request.age}</td>
            <td>${formatPhone(request.phone)}</td>
            <td>${escapeHtml(request.helpType)}</td>
            <td>
                <span class="status-badge status-${request.status.toLowerCase().replace(' ', '-')}">
                    ${request.status}
                </span>
            </td>
            <td>${formatDate(request.createdAt)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn btn-view" onclick="viewRequest('${request._id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${request.status !== 'Pending' ? `
                        <button class="action-btn btn-pending" onclick="updateStatus('${request._id}', 'Pending')">
                            <i class="fas fa-clock"></i> Pending
                        </button>
                    ` : ''}
                    ${request.status !== 'In Progress' ? `
                        <button class="action-btn btn-progress" onclick="updateStatus('${request._id}', 'In Progress')">
                            <i class="fas fa-spinner"></i> Progress
                        </button>
                    ` : ''}
                    ${request.status !== 'Completed' ? `
                        <button class="action-btn btn-complete" onclick="updateStatus('${request._id}', 'Completed')">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    ` : ''}
                    <button class="action-btn btn-delete" onclick="deleteRequest('${request._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function updateStatus(requestId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update status');
        }
        
        showMessage(`Request status updated to ${newStatus}`, 'success');
        loadRequests(); // Reload the table
        
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage(error.message || 'Failed to update status', 'error');
    }
}

async function deleteRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${requestId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete request');
        }
        
        showMessage('Request deleted successfully', 'success');
        loadRequests(); // Reload the table
        
    } catch (error) {
        console.error('Error deleting request:', error);
        showMessage(error.message || 'Failed to delete request', 'error');
    }
}

function viewRequest(requestId) {
    const request = allRequests.find(r => r._id === requestId);
    if (!request) return;
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    let volunteerInfo = '';
    if (request.assignedVolunteer && request.assignedVolunteer.name) {
        volunteerInfo = `
        <div class="detail-group">
            <label>Assigned Volunteer:</label>
            <p><strong>${escapeHtml(request.assignedVolunteer.name)}</strong><br>
            Email: <a href="mailto:${escapeHtml(request.assignedVolunteer.email)}">${escapeHtml(request.assignedVolunteer.email)}</a><br>
            Phone: <a href="tel:${escapeHtml(request.assignedVolunteer.phone)}">${escapeHtml(request.assignedVolunteer.phone)}</a></p>
        </div>
        `;
    }
    
    modalBody.innerHTML = `
        <div class="detail-group">
            <label>Name:</label>
            <p>${escapeHtml(request.name)}</p>
        </div>
        <div class="detail-group">
            <label>Age:</label>
            <p>${request.age} years old</p>
        </div>
        <div class="detail-group">
            <label>Phone:</label>
            <p>${formatPhone(request.phone)}</p>
        </div>
        <div class="detail-group">
            <label>Address:</label>
            <p>${escapeHtml(request.address)}</p>
        </div>
        <div class="detail-group">
            <label>Type of Help:</label>
            <p>${escapeHtml(request.helpType)}</p>
        </div>
        <div class="detail-group">
            <label>Status:</label>
            <p>
                <span class="status-badge status-${request.status.toLowerCase().replace(' ', '-')}">
                    ${request.status}
                </span>
            </p>
        </div>
        ${volunteerInfo}
        <div class="detail-group">
            <label>Additional Notes:</label>
            <p>${request.notes ? escapeHtml(request.notes) : 'No additional notes provided.'}</p>
        </div>
        <div class="detail-group">
            <label>Request Submitted:</label>
            <p>${formatDate(request.createdAt)}</p>
        </div>
    `;
    
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal() {
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('requestModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

function disableAdminActions() {
    // Disable all action buttons except 'View'
    document.querySelectorAll('.action-btn').forEach(btn => {
        if (!btn.classList.contains('btn-view')) {
            btn.disabled = true;
            btn.style.opacity = 0.5;
            btn.style.pointerEvents = 'none';
        }
    });
}

// Initialize appropriate functionality based on current page
document.addEventListener('DOMContentLoaded', function() {
    // Show current user role if available
    if (window.userRole && document.querySelector('.main-content')) {
        const roleMsg = document.createElement('div');
        roleMsg.style.background = '#e3f2fd';
        roleMsg.style.color = '#1565c0';
        roleMsg.style.padding = '0.5rem 1rem';
        roleMsg.style.margin = '1rem 0';
        roleMsg.style.borderRadius = '5px';
        roleMsg.style.fontWeight = 'bold';
        roleMsg.style.textAlign = 'center';
        roleMsg.innerHTML = `<i class="fas fa-user"></i> Logged in as: <span style="text-transform:capitalize">${window.userRole}</span>`;
        document.querySelector('.main-content').prepend(roleMsg);
    }
    // Check if we're on the help request form page
    if (document.getElementById('helpRequestForm')) {
        initHelpRequestForm();
    }
    
    // Check if we're on the admin dashboard page
    if (document.getElementById('requestsTableBody')) {
        initAdminDashboard();
    }
});

