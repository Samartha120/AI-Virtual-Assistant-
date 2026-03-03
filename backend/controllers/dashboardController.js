const { supabase } = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch counts in parallel for performance
        const [chatResult, tasksResult, knowledgeResult] = await Promise.all([
            supabase
                .from('chat_messages')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId),
            supabase
                .from('tasks')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId),
            supabase
                .from('knowledge_base')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
        ]);

        // Fetch recent tasks for activity feed
        const { data: recentTasks } = await supabase
            .from('tasks')
            .select('id, title, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        successResponse(res, 'Dashboard stats retrieved', {
            stats: {
                totalMessages: chatResult.count || 0,
                totalTasks: tasksResult.count || 0,
                totalKnowledgeItems: knowledgeResult.count || 0
            },
            recentActivity: recentTasks || []
        });
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve dashboard stats', err.message);
    }
};

module.exports = {
    getDashboardStats
};
