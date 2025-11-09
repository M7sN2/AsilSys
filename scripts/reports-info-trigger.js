// Toggle explanation on click for reports page
document.addEventListener('DOMContentLoaded', function() {
    const infoTriggers = document.querySelectorAll('.info-trigger');
    infoTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
        });
    });
    
    // Close explanation when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tab-description')) {
            infoTriggers.forEach(trigger => {
                trigger.classList.remove('active');
            });
        }
    });
});

