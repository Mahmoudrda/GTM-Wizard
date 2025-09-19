// CSV Upload functionality with GTM API integration
console.log('CSV Upload page loaded');

// Global variables
let csvData = [];
let processedData = [];
let gtmManager = null;
let gtmConfig = {
    accountId: '',
    containerId: '',
    measurementId: '',
    accounts: [],
    containers: [],
    accessToken: ''
};

// GTM Manager class with authentication
class GTMManager {
    constructor() {
        console.log('Initializing GTMManager...');
        this.accessToken = null;
        this.isAuthenticated = false;
        this.tokenClient = null;
        this.init();
    }

    init() {
        // Initialize Google Identity Services
        google.accounts.id.initialize({
            client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com'
        });

        // Initialize OAuth2 token client
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/tagmanager.edit.containers https://www.googleapis.com/auth/tagmanager.readonly',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error('OAuth error:', response.error);
                    throw new Error(response.error);
                }
                this.handleAuthSuccess(response);
            },
        });
    }

    async authenticate() {
        console.log('Attempting GTM authentication...');
        try {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (error) {
            console.error('GTM Authentication failed:', error);
            throw new Error('GTM Authentication failed: ' + error.message);
        }
    }

    handleAuthSuccess(response) {
        console.log('GTM Authentication successful');
        this.isAuthenticated = true;
        this.accessToken = response.access_token;
        gtmConfig.accessToken = response.access_token;
        console.log('GTM Access token received');
        
        // Update UI to show authenticated state
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.innerHTML = `
                <div class="auth-success">
                    <span class="success-icon">✅</span>
                    <span>Successfully authenticated with GTM API</span>
                    <button class="btn-primary" onclick="loadGTMAccounts()">Load GTM Accounts</button>
                </div>
            `;
        }
    }

    async loadAccounts() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with GTM');
        }

        try {
            console.log('Loading GTM accounts...');
            const response = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('GTM API Error:', errorData);
                throw new Error(`Failed to load accounts: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('GTM accounts loaded:', data);
            return data.account || [];
        } catch (error) {
            console.error('Error loading GTM accounts:', error);
            throw error;
        }
    }

    async loadContainers(accountId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with GTM');
        }

        try {
            console.log(`Loading containers for account: ${accountId}`);
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('GTM API Error:', errorData);
                throw new Error(`Failed to load containers: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('GTM containers loaded:', data);
            return data.container || [];
        } catch (error) {
            console.error('Error loading GTM containers:', error);
            throw error;
        }
    }

    async createWorkspace(accountId, containerId) {
        try {
            console.log('Creating GTM workspace...');
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers/${containerId}/workspaces`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `CSV Import - ${new Date().toISOString().split('T')[0]}`,
                    description: 'Workspace created from CSV import for GA4 event configuration'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Workspace creation error:', errorData);
                throw new Error(`Failed to create workspace: ${response.status} ${response.statusText}`);
            }

            const workspace = await response.json();
            console.log('Workspace created:', workspace);
            return workspace;
        } catch (error) {
            console.error('Error creating workspace:', error);
            throw error;
        }
    }

    async createVariable(accountId, containerId, workspaceId, parameterName) {
        try {
            const variableData = {
                name: `DLV - ${parameterName}`,
                type: 'v',
                parameter: [
                    {
                        type: 'TEMPLATE',
                        key: 'name',
                        value: parameterName
                    }
                ]
            };

            console.log(`Creating variable: DLV - ${parameterName}`);
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(variableData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Variable creation error for ${parameterName}:`, errorData);
                throw new Error(`Failed to create variable ${parameterName}: ${response.status} ${response.statusText}`);
            }

            const variable = await response.json();
            console.log(`Variable created: DLV - ${parameterName}`, variable);
            return variable;
        } catch (error) {
            console.error(`Error creating variable ${parameterName}:`, error);
            throw error;
        }
    }

    async createTrigger(accountId, containerId, workspaceId, eventName) {
        try {
            const triggerData = {
                name: `CE - ${eventName}`,
                type: 'customEvent',
                customEventFilter: [
                    {
                        type: 'equals',
                        parameter: [
                            {
                                type: 'TEMPLATE',
                                key: 'arg0',
                                value: '{{_event}}'
                            },
                            {
                                type: 'TEMPLATE', 
                                key: 'arg1',
                                value: eventName
                            }
                        ]
                    }
                ]
            };

            console.log(`Creating trigger: CE - ${eventName}`);
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(triggerData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Trigger creation error for ${eventName}:`, errorData);
                throw new Error(`Failed to create trigger ${eventName}: ${response.status} ${response.statusText}`);
            }

            const trigger = await response.json();
            console.log(`Trigger created: CE - ${eventName}`, trigger);
            return trigger;
        } catch (error) {
            console.error(`Error creating trigger ${eventName}:`, error);
            throw error;
        }
    }

    async createGA4ConfigTag(accountId, containerId, workspaceId, measurementId) {
        try {
            const configTagData = {
                name: 'GA4 - Config',
                type: 'gaawc',
                parameter: [
                    {
                        type: 'TEMPLATE',
                        key: 'measurementId',
                        value: measurementId
                    }
                ],
                firingTriggerId: ['2147479553'] // All Pages trigger ID
            };

            console.log('Creating GA4 Config tag');
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(configTagData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('GA4 Config tag creation error:', errorData);
                throw new Error(`Failed to create GA4 Config tag: ${response.status} ${response.statusText}`);
            }

            const configTag = await response.json();
            console.log('GA4 Config tag created:', configTag);
            return configTag;
        } catch (error) {
            console.error('Error creating GA4 Config tag:', error);
            throw error;
        }
    }

    async createEventTag(accountId, containerId, workspaceId, eventName, parameters, triggerId, measurementId) {
        try {
            const tagParameters = [
                {
                    type: 'TEMPLATE',
                    key: 'measurementId', 
                    value: measurementId
                },
                {
                    type: 'TEMPLATE',
                    key: 'eventName',
                    value: eventName
                }
            ];

            // Add event parameters if any exist
            if (parameters && parameters.length > 0) {
                const eventParameters = parameters.map(param => ({
                    type: 'MAP',
                    map: [
                        {
                            type: 'TEMPLATE',
                            key: 'name',
                            value: param
                        },
                        {
                            type: 'TEMPLATE',
                            key: 'value',
                            value: `{{DLV - ${param}}}`
                        }
                    ]
                }));

                tagParameters.push({
                    type: 'LIST',
                    key: 'eventParameters',
                    list: eventParameters
                });
            }

            const tagData = {
                name: `GA4 - Event - ${eventName}`,
                type: 'gaawe',
                parameter: tagParameters,
                firingTriggerId: [triggerId]
            };

            console.log(`Creating event tag: GA4 - Event - ${eventName}`);
            const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tagData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Event tag creation error for ${eventName}:`, errorData);
                throw new Error(`Failed to create event tag ${eventName}: ${response.status} ${response.statusText}`);
            }

            const tag = await response.json();
            console.log(`Event tag created: GA4 - Event - ${eventName}`, tag);
            return tag;
        } catch (error) {
            console.error(`Error creating event tag ${eventName}:`, error);
            throw error;
        }
    }
}

