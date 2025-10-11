// Simplified Profile AJAX functionality with better error handling
(function() {
    'use strict';
    
    console.log('Profile AJAX script loaded');
    
    // Wait for DOM and Bootstrap to be ready
    function waitForBootstrap() {
        return new Promise((resolve) => {
            if (typeof bootstrap !== 'undefined') {
                resolve();
            } else {
                const checkBootstrap = setInterval(() => {
                    if (typeof bootstrap !== 'undefined') {
                        clearInterval(checkBootstrap);
                        resolve();
                    }
                }, 100);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkBootstrap);
                    console.warn('Bootstrap not found after 5 seconds');
                    resolve();
                }, 5000);
            }
        });
    }
    
    // Simple toast notification (fallback)
    function showSimpleToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();
        
        const toastId = 'toast-' + Date.now();
        const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
        
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) toast.remove();
        }, 5000);
    }
    
    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }
    
    // Enhanced toast with Bootstrap support
    function showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();
        const toastId = 'toast-' + Date.now();
        
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        
        // Try Bootstrap toast first, fallback to simple
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            try {
                const toast = new bootstrap.Toast(toastElement, { delay: duration });
                toast.show();
                
                toastElement.addEventListener('hidden.bs.toast', () => {
                    toastElement.remove();
                });
            } catch (error) {
                console.warn('Bootstrap toast failed, using fallback:', error);
                showSimpleToast(message, type);
            }
        } else {
            showSimpleToast(message, type);
        }
    }
    
    // Booking cancellation functionality
    function setupBookingCancellation() {
        console.log('Setting up booking cancellation...');
        
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('cancel-booking-btn')) {
                e.preventDefault();
                const bookingId = e.target.dataset.bookingId;
                console.log('Cancel booking clicked for ID:', bookingId);
                
                if (!bookingId) {
                    showToast('Booking ID not found', 'error');
                    return;
                }
                
                try {
                    showToast('Loading cancellation details...', 'info');
                    
                    const response = await fetch(`/api/profile/cancel/${bookingId}/details`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    console.log('Cancellation details response status:', response.status);
                    
                    if (!response.ok) {
                        if (response.status === 401) {
                            showToast('Please log in to cancel bookings', 'error');
                            return;
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Cancellation details:', data);
                    
                    if (data.success) {
                        showCancellationModal(data);
                    } else {
                        showToast(data.error || 'Failed to load cancellation details', 'error');
                    }
                } catch (error) {
                    console.error('Error fetching cancellation details:', error);
                    showToast('Network error. Please try again.', 'error');
                }
            }
        });
        
        // Handle confirmation
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('confirm-cancellation-btn')) {
                e.preventDefault();
                const bookingId = e.target.dataset.bookingId;
                console.log('Confirm cancellation for ID:', bookingId);
                
                if (!bookingId) {
                    showToast('Booking ID not found', 'error');
                    return;
                }
                
                const confirmBtn = e.target;
                const originalText = confirmBtn.innerHTML;
                
                // Show loading state
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Cancelling...';
                confirmBtn.disabled = true;
                
                try {
                    const response = await fetch(`/api/profile/cancel/${bookingId}/confirm`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    const data = await response.json();
                    console.log('Cancellation confirmation response:', data);
                    
                    if (data.success) {
                        // Close modal if Bootstrap is available
                        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(document.getElementById('cancellationModal'));
                            if (modal) modal.hide();
                        }
                        
                        showToast(data.message || 'Booking cancelled successfully!', 'success');
                        
                        // Remove booking from UI
                        const bookingCard = document.querySelector(`[data-booking-id="${bookingId}"]`);
                        if (bookingCard) {
                            bookingCard.closest('.card').remove();
                        }
                        
                        // Update membership info if provided
                        if (data.user) {
                            updateMembershipInfo(data.user);
                        }
                    } else {
                        showToast(data.error || 'Failed to cancel booking', 'error');
                        confirmBtn.innerHTML = originalText;
                        confirmBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error confirming cancellation:', error);
                    showToast('Network error. Please try again.', 'error');
                    confirmBtn.innerHTML = originalText;
                    confirmBtn.disabled = false;
                }
            }
        });
    }
    
    function showCancellationModal(data) {
        console.log('Showing cancellation modal with data:', data);
        
        const modalHtml = `
            <div class="modal fade" id="cancellationModal" tabindex="-1" aria-labelledby="cancellationModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="cancellationModalLabel">Cancel Booking</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Are you sure you want to cancel this booking?
                            </div>
                            
                            <div class="booking-details">
                                <h6>Booking Details:</h6>
                                <p><strong>Property:</strong> ${data.booking.listing.title}</p>
                                <p><strong>Check-in:</strong> ${data.booking.checkIn}</p>
                                <p><strong>Check-out:</strong> ${data.booking.checkOut}</p>
                                <p><strong>Total Amount:</strong> ₹${data.booking.totalAmount.toLocaleString("en-IN")}</p>
                            </div>
                            
                            <div class="cancellation-fee">
                                <h6>Cancellation Fee:</h6>
                                ${data.cancellationDetails.canUseFreeCancellation ? 
                                    '<div class="alert alert-success"><i class="fas fa-check me-2"></i>No cancellation fee (Free cancellation used)</div>' :
                                    `<div class="alert alert-info">Cancellation fee: ₹${data.cancellationDetails.cancellationFee.toLocaleString("en-IN")}</div>`
                                }
                                ${data.cancellationDetails.canUseFreeCancellation ? 
                                    `<small class="text-muted">Free cancellations used: ${data.cancellationDetails.freeCancellationsUsed}/2 this month</small>` : ''
                                }
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Keep Booking</button>
                            <button type="button" class="btn btn-danger confirm-cancellation-btn" data-booking-id="${data.booking._id}">
                                <i class="fas fa-times me-2"></i>Confirm Cancellation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('cancellationModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const modal = new bootstrap.Modal(document.getElementById('cancellationModal'));
                modal.show();
            } catch (error) {
                console.warn('Bootstrap modal failed, using fallback:', error);
                if (confirm('Are you sure you want to cancel this booking?')) {
                    // Trigger confirmation
                    const confirmBtn = document.querySelector('.confirm-cancellation-btn');
                    if (confirmBtn) confirmBtn.click();
                }
            }
        } else {
            console.warn('Bootstrap not available, using confirmation dialog');
            if (confirm('Are you sure you want to cancel this booking?')) {
                // Trigger confirmation
                const confirmBtn = document.querySelector('.confirm-cancellation-btn');
                if (confirmBtn) confirmBtn.click();
            }
        }
    }
    
    // Membership activation
    function setupMembershipActivation() {
        console.log('Setting up membership activation...');
        
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('activate-membership-btn')) {
                e.preventDefault();
                console.log('Activate membership clicked');
                
                const activateBtn = e.target;
                const originalText = activateBtn.innerHTML;
                
                // Show loading state
                activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Activating...';
                activateBtn.disabled = true;
                
                try {
                    const response = await fetch('/api/membership/activate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    const data = await response.json();
                    console.log('Membership activation response:', data);
                    
                    if (data.success) {
                        showToast(data.message || 'Membership activated successfully!', 'success');
                        if (data.user) {
                            updateMembershipInfo(data.user);
                        }
                    } else {
                        showToast(data.error || 'Failed to activate membership', 'error');
                        activateBtn.innerHTML = originalText;
                        activateBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error activating membership:', error);
                    showToast('Network error. Please try again.', 'error');
                    activateBtn.innerHTML = originalText;
                    activateBtn.disabled = false;
                }
            }
        });
    }
    
    function updateMembershipInfo(user) {
        console.log('Updating membership info:', user);
        
        const membershipContainer = document.querySelector('.membership-info');
        if (!membershipContainer) return;
        
        const activeMember = user && user.isMember && user.membershipExpiresAt && new Date(user.membershipExpiresAt) > new Date();
        
        if (activeMember) {
            membershipContainer.innerHTML = `
                <span class="badge bg-success">Active until ${new Date(user.membershipExpiresAt).toLocaleDateString()}</span>
                <br><small class="text-muted">Free cancellations used: ${user.freeCancellationsUsed || 0}/2 this month</small>
            `;
        } else {
            membershipContainer.innerHTML = `
                <span class="badge bg-secondary">Inactive</span>
                <button class="btn btn-sm btn-primary ms-2 activate-membership-btn">Activate ₹999/month</button>
            `;
        }
    }
    
    // Booking status updates
    function setupBookingStatusUpdates() {
        console.log('Setting up booking status updates...');
        
        function updateBookingStatuses() {
            const bookingCards = document.querySelectorAll('.booking-card');
            console.log(`Updating status for ${bookingCards.length} booking cards`);
            
            bookingCards.forEach(card => {
                const checkInDate = card.dataset.checkIn;
                const checkOutDate = card.dataset.checkOut;
                
                if (checkInDate && checkOutDate) {
                    updateBookingCardStatus(card, checkInDate, checkOutDate);
                }
            });
        }
        
        function updateBookingCardStatus(card, checkInDate, checkOutDate) {
            const now = new Date();
            const checkIn = parseDate(checkInDate);
            const checkOut = parseDate(checkOutDate);
            
            if (!checkIn || !checkOut) return;
            
            const statusBadge = card.querySelector('.booking-status');
            const countdownElement = card.querySelector('.booking-countdown');
            
            if (now < checkIn) {
                // Upcoming booking
                const daysUntilCheckIn = Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24));
                if (statusBadge) {
                    statusBadge.className = 'badge bg-primary booking-status';
                    statusBadge.textContent = 'Upcoming';
                }
                
                if (countdownElement) {
                    countdownElement.innerHTML = `
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>
                            Check-in in ${daysUntilCheckIn} day${daysUntilCheckIn !== 1 ? 's' : ''}
                        </small>
                    `;
                }
            } else if (now >= checkIn && now < checkOut) {
                // Current stay
                const daysRemaining = Math.ceil((checkOut - now) / (1000 * 60 * 60 * 24));
                if (statusBadge) {
                    statusBadge.className = 'badge bg-success booking-status';
                    statusBadge.textContent = 'Current Stay';
                }
                
                if (countdownElement) {
                    countdownElement.innerHTML = `
                        <small class="text-success">
                            <i class="fas fa-home me-1"></i>
                            Check-out in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}
                        </small>
                    `;
                }
            } else {
                // Past booking
                if (statusBadge) {
                    statusBadge.className = 'badge bg-secondary booking-status';
                    statusBadge.textContent = 'Completed';
                }
                
                if (countdownElement) {
                    countdownElement.innerHTML = `
                        <small class="text-muted">
                            <i class="fas fa-check me-1"></i>
                            Stay completed
                        </small>
                    `;
                }
            }
        }
        
        function parseDate(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return null;
            const [day, month, year] = parts;
            return new Date(year, month - 1, day);
        }
        
        // Initial update
        updateBookingStatuses();
        
        // Update every minute
        setInterval(updateBookingStatuses, 60000);
    }
    
    // Initialize everything
    async function initialize() {
        try {
            console.log('Initializing Profile AJAX features...');
            
            // Wait for Bootstrap
            await waitForBootstrap();
            
            // Setup features
            setupBookingCancellation();
            setupMembershipActivation();
            setupBookingStatusUpdates();
            
            // Make functions globally available for debugging
            window.profileAjax = {
                showToast,
                showSimpleToast,
                updateMembershipInfo
            };
            
            console.log('Profile AJAX features initialized successfully');
            showToast('AJAX features loaded successfully!', 'success', 3000);
            
        } catch (error) {
            console.error('Error initializing Profile AJAX features:', error);
            showSimpleToast('Error loading AJAX features: ' + error.message, 'error');
        }
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
