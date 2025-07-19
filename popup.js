class RedirectRuleSwitcher {
    constructor() {
        this.currentRuleSet = 'none';
        this.isLoading = false;
        this.init();
    }

    async init() {
        await this.loadCurrentState();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadCurrentState() {
        try {
            const result = await chrome.storage.local.get(['activeRuleSet']);
            this.currentRuleSet = result.activeRuleSet || 'none';
            
            const radioButton = document.querySelector(`input[value="${this.currentRuleSet}"]`);
            if (radioButton) {
                radioButton.checked = true;
            }
        } catch (error) {
            console.error('Failed to load current state:', error);
            this.showError('Failed to load current settings');
        }
    }

    setupEventListeners() {
        const radioButtons = document.querySelectorAll('input[name="ruleSet"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleRuleSetSelection(radio.value);
            });
        });

        const applyButton = document.getElementById('applyButton');
        applyButton.addEventListener('click', () => {
            this.applyRuleSet();
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'ruleSetChanged') {
                this.currentRuleSet = message.ruleSet;
                this.updateUI();
            }
        });
    }

    handleRuleSetSelection(selectedRuleSet) {
        const applyButton = document.getElementById('applyButton');
        
        if (selectedRuleSet !== this.currentRuleSet) {
            applyButton.disabled = false;
            applyButton.textContent = 'Apply Changes';
        } else {
            applyButton.disabled = true;
        }

        this.hideError();
    }

    async applyRuleSet() {
        if (this.isLoading) return;

        const selectedRuleSet = document.querySelector('input[name="ruleSet"]:checked').value;
        
        this.setLoading(true);
        this.hideError();

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'switchRuleSet',
                ruleSet: selectedRuleSet
            });

            if (response.success) {
                this.currentRuleSet = selectedRuleSet;
                
                await chrome.storage.local.set({ activeRuleSet: selectedRuleSet });
                
                this.updateUI();
                this.showSuccess('Success! Refresh the page!');
            } else {
                throw new Error(response.error || 'Failed to switch textures');
            }
        } catch (error) {
            console.error('Failed to apply textures:', error);
            this.showError(error.message || 'Failed to apply textures');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const applyButton = document.getElementById('applyButton');
        const statusDot = document.getElementById('statusDot');
        
        if (loading) {
            applyButton.classList.add('loading');
            applyButton.disabled = true;
            statusDot.classList.add('loading');
        } else {
            applyButton.classList.remove('loading');
            statusDot.classList.remove('loading');
        }
    }

    updateUI() {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        const applyButton = document.getElementById('applyButton');

        statusDot.classList.remove('active', 'error');
        
        if (this.currentRuleSet === 'none') {
            statusText.textContent = 'No textures active';
        } else {
            statusText.textContent = `${this.currentRuleSet.charAt(0).toUpperCase() + this.currentRuleSet.slice(1)} textures active`;
            statusDot.classList.add('active');
        }

        const selectedRuleSet = document.querySelector('input[name="ruleSet"]:checked').value;
        applyButton.disabled = selectedRuleSet === this.currentRuleSet || this.isLoading;
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const statusDot = document.getElementById('statusDot');
        
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        statusDot.classList.add('error');
    }

    hideError() {
        const errorMessage = document.getElementById('errorMessage');
        const statusDot = document.getElementById('statusDot');
        
        errorMessage.style.display = 'none';
        statusDot.classList.remove('error');
    }

    showSuccess(message) {
        const existingSuccess = document.querySelectorAll('.success-message');
        existingSuccess.forEach(el => el.remove());

        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
            successDiv.style.cssText = `
            margin: 16px;
            padding: 12px 16px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 6px;
            color: #155724;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        successDiv.innerHTML = `<span>✓</span><span>${message}</span>`;

        const actionsDiv = document.querySelector('.actions');
        actionsDiv.parentNode.insertBefore(successDiv, actionsDiv.nextSibling);

        setTimeout(() => {
            successDiv.remove();
        }, 4000);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    new RedirectRuleSwitcher();
});
