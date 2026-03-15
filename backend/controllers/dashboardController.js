const { successResponse, errorResponse } = require('../utils/responseHandler');
const { adminDb } = require('../config/firebaseAdmin');
const { COL, getCount } = require('../services/firebase.service');

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const chatQuery = adminDb.collection(COL.CHAT).where('user_id', '==', userId);
        const tasksQuery = adminDb.collection(COL.TASKS).where('user_id', '==', userId);
        const knowledgeQuery = adminDb.collection(COL.KNOWLEDGE).where('user_id', '==', userId);

        const [totalMessages, totalTasks, totalKnowledgeItems] = await Promise.all([
            getCount(chatQuery),
            getCount(tasksQuery),
            getCount(knowledgeQuery),
        ]);

        const recentTasksSnap = await adminDb
            .collection(COL.TASKS)
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();

        const recentActivity = recentTasksSnap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                title: data.title,
                status: data.status,
                created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
            };
        });

        successResponse(res, 'Dashboard stats retrieved', {
            stats: {
            totalMessages: totalMessages || 0,
            totalTasks: totalTasks || 0,
            totalKnowledgeItems: totalKnowledgeItems || 0
            },
          recentActivity
        });
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve dashboard stats', err.message);
    }
};

module.exports = {
    getDashboardStats
};
