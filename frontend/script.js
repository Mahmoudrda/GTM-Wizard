'use strict';

var currentStep = 1;
var formData = {
    trackingGoal: '',
    destinations: [],
    pixels: {}
};

// Store the API response for download functionality
var configResponse = null;

// ID requirements for each destination
var destinationRequirements = {
    tiktok: { 
        name: 'TikTok Pixel', 
        icon: '🎵',
        fields: ['Pixel ID'],
        descriptions: ['Your TikTok Pixel ID from Events Manager']
    },
    meta: { 
        name: 'Meta Pixel', 
        icon: '📘',
        fields: ['Pixel ID'],
        descriptions: ['Facebook Pixel ID from Events Manager']
    },
    ga4: { 
        name: 'Google Analytics 4', 
        icon: '📊',
        fields: ['Measurement ID'],
        descriptions: ['GA4 Measurement ID (G-XXXXXXXXXX)']
    },
    linkedin: { 
        name: 'LinkedIn Insight Tag', 
        icon: '💼',
        fields: ['Partner ID', 'Conversion ID'],
        descriptions: ['LinkedIn Campaign Manager Partner ID', 'Conversion tracking ID']
    },
    snapchat: { 
        name: 'Snapchat Pixel', 
        icon: '👻',
        fields: ['Pixel ID'],
        descriptions: ['Your Snapchat Pixel ID from Events Manager']
    }
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Step 1 - Tracking Goal
    document.getElementById('trackingGoal').addEventListener('change', function() {
        var nextBtn = document.getElementById('step1Next');
        nextBtn.disabled = !this.value;
        formData.trackingGoal = this.value;
    });

    // Step 2 - Destinations
    var cards = document.querySelectorAll('.destination-card');
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var checkbox = this.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        var checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            var card = this.closest('.destination-card');
            
            if (this.checked) {
                card.classList.add('selected');
                formData.destinations.push(this.value);
            } else {
                card.classList.remove('selected');
                formData.destinations = formData.destinations.filter(function(dest) {
                    return dest !== checkbox.value;
                });
            }
            
            document.getElementById('step2Next').disabled = formData.destinations.length === 0;
        });
    });
});

function nextStep() {
    if (currentStep < 4) {
        // Hide current step
        document.getElementById("step" + currentStep).classList.remove('active');
        document.getElementById("circle" + currentStep).classList.remove('active');
        document.getElementById("progress" + currentStep).classList.add('completed');

        currentStep++;

        if (currentStep === 3) {
            generateIdInputs();
        }

        // Show new step
        document.getElementById("circle" + currentStep).classList.add('active');
        document.getElementById("step" + currentStep).classList.add('active');
    }
}

function prevStep(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (currentStep > 1) {
        document.getElementById("circle" + currentStep).classList.remove('active');
        document.getElementById("step" + currentStep).classList.remove('active');
        
        currentStep--;
        
        document.getElementById("circle" + currentStep).classList.remove('completed');
        document.getElementById("circle" + currentStep).classList.add('active');
        document.getElementById("progress" + currentStep).classList.remove('completed');
        document.getElementById("step" + currentStep).classList.add('active');
    }
}

function generateIdInputs() {
    var container = document.getElementById('idInputs');
    container.innerHTML = '';

    formData.destinations.forEach(function(dest) {
        var config = destinationRequirements[dest];
        var section = document.createElement('div');
        section.className = 'config-section';
        
        var inputsHTML = `
            <div class="config-header">
                <div class="config-icon" style="background: ${getIconBackground(dest)}">${config.icon}</div>
                <div class="config-title">${config.name}</div>
            </div>
        `;
        
        config.fields.forEach(function(field, index) {
            var fieldId = dest + '_' + field.replace(/\s+/g, '_').toLowerCase();
            inputsHTML += `
                <div class="input-group">
                    <label for="${fieldId}">${field}</label>
                    <input type="text" id="${fieldId}" data-destination="${dest}" data-field="${field}" 
                           placeholder="${config.descriptions[index] || 'Enter ' + field}">
                </div>
            `;
        });
        
        section.innerHTML = inputsHTML;
        container.appendChild(section);
    });

    // Add event listeners to validate inputs
    var inputs = container.querySelectorAll('input');
    inputs.forEach(function(input) {
        input.addEventListener('input', validateStep3);
    });
}

function getIconBackground(dest) {
    var backgrounds = {
        tiktok: '#000',
        meta: 'linear-gradient(45deg, #1877f2, #42a5f5)',
        ga4: 'linear-gradient(45deg, #4285f4, #34a853)',
        linkedin: '#0077b5',
        snapchat: 'linear-gradient(45deg, #fffc00, #ffb300)'
    };
    return backgrounds[dest] || '#4285f4';
}

function validateStep3() {
    var inputs = document.querySelectorAll('#idInputs input');
    var allFilled = Array.from(inputs).every(function(input) {
        return input.value.trim() !== '';
    });
    document.getElementById('step3Next').disabled = !allFilled;
}

