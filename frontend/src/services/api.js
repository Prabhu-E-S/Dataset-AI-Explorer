import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    timeout: 60000, // 60 seconds timeout for large files processing
});

export const getDatasets = async () => {
    const response = await api.get('/api/datasets');
    return response.data;
};

export const getDataset = async (id) => {
    const response = await api.get(`/api/datasets/${id}`);
    return response.data;
};

export const getDatasetProfile = async (id) => {
    const response = await api.get(`/api/datasets/${id}/profile`);
    return response.data;
};

export const getDatasetPreview = async (id) => {
    const response = await api.get(`/api/datasets/${id}/preview`);
    return response.data;
};

export const deleteDataset = async (id) => {
    const response = await api.delete(`/api/datasets/${id}`);
    return response.data;
};

export const uploadDataset = async (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/datasets/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (onUploadProgress && progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onUploadProgress(percentCompleted);
            }
        },
    });
    return response.data;
};

export const getDatasetSummary = async (id) => {
    const response = await api.post(`/api/datasets/${id}/summary`);
    return response.data;
};

export const sendChatMessage = async (id, message, sessionId = null) => {
    const response = await api.post(`/api/datasets/${id}/chat`, { message, session_id: sessionId });
    return response.data;
};

export const sendChatVisualizeMessage = async (id, message, sessionId = null) => {
    const response = await api.post(`/api/datasets/${id}/visualize`, { message, session_id: sessionId });
    return response.data;
};

export const getChatHistory = async (id) => {
    const response = await api.get(`/api/datasets/${id}/chat/history`);
    return response.data;
};

export const deleteChatHistory = async (id) => {
    const response = await api.delete(`/api/datasets/${id}/chat/history`);
    return response.data;
};

export const getDashboardSummary = async () => {
    const response = await api.get('/api/dashboard');
    return response.data;
};

export const getActivityLogs = async () => {
    const response = await api.get('/api/activity');
    return response.data;
};

export const getNotifications = async () => {
    const response = await api.get('/api/notifications');
    return response.data;
};

export const markAllNotificationsRead = async () => {
    const response = await api.post('/api/notifications/read');
    return response.data;
};

export const getDatasetVersions = async (datasetId) => {
    const response = await api.get(`/api/versions/${datasetId}`);
    return response.data;
};

export const restoreDatasetVersion = async (versionId) => {
    const response = await api.post('/api/restore-version', { version_id: versionId });
    return response.data;
};

export const getAutoMLRecommendation = async (datasetId) => {
    const response = await api.get(`/api/datasets/${datasetId}/automl-recommend`);
    return response.data;
};

export const trainMLModel = async (datasetId, targetColumn, algorithm, featureColumns) => {
    const response = await api.post('/api/train-model', {
        dataset_id: datasetId,
        target_column: targetColumn,
        algorithm,
        feature_columns: featureColumns
    });
    return response.data;
};

export const executePredictiveAnalytics = async (datasetId, targetColumn, algorithm, featureColumns) => {
    const response = await api.post('/api/predict', {
        dataset_id: datasetId,
        target_column: targetColumn,
        algorithm,
        feature_columns: featureColumns
    });
    return response.data;
};

export const generateBusinessReport = async (datasetId, title) => {
    const response = await api.post('/api/generate-report', {
        dataset_id: datasetId,
        title
    });
    return response.data;
};

export const listAnalyticsReports = async () => {
    const response = await api.get('/api/reports');
    return response.data;
};

export const getAnalyticsReportDetails = async (id) => {
    const response = await api.get(`/api/reports/${id}`);
    return response.data;
};

export const getDownloadReportUrl = (formatType, id) => {
    return `${api.defaults.baseURL || ''}/api/reports/download/${formatType}/${id}`;
};

export const getQualityReport = async (datasetId) => {
    const response = await api.post('/api/quality-report', { dataset_id: datasetId });
    return response.data;
};

export const cleanDatasetChat = async (datasetId, message) => {
    const response = await api.post('/api/clean', { dataset_id: datasetId, message });
    return response.data;
};

export const applyCleaningPipeline = async (datasetId, operations) => {
    const response = await api.post(`/api/datasets/${datasetId}/apply-cleaning`, { operations });
    return response.data;
};

export const getCleaningHistory = async (datasetId) => {
    const response = await api.get(`/api/cleaning/history/${datasetId}`);
    return response.data;
};

export const getDownloadCleanReportUrl = (datasetId) => {
    return `${api.defaults.baseURL || ''}/api/datasets/download/report/${datasetId}`;
};

export const getDownloadUrl = (format, datasetId) => {
    return `${api.defaults.baseURL || ''}/api/datasets/download/${format}/${datasetId}`;
};

export default {
    getDatasets,
    getDataset,
    getDatasetProfile,
    getDatasetPreview,
    deleteDataset,
    uploadDataset,
    getDatasetSummary,
    sendChatMessage,
    sendChatVisualizeMessage,
    getChatHistory,
    deleteChatHistory,
    getDashboardSummary,
    getActivityLogs,
    getNotifications,
    markAllNotificationsRead,
    getDatasetVersions,
    restoreDatasetVersion,
    getAutoMLRecommendation,
    trainMLModel,
    executePredictiveAnalytics,
    generateBusinessReport,
    listAnalyticsReports,
    getAnalyticsReportDetails,
    getDownloadReportUrl,
    getQualityReport,
    cleanDatasetChat,
    applyCleaningPipeline,
    getCleaningHistory,
    getDownloadCleanReportUrl,
    getDownloadUrl,
};

