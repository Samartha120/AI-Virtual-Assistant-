const { getKnowledgeItems, createKnowledgeItem, deleteKnowledgeItem } = require('../services/supabase.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const getItems = async (req, res) => {
    try {
        const userId = req.user.id;
        const items = await getKnowledgeItems(userId);
        successResponse(res, 'Knowledge items retrieved', items);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve knowledge items', err.message);
    }
};

const addItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, content, tags } = req.body;

        if (!title || title.trim() === '') {
            return errorResponse(res, 400, 'Title is required');
        }
        if (!content || content.trim() === '') {
            return errorResponse(res, 400, 'Content is required');
        }

        const item = await createKnowledgeItem(userId, {
            title: title.trim(),
            content: content.trim(),
            tags: tags || []
        });

        successResponse(res, 'Knowledge item created', item);
    } catch (err) {
        errorResponse(res, 500, 'Failed to create knowledge item', err.message);
    }
};

const removeItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await deleteKnowledgeItem(id, userId);
        successResponse(res, 'Knowledge item deleted');
    } catch (err) {
        errorResponse(res, 500, 'Failed to delete knowledge item', err.message);
    }
};

module.exports = {
    getItems,
    addItem,
    removeItem
};