function collectIdData() {
    var inputs = document.querySelectorAll('#idInputs input');
    formData.pixels = {};

    inputs.forEach(function(input) {
        var destination = input.dataset.destination;
        var field = input.dataset.field;

        if (field === "Pixel ID" || field === "Measurement ID") {
            formData.pixels[destination] = input.value.trim();
        }
    });
}

async function submitData() {
    collectIdData();
    showLoading();

    try {
        var response = await callBackendAPI();
        configResponse = response; 
        showFinalActions();

        // Hide Step 3 completely
        const step3 = document.getElementById("step3");
        const circle3 = document.getElementById("circle3");
        const progress3 = document.getElementById("progress3");

        step3.classList.remove('active');
        circle3.classList.remove('active');
        progress3.classList.add('completed');

        // Show Step 4 completely
        const step4 = document.getElementById("step4");
        const circle4 = document.getElementById("circle4");

        currentStep = 4;
        step4.style.display = 'block';       // ensure visible
        step4.classList.add('active');
        circle4.classList.add('active');
    } catch (error) {
        showError(error.message);
    }
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('finalActions').style.display = 'none';
    document.getElementById('finalButtons').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

// ... rest of your functions unchanged (callBackendAPI, showFinalActions, showError, downloadJSON, etc.)

async function callBackendAPI() {
    var apiEndpoint = 'http://localhost:8080/configure';
    console.log('Calling API endpoint:', apiEndpoint);

    try {
        console.log('Sending request with data:', {
            destinations: formData.destinations,
            pixels: formData.pixels
        });
        
        var response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                destinations: formData.destinations,
                pixels: formData.pixels
            })
        });

        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
            var errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "API Error: " + response.status + " - " + response.statusText);
        }

        var result = await response.json();
        console.log('API response parsed successfully:', result);
        return result;
    } catch (error) {
        console.error("Backend API error:", error);
        throw error;
    }
}

function showFinalActions() {
    console.log('showFinalActions called');
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('finalActions').style.display = 'grid';
    document.getElementById('finalButtons').style.display = 'flex';
    console.log('Final actions should now be visible');
}

function showError(message) {
    console.log('showError called with message:', message);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('finalButtons').style.display = 'flex';
}

// New function to handle file download
function downloadJSON() {
    if (!configResponse || !configResponse.output || !configResponse.output.filename) {
        alert('No configuration file available for download');
        return;
    }

    var filename = configResponse.output.filename;
    var downloadUrl = 'http://localhost:8080/download/' + encodeURIComponent(filename);
    
    // Create a temporary anchor element to trigger download
    var link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('Download initiated for:', filename);
}

// Placeholder function for auto-deploy (not implemented in backend)
function applyToGTM() {
    alert('Auto-deploy functionality is not implemented yet. Please use the Download JSON option to manually import the configuration into GTM.');
}

function cleanup() {
    var inputs = document.querySelectorAll('#idInputs input');
    inputs.forEach(function(input) {
        input.removeEventListener('input', validateStep3);
    });
    
    var cards = document.querySelectorAll('.destination-card');
    cards.forEach(function(card) {
        var checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.removeEventListener('change', null);
        }
    });
}

function validateFormData() {
    if (!formData.trackingGoal) {
        throw new Error('Tracking goal is required');
    }
    
    if (!formData.destinations || formData.destinations.length === 0) {
        throw new Error('At least one destination must be selected');
    }
    
    for (var i = 0; i < formData.destinations.length; i++) {
        var dest = formData.destinations[i];
        var config = destinationRequirements[dest];
        if (!config) continue;
        
        for (var j = 0; j < config.fields.length; j++) {
            var field = config.fields[j];
            var value = formData.pixels && formData.pixels[dest] && formData.pixels[dest][field];
            if (!value) {
                throw new Error(field + ' is required for ' + config.name);
            }
        }
    }
}

function resetWizard() {
    // Reset form data and config response
    formData = {
        trackingGoal: '',
        destinations: [],
        pixels: {}
    };
    configResponse = null;

    // Reset UI elements
    document.getElementById('trackingGoal').value = '';
    document.getElementById('step1Next').disabled = true;

    // Uncheck all destination checkboxes
    var cards = document.querySelectorAll('.destination-card');
    cards.forEach(function(card) {
        var checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = false;
            card.classList.remove('selected');
        }
    });

    // Clear ID inputs
    var idInputs = document.getElementById('idInputs');
    if (idInputs) {
        idInputs.innerHTML = '';
    }

    // Reset progress indicators
    for (var i = 1; i <= 4; i++) {
        document.getElementById("circle" + i).classList.remove('active', 'completed');
        var progressElement = document.getElementById("progress" + i);
        if (progressElement) {
            progressElement.classList.remove('completed');
        }
    }

    // Hide all steps and show step 1
    for (var k = 1; k <= 4; k++) {
        var step = document.getElementById("step" + k);
        step.classList.remove('active');
    }
    document.getElementById('step1').classList.add('active');
    document.getElementById('circle1').classList.add('active');

    // Reset current step
    currentStep = 1;

    // Hide final sections
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('finalActions').style.display = 'none';
    document.getElementById('finalButtons').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}


