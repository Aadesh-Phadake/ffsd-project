// Profile AJAX functionality
class ProfileManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupBookingCancellation();
        this.setupMembershipActivation();
        this.setupBookingStatusUpdates();
        this.setupToastNotifications();
    }

    // Toast notification system
    setupToastNotifications() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
        const toastId = 'toast-' + Date.now();
        
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(toastId);
        
        // Check if Bootstrap is available
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastElement, { delay: duration });
            toast.show();
            
            // Remove toast element after it's hidden
            toastElement.addEventListener('hidden.bs.toast', () => {
                toastElement.remove();
            });
        } else {
            // Fallback: simple alert if Bootstrap is not available
            console.warn('Bootstrap Toast not available, using fallback');
            alert(message);
            toastElement.remove();
        }
    }

    // 1. AJAX Booking Cancellation
    setupBookingCancellation() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('cancel-booking-btn')) {
                e.preventDefault();
                const bookingId = e.target.dataset.bookingId;
                this.showCancellationModal(bookingId);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('confirm-cancellation-btn')) {
                e.preventDefault();
                const bookingId = e.target.dataset.bookingId;
                this.confirmCancellation(bookingId);
            }
        });
    }

    async showCancellationModal(bookingId) {
        try {
            console.log('Fetching cancellation details for booking:', bookingId);
            const response = await fetch(`/api/profile/cancel/${bookingId}/details`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Cancellation details response:', data);
            
            if (data.success) {
                this.renderCancellationModal(data);
            } else {
                this.showToast(data.error || 'Failed to load cancellation details', 'error');
            }
        } catch (error) {
            console.error('Error fetching cancellation details:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    renderCancellationModal(data) {
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

        // Remove existing modal if any
        const existingModal = document.getElementById('cancellationModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Check if Bootstrap is available
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(document.getElementById('cancellationModal'));
            modal.show();
        } else {
            console.warn('Bootstrap Modal not available, using fallback');
            // Fallback: show confirmation dialog
            if (confirm('Are you sure you want to cancel this booking?')) {
                this.confirmCancellation(data.booking._id);
            }
        }
    }

    async confirmCancellation(bookingId) {
        const confirmBtn = document.querySelector('.confirm-cancellation-btn');
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
            
            if (data.success) {
                // Close modal
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('cancellationModal'));
                    if (modal) {
                        modal.hide();
                    }
                }
                
                // Show success message
                this.showToast(data.message || 'Booking cancelled successfully!', 'success');
                
                // Remove booking from UI
                this.removeBookingFromUI(bookingId);
                
                // Update membership info if needed
                this.updateMembershipInfo(data.user);
                
            } else {
                this.showToast(data.error || 'Failed to cancel booking', 'error');
                // Reset button
                confirmBtn.innerHTML = originalText;
                confirmBtn.disabled = false;
            }
        } catch (error) {
            this.showToast('Network error. Please try again.', 'error');
            // Reset button
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    }

    removeBookingFromUI(bookingId) {
        const bookingCard = document.querySelector(`[data-booking-id="${bookingId}"]`);
        if (bookingCard) {
            bookingCard.closest('.card').remove();
        }
        
        // Check if no bookings left
        const remainingBookings = document.querySelectorAll('.booking-card');
        if (remainingBookings.length === 0) {
            const bookingsContainer = document.querySelector('.bookings');
            bookingsContainer.innerHTML = `
                <div class="alert alert-info">
                    You haven't made any bookings yet. <a href="/listings">Browse properties</a> to make your first booking!
                </div>
            `;
        }
    }

    // 2. AJAX Membership Activation
    setupMembershipActivation() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('activate-membership-btn')) {
                e.preventDefault();
                this.activateMembership();
            }
        });
    }

    async activateMembership() {
        const activateBtn = document.querySelector('.activate-membership-btn');
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
            
            if (data.success) {
                this.showToast('Membership activated successfully!', 'success');
                this.updateMembershipInfo(data.user);
            } else {
                this.showToast(data.error || 'Failed to activate membership', 'error');
                // Reset button
                activateBtn.innerHTML = originalText;
                activateBtn.disabled = false;
            }
        } catch (error) {
            this.showToast('Network error. Please try again.', 'error');
            // Reset button
            activateBtn.innerHTML = originalText;
            activateBtn.disabled = false;
        }
    }

    updateMembershipInfo(user) {
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

    // 3. AJAX Booking Status Updates
    setupBookingStatusUpdates() {
        this.updateBookingStatuses();
        // Update every minute
        setInterval(() => {
            this.updateBookingStatuses();
        }, 60000);
    }

    updateBookingStatuses() {
        const bookingCards = document.querySelectorAll('.booking-card');
        
        bookingCards.forEach(card => {
            const checkInDate = card.dataset.checkIn;
            const checkOutDate = card.dataset.checkOut;
            
            if (checkInDate && checkOutDate) {
                this.updateBookingCardStatus(card, checkInDate, checkOutDate);
            }
        });
    }

    updateBookingCardStatus(card, checkInDate, checkOutDate) {
        const now = new Date();
        const checkIn = this.parseDate(checkInDate);
        const checkOut = this.parseDate(checkOutDate);
        
        if (!checkIn || !checkOut) return;

        const statusBadge = card.querySelector('.booking-status');
        const countdownElement = card.querySelector('.booking-countdown');
        
        if (now < checkIn) {
            // Upcoming booking
            const daysUntilCheckIn = Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24));
            statusBadge.className = 'badge bg-primary booking-status';
            statusBadge.textContent = 'Upcoming';
            
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
            statusBadge.className = 'badge bg-success booking-status';
            statusBadge.textContent = 'Current Stay';
            
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
            statusBadge.className = 'badge bg-secondary booking-status';
            statusBadge.textContent = 'Completed';
            
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

    parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        return new Date(year, month - 1, day);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing ProfileManager...');
        window.profileManager = new ProfileManager();
        console.log('ProfileManager initialized successfully');
    } catch (error) {
        console.error('Error initializing ProfileManager:', error);
        // Show error to user
        alert('Error initializing AJAX features: ' + error.message);
    }
});
