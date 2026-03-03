const { supabase } = require('../config/supabase');

// ─── Chat Messages ──────────────────────────────────────────────

const saveChatMessage = async (userId, role, content) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .insert([{ user_id: userId, role, content }])
        .select();

    if (error) throw error;
    return data[0];
};

const getChatHistory = async (userId, limit = 50) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw error;
    return data;
};

const clearChatHistory = async (userId) => {
    const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', userId);

    if (error) throw error;
};

// ─── Settings ──────────────────────────────────────────────────

const getUserSettings = async (userId) => {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "row not found" error
    return data;
};

const updateUserSettings = async (userId, settings) => {
    const { data, error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, ...settings })
        .select();

    if (error) throw error;
    return data[0];
};

// ─── Tasks ─────────────────────────────────────────────────────

const getUserTasks = async (userId) => {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

const createTask = async (userId, taskData) => {
    const { data, error } = await supabase
        .from('tasks')
        .insert([{ user_id: userId, ...taskData }])
        .select();

    if (error) throw error;
    return data[0];
};

const updateTask = async (taskId, userId, taskData) => {
    const { data, error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)
        .eq('user_id', userId) // Ensure user owns the task
        .select();

    if (error) throw error;
    return data[0];
};

const deleteTask = async (taskId, userId) => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

    if (error) throw error;
};

// ─── Knowledge Base ────────────────────────────────────────────

const getKnowledgeItems = async (userId) => {
    const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

const createKnowledgeItem = async (userId, itemData) => {
    const { data, error } = await supabase
        .from('knowledge_base')
        .insert([{ user_id: userId, ...itemData }])
        .select();

    if (error) throw error;
    return data[0];
};

const deleteKnowledgeItem = async (itemId, userId) => {
    const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

    if (error) throw error;
};

module.exports = {
    saveChatMessage,
    getChatHistory,
    clearChatHistory,
    getUserSettings,
    updateUserSettings,
    getUserTasks,
    createTask,
    updateTask,
    deleteTask,
    getKnowledgeItems,
    createKnowledgeItem,
    deleteKnowledgeItem
};