// Initialize GTM Manager
gtmManager = new GTMManager();

// Basic file upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('csvFile');

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
    }
    
    console.log('Processing file:', file.name);
    
    // Show processing section
    document.querySelector('.upload-section').style.display = 'none';
    document.getElementById('processingSection').style.display = 'block';
    
    // Read and parse CSV file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            parseCSV(e.target.result);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            alert('Error parsing CSV file. Please check the format.');
            resetUpload();
        }
    };
    reader.readAsText(file);
}

function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Validate headers
    if (headers.length < 2 || !headers.includes('GA4 Event Name (UI)') || !headers.includes('Parameters')) {
        throw new Error('CSV must contain "GA4 Event Name (UI)" and "Parameters" columns');
    }
    
    csvData = [];
    const eventNameIndex = headers.indexOf('GA4 Event Name (UI)');
    const parametersIndex = headers.indexOf('Parameters');
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length >= 2 && row[eventNameIndex] && row[eventNameIndex].trim()) {
            const eventName = row[eventNameIndex].trim();
            const parametersString = row[parametersIndex] ? row[parametersIndex].trim() : '';
            
            // Parse parameters (space, comma, or line break separated)
            const parameters = parametersString
                .split(/[\s,\n\r]+/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            csvData.push({
                eventName: eventName,
                parameters: parameters
            });
        }
    }
    
    console.log('Parsed CSV data:', csvData);
    showConfigurationForm();
}

