/**
 * LGRx Soil Moisture Network — Main Dashboard Logic
 * University of Michigan | CYGNSS Ground Validation Network
 */

document.addEventListener('DOMContentLoaded', function() {
    initDatePresets();
    initSmoothScroll();
    initDefaultDates();
});

/**
 * Initializes quick date range preset buttons (24h, 7d, 30d)
 */
function initDatePresets() {
    var preset24h = document.getElementById('preset-24h');
    var preset7d = document.getElementById('preset-7d');
    var preset30d = document.getElementById('preset-30d');

    if (preset24h) {
        preset24h.addEventListener('click', function() { setDateRangeHours(24); });
    }
    if (preset7d) {
        preset7d.addEventListener('click', function() { setDateRangeDays(7); });
    }
    if (preset30d) {
        preset30d.addEventListener('click', function() { setDateRangeDays(30); });
    }
}

function setDateRangeHours(hours) {
    var end = new Date();
    var start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    applyDatesToForm(start, end);
}

function setDateRangeDays(days) {
    var end = new Date();
    var start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    applyDatesToForm(start, end);
}

function applyDatesToForm(startObj, endObj) {
    var startInput = document.getElementById('start');
    var endInput = document.getElementById('end');
    if (startInput && endInput) {
        startInput.value = formatDateForInput(startObj);
        endInput.value = formatDateForInput(endObj);
    }
}

function formatDateForInput(dateObj) {
    var year = dateObj.getFullYear();
    var month = String(dateObj.getMonth() + 1).padStart(2, '0');
    var day = String(dateObj.getDate()).padStart(2, '0');
    var hours = String(dateObj.getHours()).padStart(2, '0');
    var minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function initDefaultDates() {
    var startInput = document.getElementById('start');
    var endInput = document.getElementById('end');
    if (startInput && endInput && !startInput.value && !endInput.value) {
        // Default to last 7 days
        setDateRangeDays(7);
    }
}

function initSmoothScroll() {
    var links = document.querySelectorAll('a[href^="#"]');
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                var targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}
