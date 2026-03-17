const { getUserSettings, updateUserSettings } = require('../services/firebase.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const getSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await getUserSettings(userId);

        // Return default settings if none exist yet
        const defaultSettings = {
            theme: 'dark',
            aiMode: 'grok',             // Used by frontend Settings Panel
            ai_model: 'grok-2-latest',  // Underlying model name
            notifications: true,
            language: 'en'
        };

        successResponse(res, 'Settings retrieved', settings || defaultSettings);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve settings', err.message);
    }
};

const updateSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const newSettings = req.body;

        if (!newSettings || Object.keys(newSettings).length === 0) {
            return errorResponse(res, 400, 'No settings data provided');
        }

        const updated = await updateUserSettings(userId, newSettings);
        successResponse(res, 'Settings updated', updated);
    } catch (err) {
        errorResponse(res, 500, 'Failed to update settings', err.message);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