async function loadGTMAccounts() {
    try {
        document.querySelector('.loading-text').textContent = 'Loading GTM accounts...';
        document.getElementById('processingSection').style.display = 'block';
        
        const accounts = await gtmManager.loadAccounts();
        gtmConfig.accounts = accounts;
        
        document.getElementById('processingSection').style.display = 'none';
        updateAccountDropdown();
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        alert('Error loading GTM accounts: ' + error.message);
        document.getElementById('processingSection').style.display = 'none';
    }
}

function updateAccountDropdown() {
    const accountSelect = document.getElementById('accountSelect');
    if (accountSelect && gtmConfig.accounts.length > 0) {
        accountSelect.innerHTML = '<option value="">Select GTM Account</option>' +
            gtmConfig.accounts.map(account => 
                `<option value="${account.accountId}">${account.name} (${account.accountId})</option>`
            ).join('');
        
        accountSelect.style.display = 'block';
        accountSelect.addEventListener('change', handleAccountChange);
    }
}

async function handleAccountChange(event) {
    const accountId = event.target.value;
    if (!accountId) return;
    
    gtmConfig.accountId = accountId;
    
    try {
        document.getElementById('processingSection').style.display = 'block';
        document.querySelector('.loading-text').textContent = 'Loading containers...';
        
        const containers = await gtmManager.loadContainers(accountId);
        gtmConfig.containers = containers;
        
        document.getElementById('processingSection').style.display = 'none';
        updateContainerDropdown();
        
    } catch (error) {
        console.error('Error loading containers:', error);
        alert('Error loading containers: ' + error.message);
        document.getElementById('processingSection').style.display = 'none';
    }
}

function updateContainerDropdown() {
    const containerSelect = document.getElementById('containerSelect');
    if (containerSelect && gtmConfig.containers.length > 0) {
        containerSelect.innerHTML = '<option value="">Select GTM Container</option>' +
            gtmConfig.containers.map(container => 
                `<option value="${container.containerId}">${container.name} (${container.containerId})</option>`
            ).join('');
        
        containerSelect.style.display = 'block';
        containerSelect.addEventListener('change', (event) => {
            gtmConfig.containerId = event.target.value;
            toggleCreateButton();
        });
    }
}

function toggleCreateButton() {
    const createBtn = document.getElementById('createConfigBtn');
    const measurementId = document.getElementById('measurementId').value.trim();
    
    if (createBtn && gtmConfig.accountId && gtmConfig.containerId && measurementId) {
        createBtn.disabled = false;
        createBtn.style.opacity = '1';
    }
}

