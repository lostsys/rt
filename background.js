class RedirectRuleManager {
    constructor() {
        this.ruleSetConfigs = {
            minecraft: { id: 'minecraft_textures', startId: 1000 },
            vanilla: { id: 'vanilla_textures', startId: 2000 },
            combat: { id: 'combat_textures', startId: 3000 }
        };
        
        this.init();
    }

    init() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        this.initializeRuleSet();
    }

    async initializeRuleSet() {
        try {
            const result = await chrome.storage.local.get(['activeRuleSet']);
            const activeRuleSet = result.activeRuleSet || 'none';
            
            if (activeRuleSet !== 'none') {
                await this.switchToRuleSet(activeRuleSet);
            }
        } catch (error) {
            console.error('Failed to initialize texture pack:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            if (message.type === 'switchRuleSet') {
                const result = await this.switchToRuleSet(message.ruleSet);
                sendResponse({ success: true, result });
            } else {
                sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async switchToRuleSet(ruleSet) {
        try {
            await this.disableAllRules();

            if (ruleSet !== 'none') {
                await this.enableRuleSet(ruleSet);
            }

            this.notifyPopup(ruleSet);

            return { activeRuleSet: ruleSet };
        } catch (error) {
            console.error('Failed to switch textures:', error);
            throw new Error(`Failed to switch to ${ruleSet} textures: ${error.message}`);
        }
    }

    async disableAllRules() {
        try {
            const enabledRules = await chrome.declarativeNetRequest.getDynamicRules();
            
            if (enabledRules.length > 0) {
                const ruleIds = enabledRules.map(rule => rule.id);
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ruleIds
                });
            }

            const rulesetIds = Object.values(this.ruleSetConfigs).map(config => config.id);
            await chrome.declarativeNetRequest.updateEnabledRulesets({
                disableRulesetIds: rulesetIds
            });

        } catch (error) {
            console.error('Failed to disable textures:', error);
            throw error;
        }
    }

    async enableRuleSet(ruleSet) {
        try {
            const config = this.ruleSetConfigs[ruleSet];
            if (!config) {
                throw new Error(`Unknown textures: ${ruleSet}`);
            }

            const rules = await this.loadRuleSetFromFile(ruleSet);
            
            if (rules && rules.length > 0) {
                const dynamicRules = rules.map((rule, index) => ({
                    ...rule,
                    id: config.startId + index
                }));

                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: dynamicRules
                });
            }

            try {
                await chrome.declarativeNetRequest.updateEnabledRulesets({
                    enableRulesetIds: [config.id]
                });
            } catch (staticError) {
                console.log(`Static ${config.id} not available, using dynamic only`);
            }

        } catch (error) {
            console.error(`Failed to enable ${ruleSet}:`, error);
            throw error;
        }
    }

    async loadRuleSetFromFile(ruleSet) {
        try {
            const response = await fetch(chrome.runtime.getURL(`rules/${ruleSet}.json`));
            if (!response.ok) {
                throw new Error(`Failed to load ${ruleSet} : ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.rules || data;
        } catch (error) {
            console.error(`Failed to load textures for ${ruleSet}:`, error);
            return [];
        }
    }

    notifyPopup(ruleSet) {
        chrome.runtime.sendMessage({
            type: 'ruleSetChanged',
            ruleSet: ruleSet
        }).catch(error => {
            console.log('Popup not available');
        });
    }

    async getCurrentRuleSet() {
        try {
            const result = await chrome.storage.local.get(['activeRuleSet']);
            return result.activeRuleSet || 'none';
        } catch (error) {
            console.error('Failed to get current texture pack', error);
            return 'none';
        }
    }
}

new RedirectRuleManager();
