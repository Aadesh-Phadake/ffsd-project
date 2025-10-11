(() => {
    'use strict'
  
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    const forms = document.querySelectorAll('.needs-validation')
  
    // Loop over them and prevent submission
    Array.from(forms).forEach(form => {
      form.addEventListener('submit', event => {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }
  
        form.classList.add('was-validated')
      }, false)
    })
  })()
  
  // Initialize date pickers on applicable inputs
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof flatpickr === 'function') {
      const dateInputs = document.querySelectorAll('input[name="checkIn"], input[name="checkOut"], input[type="text"][data-date="true"], input[type="date"]');
      dateInputs.forEach((input) => {
        // Use DD-MM-YYYY to match server-side parsing
        flatpickr(input, {
          dateFormat: 'd-m-Y',
          allowInput: true,
          minDate: 'today'
        });
      });

      const checkIn = document.querySelector('input[name="checkIn"]');
      const checkOut = document.querySelector('input[name="checkOut"]');
      if (checkIn && checkOut) {
        const checkInPicker = checkIn._flatpickr || flatpickr(checkIn, { dateFormat: 'd-m-Y', minDate: 'today' });
        const updateCheckoutMin = (selectedDates) => {
          const min = selectedDates && selectedDates[0] ? selectedDates[0] : 'today';
          if (checkOut._flatpickr) {
            checkOut._flatpickr.set('minDate', min);
          } else {
            flatpickr(checkOut, { dateFormat: 'd-m-Y', minDate: min });
          }
        };
        checkInPicker.config.onChange.push(updateCheckoutMin);
      }
    }
  });