function showConfigurationForm() {
    // Hide processing section and show configuration form
    document.getElementById('processingSection').style.display = 'none';
    
    // Create configuration form HTML
    const configFormHTML = `
        <div class="config-section" id="configSection">
            <h2>GTM Configuration</h2>
            <p class="subtitle">Authenticate with GTM API and configure your setup</p>
            
            <div class="config-form">
                <div class="form-group" id="authSection">
                    <label>GTM API Authentication:</label>
                    <button class="btn-primary" onclick="gtmManager.authenticate()">Authenticate with GTM</button>
                    <small>You need to authenticate with Google Tag Manager API</small>
                </div>
                
                <div class="form-group">
                    <label for="accountSelect">GTM Account:</label>
                    <select id="accountSelect" style="display: none;">
                        <option value="">Select GTM Account</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="containerSelect">GTM Container:</label>
                    <select id="containerSelect" style="display: none;">
                        <option value="">Select GTM Container</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="measurementId">GA4 Measurement ID:</label>
                    <input type="text" id="measurementId" placeholder="G-XXXXXXXXXX" required onchange="toggleCreateButton()">
                </div>
                
                <div class="buttons">
                    <button class="btn-secondary" onclick="resetUpload()">Cancel</button>
                    <button class="btn-primary" id="createConfigBtn" onclick="processGTMConfiguration()" disabled style="opacity: 0.5;">Create GTM Configuration</button>
                </div>
            </div>
            
            <div class="csv-preview">
                <h3>Parsed Events (${csvData.length})</h3>
                <div class="preview-list">
                    ${csvData.map(item => `
                        <div class="preview-item">
                            <strong>${item.eventName}</strong>
                            <div class="parameters">Parameters: ${item.parameters.join(', ')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Insert configuration form
    const mainContent = document.querySelector('.wizard-container');
    mainContent.insertAdjacentHTML('beforeend', configFormHTML);
}

async function processGTMConfiguration() {
    // Get configuration values
    gtmConfig.measurementId = document.getElementById('measurementId').value.trim();
    
    // Validate inputs
    if (!gtmConfig.accountId || !gtmConfig.containerId || !gtmConfig.measurementId || !gtmManager.isAuthenticated) {
        alert('Please complete all authentication and configuration steps');
        return;
    }
    
    // Show processing
    document.getElementById('configSection').style.display = 'none';
    document.getElementById('processingSection').style.display = 'block';
    document.querySelector('.loading-text').textContent = 'Creating GTM workspace and configurations...';
    
    try {
        await createGTMConfiguration();
        showResults();
    } catch (error) {
        console.error('Error creating GTM configuration:', error);
        alert('Error creating GTM configuration: ' + error.message);
        resetUpload();
    }
}

async function createGTMConfiguration() {
    processedData = {
        workspace: null,
        configTag: null,
        variables: [],
        triggers: [],
        tags: [],
        errors: [],
        createdVariables: new Map(), // Track created variables to avoid duplicates
        createdTriggers: new Map() // Track created triggers to avoid duplicates
    };
    
    try {
        // Step 1: Create workspace
        const workspace = await gtmManager.createWorkspace(gtmConfig.accountId, gtmConfig.containerId);
        processedData.workspace = workspace;
        const workspaceId = workspace.workspaceId;
        
        // Step 2: Create GA4 Config tag
        try {
            const configTag = await gtmManager.createGA4ConfigTag(
                gtmConfig.accountId, 
                gtmConfig.containerId, 
                workspaceId, 
                gtmConfig.measurementId
            );
            processedData.configTag = configTag;
        } catch (error) {
            processedData.errors.push(`Failed to create GA4 Config tag: ${error.message}`);
        }
        
        // Step 3: Get all unique parameters to avoid duplicates
        const allParameters = [...new Set(csvData.flatMap(item => item.parameters))];
        
        // Step 4: Create variables for all unique parameters
        for (const parameter of allParameters) {
            try {
                const variable = await gtmManager.createVariable(
                    gtmConfig.accountId,
                    gtmConfig.containerId,
                    workspaceId,
                    parameter
                );
                processedData.variables.push(variable);
                processedData.createdVariables.set(parameter, variable);
            } catch (error) {
                processedData.errors.push(`Failed to create variable for ${parameter}: ${error.message}`);
            }
        }
        
        // Step 5: Process each unique event (avoid duplicate triggers)
        const uniqueEvents = [...new Map(csvData.map(item => [item.eventName, item])).values()];
        
        for (const eventData of uniqueEvents) {
            try {
                // Create trigger for this event
                const trigger = await gtmManager.createTrigger(
                    gtmConfig.accountId,
                    gtmConfig.containerId,
                    workspaceId,
                    eventData.eventName
                );
                processedData.triggers.push(trigger);
                processedData.createdTriggers.set(eventData.eventName, trigger);
                
                // Create event tag
                const tag = await gtmManager.createEventTag(
                    gtmConfig.accountId,
                    gtmConfig.containerId,
                    workspaceId,
                    eventData.eventName,
                    eventData.parameters,
                    trigger.triggerId,
                    gtmConfig.measurementId
                );
                processedData.tags.push(tag);
                
            } catch (error) {
                processedData.errors.push(`Failed to process event ${eventData.eventName}: ${error.message}`);
            }
        }
        
        console.log('GTM Configuration completed successfully');
        
    } catch (error) {
        console.error('GTM Configuration failed:', error);
        processedData.errors.push(`Configuration failed: ${error.message}`);
        throw error;
    }
}

function showResults() {
    // Hide processing section
    document.getElementById('processingSection').style.display = 'none';
    
    // Update results section
    document.getElementById('recordCount').textContent = csvData.length;
    document.getElementById('validCount').textContent = processedData.tags.length;
    document.getElementById('invalidCount').textContent = processedData.errors.length;
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Add detailed results
    const resultsSection = document.getElementById('resultsSection');
    const detailedResults = `
        <div class="detailed-results">
            <h3>Configuration Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Workspace:</strong> ${processedData.workspace ? processedData.workspace.name : 'Failed to create'}
                </div>
                <div class="summary-item">
                    <strong>GA4 Config Tag:</strong> ${processedData.configTag ? 'Created' : 'Failed'}
                </div>
                <div class="summary-item">
                    <strong>Variables Created:</strong> ${processedData.variables.length}
                </div>
                <div class="summary-item">
                    <strong>Triggers Created:</strong> ${processedData.triggers.length}
                </div>
                <div class="summary-item">
                    <strong>Event Tags Created:</strong> ${processedData.tags.length}
                </div>
            </div>
            
            ${processedData.workspace ? `
                <div class="workspace-link">
                    <p><strong>Workspace URL:</strong></p>
                    <a href="https://tagmanager.google.com/#/container/accounts/${gtmConfig.accountId}/containers/${gtmConfig.containerId}/workspaces/${processedData.workspace.workspaceId}" 
                       target="_blank" class="btn-link">
                        Open in GTM → ${processedData.workspace.name}
                    </a>
                </div>
            ` : ''}
            
            ${processedData.errors.length > 0 ? `
                <div class="errors-section">
                    <h4>Errors (${processedData.errors.length}):</h4>
                    <ul>
                        ${processedData.errors.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    
    resultsSection.insertAdjacentHTML('beforeend', detailedResults);
}

function resetUpload() {
    // Hide all sections except upload
    document.getElementById('processingSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    const configSection = document.getElementById('configSection');
    if (configSection) {
        configSection.remove();
    }
    
    // Show upload section
    document.querySelector('.upload-section').style.display = 'block';
    
    // Reset form and data
    fileInput.value = '';
    csvData = [];
    processedData = [];
    gtmConfig = {
        accountId: '',
        containerId: '',
        measurementId: '',
        accounts: [],
        containers: [],
        accessToken: ''
    };
}

function downloadProcessed() {
    if (!processedData.workspace) {
        alert('No processed data available to download');
        return;
    }
    
    // Create comprehensive summary report
    const report = {
        workspace: {
            id: processedData.workspace.workspaceId,
            name: processedData.workspace.name,
            url: `https://tagmanager.google.com/#/container/accounts/${gtmConfig.accountId}/containers/${gtmConfig.containerId}/workspaces/${processedData.workspace.workspaceId}`
        },
        configuration: {
            accountId: gtmConfig.accountId,
            containerId: gtmConfig.containerId,
            measurementId: gtmConfig.measurementId,
            timestamp: new Date().toISOString()
        },
        summary: {
            totalEvents: csvData.length,
            uniqueEvents: processedData.triggers.length,
            variablesCreated: processedData.variables.length,
            triggersCreated: processedData.triggers.length,
            tagsCreated: processedData.tags.length,
            ga4ConfigTag: processedData.configTag ? 'Created' : 'Failed',
            errors: processedData.errors.length
        },
        details: {
            variables: processedData.variables.map(v => ({ 
                id: v.variableId, 
                name: v.name,
                parameter: v.parameter?.find(p => p.key === 'name')?.value
            })),
            triggers: processedData.triggers.map(t => ({ 
                id: t.triggerId, 
                name: t.name,
                eventName: t.name.replace('CE - ', '')
            })),
            tags: processedData.tags.map(tag => ({ 
                id: tag.tagId, 
                name: tag.name,
                eventName: tag.name.replace('GA4 - Event - ', '')
            })),
            errors: processedData.errors
        },
        originalData: csvData
    };
    
    // Download as JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-configuration-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}