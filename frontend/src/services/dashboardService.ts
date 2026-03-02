import { api } from './apiClient';

export interface DashboardResponse {
    data: {
        stats: {
            totalMessages: number;
            totalTasks: number;
            totalKnowledgeItems: number;
        };
        recentActivity: any[];
    };
}

export const dashboardService = {
    getStats: (): Promise<DashboardResponse> => {
        return api.get<DashboardResponse>('/api/dashboard/stats');
    }
};
