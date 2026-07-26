import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiDatabase,
    FiFileText,
    FiList,
    FiGrid,
    FiAlertCircle,
    FiTrash2,
    FiCompass,
    FiActivity,
    FiMessageSquare,
    FiTrendingUp,
    FiPieChart,
    FiLayers,
    FiBell,
    FiSettings,
    FiDownload,
    FiPlay,
    FiCpu,
    FiCalendar,
    FiCheckCircle,
    FiRefreshCw
} from 'react-icons/fi';
import {
    getDatasetProfile,
    getDatasetPreview,
    deleteDataset,
    getDatasetSummary,
    getChatHistory,
    sendChatMessage,
    deleteChatHistory,
    getQualityReport,
    cleanDatasetChat,
    applyCleaningPipeline,
    getAutoMLRecommendation,
    trainMLModel,
    executePredictiveAnalytics,
    generateBusinessReport,
    listAnalyticsReports,
    getAnalyticsReportDetails,
    getDownloadReportUrl,
    getDatasetVersions,
    restoreDatasetVersion
} from '../services/api';
import DatasetPreviewTable from '../components/DatasetPreviewTable';
import ColumnExplorer from '../components/ColumnExplorer';
import ChatInterface from '../components/ChatInterface';

const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function DatasetDashboard({ onDatasetDeleted }) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'profiling' | 'ai_analyst'
    const [selectedColumn, setSelectedColumn] = useState(null);

    // AI Chat & Sidebar variables scope
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [isChatProcessing, setIsChatProcessing] = useState(false);
    const [chatStatusText, setChatStatusText] = useState('');
    const [chatSessionId, setChatSessionId] = useState(null);

    // Phase 4 Analytics Platform States
    const [datasetVersions, setDatasetVersions] = useState([]);
    const [showVersions, setShowVersions] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showCtrlK, setShowCtrlK] = useState(false);
    const [settingsConfig, setSettingsConfig] = useState({
        darkMode: true,
        apiKey: localStorage.getItem('GEMINI_API_KEY') || '••••••••••••••••',
        chartStyle: 'glassmorphism',
        language: 'en'
    });

    // ML States
    const [targetCol, setTargetCol] = useState('');
    const [algorithm, setAlgorithm] = useState('Random Forest');
    const [featureCols, setFeatureCols] = useState([]);
    const [isTraining, setIsTraining] = useState(false);
    const [trainedModel, setTrainedModel] = useState(null);
    const [isPredicting, setIsPredicting] = useState(false);
    const [predictionOutput, setPredictionOutput] = useState(null);
    const [automlRecommendation, setAutomlRecommendation] = useState(null);
    const [loadingAutoML, setLoadingAutoML] = useState(false);

    // BI Report States
    const [reportTitle, setReportTitle] = useState('Executive Insights Report');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportsList, setReportsList] = useState([]);
    const [activeReport, setActiveReport] = useState(null);

    useEffect(() => {
        let active = true;

        const fetchDatasetData = async () => {
            setLoading(true);
            setError(null);
            try {
                const profileData = await getDatasetProfile(id);
                const previewData = await getDatasetPreview(id);

                if (active) {
                    setProfile(profileData);
                    setPreview(previewData);
                    // Set first column as default selected for profiling details
                    const firstCol = profileData.profile_data?.column_lists?.all?.[0];
                    setSelectedColumn(firstCol || null);
                }
            } catch (err) {
                console.error(err);
                if (active) {
                    setError(err.response?.data?.detail || 'Failed to fetch dataset analysis. The file may be missing on the server.');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchDatasetData();
        return () => {
            active = false;
        };
    }, [id]);

    // Handle session loading and summary retrieval when user selects 'ai_analyst' tab
    useEffect(() => {
        if (activeTab === 'ai_analyst' && id) {
            const loadSessionData = async () => {
                setIsChatProcessing(true);
                setChatStatusText('🧠 Resolving active chat history...');
                try {
                    const history = await getChatHistory(id);
                    if (history && history.length > 0) {
                        setChatMessages(history);
                        // Save last message's session ID if available
                        if (history[0].session_id) {
                            setChatSessionId(history[0].session_id);
                        }
                    } else {
                        // Generate welcome summary automatically
                        setChatStatusText('🧠 Executing dataset profiling summary...');
                        const summaryData = await getDatasetSummary(id);
                        setChatMessages([{
                            id: Math.random().toString(),
                            role: 'assistant',
                            content: summaryData.summary,
                            type: 'text',
                            timestamp: new Date().toISOString()
                        }]);
                    }
                } catch (err) {
                    console.error('Failed to load chat workspace context:', err);
                    setChatMessages([{
                        id: Math.random().toString(),
                        role: 'assistant',
                        content: `I could not load initial dataset stats automatically: ${err.message}. Ask any question to begin.`,
                        type: 'text',
                        timestamp: new Date().toISOString()
                    }]);
                } finally {
                    setIsChatProcessing(false);
                    setChatStatusText('');
                }
            };
            loadSessionData();
        }
    }, [activeTab, id]);

    // Phase 4 Analytics platform data loading
    useEffect(() => {
        if (!id) return;
        const loadInitialPlatformData = async () => {
            try {
                // Load notifications
                const notifs = await getNotifications();
                setNotifications(notifs);

                // Load dataset versions
                const vers = await getDatasetVersions(id);
                setDatasetVersions(vers);

                // Load business reports
                const reports = await listAnalyticsReports();
                setReportsList(reports.filter(r => r.dataset_id === id));
            } catch (err) {
                console.error("Failed to load Phase 4 components data: ", err);
            }
        };
        loadInitialPlatformData();
    }, [id]);

    const handleFetchAutoML = async () => {
        setLoadingAutoML(true);
        try {
            const recommendation = await getAutoMLRecommendation(id);
            setAutomlRecommendation(recommendation);
            setTargetCol(recommendation.recommended_target || '');
            setFeatureCols(recommendation.features_recommended || []);
        } catch (err) {
            console.error("Failed to parse AutoML recommendations: ", err);
            alert("AutoML Analysis failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingAutoML(false);
        }
    };

    const handleTrainModel = async () => {
        if (!targetCol) {
            alert("Please select a target column first!");
            return;
        }
        setIsTraining(true);
        setTrainedModel(null);
        setPredictionOutput(null);
        try {
            const modelResult = await trainMLModel(id, targetCol, algorithm, featureCols);
            setTrainedModel(modelResult);

            // Log new activity notification
            const notifs = await getNotifications();
            setNotifications(notifs);
        } catch (err) {
            console.error("Model training failed: ", err);
            alert("Model training failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsTraining(false);
        }
    };

    const handleRunPrediction = async () => {
        if (!targetCol) return;
        setIsPredicting(true);
        setPredictionOutput(null);
        try {
            const predResult = await executePredictiveAnalytics(id, targetCol, algorithm, featureCols);
            setPredictionOutput(predResult);

            // Reload versions and notifications since predictive outputs created a new version
            const vers = await getDatasetVersions(id);
            setDatasetVersions(vers);
            const notifs = await getNotifications();
            setNotifications(notifs);
        } catch (err) {
            console.error("Prediction run failed: ", err);
            alert("Predictive analytics failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsPredicting(false);
        }
    };

    const handleRestoreVersion = async (versionId) => {
        if (!window.confirm("Are you sure you want to restore this dataset version? The active workspace data will revert to this state.")) return;
        try {
            await restoreDatasetVersion(versionId);
            alert("Dataset version restored successfully!");

            // Reload preview and profiles
            const profileData = await getDatasetProfile(id);
            const previewData = await getDatasetPreview(id);
            setProfile(profileData);
            setPreview(previewData);

            const vers = await getDatasetVersions(id);
            setDatasetVersions(vers);
            setShowVersions(false);
        } catch (err) {
            console.error("Version restore failed: ", err);
            alert("Restore failed: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const newReport = await generateBusinessReport(id, reportTitle);
            setActiveReport(newReport);

            // Reload reports list and notifications
            const reports = await listAnalyticsReports();
            setReportsList(reports.filter(r => r.dataset_id === id));

            const notifs = await getNotifications();
            setNotifications(notifs);
        } catch (err) {
            console.error("Report generation failed: ", err);
            alert("Report compilation failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleSendMessage = async (text) => {
        if (!text.trim() || isChatProcessing) return;
        setIsChatProcessing(true);

        // Optimistic UI update: add user request immediately
        const userMsg = {
            id: Math.random().toString(),
            role: 'user',
            content: text,
            type: 'text',
            timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, userMsg]);

        const textLower = text.trim().toLowerCase();

        try {
            if (textLower === 'quality report') {
                setChatStatusText('🔍 Running dataset quality inspection scanner...');
                const res = await getQualityReport(id);
                setChatMessages(prev => [...prev, {
                    id: Math.random().toString(),
                    role: 'assistant',
                    content: 'I have compiled a comprehensive dataset quality report details summarizing all schema defects and anomalies.',
                    type: 'quality_report',
                    data: res,
                    timestamp: new Date().toISOString()
                }]);
            } else if (textLower === 'clean dataset' || textLower === 'clean my dataset' || textLower === 'clean dataset') {
                setChatStatusText('🤖 Querying Gemini for data cleaning strategies...');
                const res = await cleanDatasetChat(id, text);
                setChatMessages(prev => [...prev, {
                    id: Math.random().toString(),
                    role: 'assistant',
                    content: res.message,
                    type: 'clean_recommend',
                    timestamp: new Date().toISOString()
                }]);
            } else {
                setChatStatusText('🧠 Filtering query intent...');
                const stateTimers = [
                    setTimeout(() => setChatStatusText('💾 Executing sandboxed Pandas calculations...'), 600),
                    setTimeout(() => setChatStatusText('📊 Generating chart layout specification...'), 1200)
                ];

                const response = await sendChatMessage(id, text, chatSessionId);
                stateTimers.forEach(clearTimeout);

                setChatMessages(prev => [...prev, {
                    id: Math.random().toString(),
                    role: 'assistant',
                    content: response.message,
                    type: response.type,
                    chart_data: response.chart,
                    insights: response.insights,
                    timestamp: new Date().toISOString()
                }]);

                if (response.session_id) {
                    setChatSessionId(response.session_id);
                }
            }
        } catch (err) {
            console.error('AI chat endpoint call failed:', err);
            setChatMessages(prev => [...prev, {
                id: Math.random().toString(),
                role: 'assistant',
                content: `Sorry, I encountered an issue: ${err.response?.data?.detail || err.message}`,
                type: 'text',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsChatProcessing(false);
            setChatStatusText('');
        }
    };

    const handleApplyCleaning = async (operations) => {
        if (isChatProcessing) return;
        setIsChatProcessing(true);
        setChatStatusText('⚙️ Initializing Modular Cleaning Pipeline...');

        // Add user response bubble optimistically
        setChatMessages(prev => [...prev, {
            id: Math.random().toString(),
            role: 'user',
            content: 'Apply dataset cleaning configurations.',
            type: 'text',
            timestamp: new Date().toISOString()
        }]);

        // Place timeline animation loading card
        const timelineId = Math.random().toString();
        setChatMessages(prev => [...prev, {
            id: timelineId,
            role: 'assistant',
            content: '',
            type: 'cleaning_timeline',
            timestamp: new Date().toISOString()
        }]);

        try {
            // Apply cleaning pipeline API
            const result = await applyCleaningPipeline(id, operations);

            // Wait 5.5s so user can witness the modular steps timeline animation cleanly
            await new Promise(resolve => setTimeout(resolve, 5500));

            // Replace step template with results card
            setChatMessages(prev => prev.map(m => m.id === timelineId ? {
                id: timelineId,
                role: 'assistant',
                content: 'I have finished data cleaning and updated your active workspace with optimized values. You can export the files below.',
                type: 'cleaning_results',
                data: result,
                timestamp: new Date().toISOString()
            } : m));

            // Reload dataset profile and previews to show updated details in sidebar & table
            try {
                const profileData = await getDatasetProfile(id);
                const previewData = await getDatasetPreview(id);
                setProfile(profileData);
                setPreview(previewData);
                const firstCol = profileData.profile_data?.column_lists?.all?.[0];
                setSelectedColumn(firstCol || null);
            } catch (reloadErr) {
                console.error("Could not hot-reload profiles: ", reloadErr);
            }

        } catch (err) {
            console.error('Data cleaning error:', err);
            setChatMessages(prev => prev.map(m => m.id === timelineId ? {
                id: timelineId,
                role: 'assistant',
                content: `Failed to execute data cleaning pipeline: ${err.response?.data?.detail || err.message}`,
                type: 'text',
                timestamp: new Date().toISOString()
            } : m));
        } finally {
            setIsChatProcessing(false);
            setChatStatusText('');
        }
    };

    const handleClearChatHistory = async () => {
        if (window.confirm('Delete all messages in this conversation session? This cannot be undone.')) {
            setIsChatProcessing(true);
            setChatStatusText('🧹 Cleaning session details...');
            try {
                await deleteChatHistory(id);
                setChatMessages([]);
                setChatSessionId(null);

                // Re-trigger summary welcome message automatically
                setChatStatusText('🧠 Re-profiling summary details...');
                const summaryData = await getDatasetSummary(id);
                setChatMessages([{
                    id: Math.random().toString(),
                    role: 'assistant',
                    content: summaryData.summary,
                    type: 'text',
                    timestamp: new Date().toISOString()
                }]);
            } catch (err) {
                console.error(err);
                alert('Could not clear history: ' + (err.response?.data?.detail || err.message));
            } finally {
                setIsChatProcessing(false);
                setChatStatusText('');
            }
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to permanently delete dataset "${profile.original_filename}"?`)) {
            try {
                await deleteDataset(id);
                if (onDatasetDeleted) {
                    onDatasetDeleted(id);
                }
                navigate('/');
            } catch (err) {
                alert(err.response?.data?.detail || 'Failed to delete dataset.');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="h-10 w-10 border-4 border-brand-primary border-t-transparent rounded-full mb-4"
                />
                <p className="text-xs text-brand-muted font-bold tracking-wider uppercase animate-pulse">
                    Parsing profiling insights...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                <FiAlertCircle className="text-red-400 text-5xl mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Failed to load workspace</h3>
                <p className="text-xs text-brand-muted mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-5 py-2.5 bg-brand-card hover:bg-brand-hover text-white text-xs font-semibold rounded-xl border border-brand-border transition-all active:scale-95 animate-pulse"
                >
                    Return to Upload
                </button>
            </div>
        );
    }

    const { original_filename, file_type, rows, columns, file_size, upload_time, profile_data } = profile;

    return (
        <div className="flex-1 flex flex-col overflow-hidden select-none p-6 gap-6">

            {/* 1. Header workspace meta */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start border-b border-brand-border/60 pb-5">
                <div className="text-left w-full sm:w-auto">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
                            <FiFileText className="text-lg" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-2xl font-black text-white truncate max-w-lg" title={original_filename}>
                                {original_filename}
                            </h2>
                            <span className="text-[10px] text-brand-muted font-medium flex items-center gap-1.5 mt-0.5">
                                Saved {new Date(upload_time).toLocaleString()} • {file_type.toUpperCase()} File
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
                    {/* Command Palette Indicator */}
                    <button
                        onClick={() => setShowCtrlK(true)}
                        className="flex items-center gap-2 bg-brand-card/30 hover:bg-brand-hover text-brand-text border border-brand-border px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                        <span>Actions</span>
                        <kbd className="bg-brand-bg px-1.5 py-0.5 rounded border border-brand-border text-[9px] font-mono">Ctrl+K</kbd>
                    </button>

                    {/* Version history button */}
                    <button
                        onClick={() => setShowVersions(true)}
                        className="flex items-center gap-2 bg-brand-card/30 hover:bg-brand-hover text-brand-text border border-brand-border px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                        title="Version Workspace History"
                    >
                        <FiLayers size={14} className="text-brand-accent animate-pulse" />
                        <span>Versions</span>
                    </button>

                    {/* Notifications center dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(prev => !prev)}
                            className="p-2.5 bg-brand-card/30 hover:bg-brand-hover text-brand-text border border-brand-border rounded-xl cursor-pointer relative"
                            title="Notifications Feed Alerts"
                        >
                            <FiBell size={14} className={notifications.some(n => !n.read) ? "text-amber-400 animate-bounce" : "text-brand-muted"} />
                            {notifications.some(n => !n.read) && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 text-brand-bg text-[9px] font-black rounded-full flex items-center justify-center">
                                    {notifications.filter(n => !n.read).length}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown panel */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-2.5 w-72 bg-brand-sidebar border border-brand-border rounded-2xl shadow-xl z-50 p-3.5 flex flex-col gap-2.5 text-left">
                                <div className="flex justify-between items-center border-b border-brand-border/60 pb-2">
                                    <h4 className="text-[10px] uppercase font-bold text-white tracking-wider flex items-center gap-1.5">
                                        <FiBell className="text-amber-400" />
                                        <span>Workspace Feed Alerts</span>
                                    </h4>
                                    {notifications.some(n => !n.read) && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // For mock/backend support, we can clear locally or hit api
                                                    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }}
                                            className="text-[9px] text-brand-primary font-bold hover:underline cursor-pointer"
                                        >
                                            Mark as read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                                    {notifications.length === 0 ? (
                                        <span className="text-[10px] text-brand-muted italic py-4 block text-center">No alerts logged</span>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n.id} className={`p-2 rounded-lg border text-[11px] leading-relaxed ${n.read ? 'bg-brand-bg/20 border-brand-border/40 text-brand-muted' : 'bg-brand-primary/5 border-brand-primary/20 text-white'}`}>
                                                <div className="font-bold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                                                    <span>{n.title}</span>
                                                </div>
                                                <p className="mt-0.5 text-brand-text text-[10px]">{n.message}</p>
                                                <span className="text-[8px] text-brand-muted block mt-1 tracking-tight font-mono">{new Date(n.timestamp).toLocaleString()}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settings Trigger */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 bg-brand-card/30 hover:bg-brand-hover text-brand-text border border-brand-border rounded-xl cursor-pointer"
                        title="Preferences Config"
                    >
                        <FiSettings size={14} className="text-brand-muted" />
                    </button>

                    <button
                        onClick={handleDelete}
                        className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                    >
                        <FiTrash2 />
                        <span>Delete Folder</span>
                    </button>
                </div>
            </div>

            {/* 2. Key Metrics Widgets Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard title="Total Rows" value={rows.toLocaleString()} subtitle="Overall Records Count" icon={<FiGrid className="text-blue-400" />} />
                <MetricCard title="Total Columns" value={columns.toLocaleString()} subtitle="Dimensional Attributes" icon={<FiList className="text-emerald-400" />} />
                <MetricCard title="Duplicate Rows" value={profile_data.duplicate_rows.toLocaleString()} subtitle={`${((profile_data.duplicate_rows / rows) * 100).toFixed(1)}% of dataset`} icon={<FiAlertCircle className="text-amber-400" />} highlight={profile_data.duplicate_rows > 0} />
                <MetricCard title="Missing Values" value={profile_data.missing_values_total.toLocaleString()} subtitle="Across all columns" icon={<FiCompass className="text-indigo-400" />} />
                <MetricCard title="File Footprint" value={formatBytes(file_size)} subtitle="Physical File size" icon={<FiDatabase className="text-purple-400" />} />
            </div>

            {/* 3. Navigation Tabs */}
            <div className="flex border-b border-brand-border justify-between items-center pr-1">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors outline-none cursor-pointer ${activeTab === 'preview'
                            ? 'border-brand-primary text-brand-primary font-bold'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        <FiGrid className="text-sm" />
                        <span>Data Preview</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('profiling')}
                        className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors outline-none cursor-pointer ${activeTab === 'profiling'
                            ? 'border-brand-primary text-brand-primary font-bold'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        <FiActivity className="text-sm" />
                        <span>Dataset Profiling</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('ai_analyst')}
                        className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors outline-none cursor-pointer ${activeTab === 'ai_analyst'
                            ? 'border-brand-primary text-brand-primary font-bold'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        <FiMessageSquare className="text-sm text-brand-accent animate-pulse" />
                        <span>AI Data Analyst</span>
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('predictions');
                            if (!automlRecommendation) {
                                handleFetchAutoML();
                            }
                        }}
                        className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors outline-none cursor-pointer ${activeTab === 'predictions'
                            ? 'border-brand-primary text-brand-primary font-bold'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        <FiCpu className="text-sm text-blue-400" />
                        <span>AutoML & Predict</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors outline-none cursor-pointer ${activeTab === 'reports'
                            ? 'border-brand-primary text-brand-primary font-bold'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        <FiPieChart className="text-sm text-purple-400" />
                        <span>BI Reports</span>
                    </button>
                </div>

                {/* Collapsible Sidebar Button */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border bg-brand-card/30 hover:bg-brand-hover text-brand-text hover:text-white transition-all text-xs font-semibold cursor-pointer"
                >
                    <FiCompass className={`shrink-0 ${isSidebarOpen ? 'text-brand-primary rotate-45' : 'text-brand-muted'} transition-transform duration-300`} />
                    <span>Columns Metadata</span>
                </button>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'preview' && (
                            <motion.div
                                key="preview-tab"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <DatasetPreviewTable
                                    columns={preview?.columns || []}
                                    data={preview?.data || []}
                                    totalRows={rows}
                                />
                            </motion.div>
                        )}
                        {activeTab === 'profiling' && (
                            <motion.div
                                key="profiling-tab"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden"
                            >
                                {/* Columns Selector Panel */}
                                <div className="bg-brand-card/25 border border-brand-border/60 rounded-2xl p-4 flex flex-col overflow-hidden">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block mb-3 text-left">
                                        Attributes Browse
                                    </label>
                                    <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar pr-1">
                                        {profile_data.column_lists.all.map((colName) => {
                                            const colInfo = profile_data.columns[colName];
                                            const isSelected = selectedColumn === colName;
                                            const isNumeric = profile_data.column_lists.numeric.includes(colName);

                                            return (
                                                <button
                                                    key={colName}
                                                    onClick={() => setSelectedColumn(colName)}
                                                    className={`text-left p-3 rounded-xl border flex items-center justify-between transition-all active:scale-[0.98] outline-none cursor-pointer ${isSelected
                                                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold shadow-sm shadow-brand-primary/5'
                                                        : 'border-brand-border bg-brand-card/30 hover:bg-brand-card/75 text-brand-text hover:border-brand-hover'
                                                        }`}
                                                >
                                                    <div className="overflow-hidden pr-2">
                                                        <div className="text-xs font-semibold truncate text-white">{colName}</div>
                                                        <span className="text-[10px] text-brand-muted/80 block mt-0.5 font-mono">
                                                            {colInfo.data_type}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isNumeric
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                        }`}>
                                                        {isNumeric ? '123' : 'abc'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Column Statistics Profiling Dashboard */}
                                <div className="lg:col-span-2 flex flex-col overflow-y-auto bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 gap-6 custom-scrollbar pr-3">
                                    {selectedColumn ? (
                                        <>
                                            {/* Header info */}
                                            <div className="border-b border-brand-border pb-4 flex items-center justify-between">
                                                <div className="text-left">
                                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                        <span>Column Profile:</span>
                                                        <span className="text-brand-primary truncate">{selectedColumn}</span>
                                                    </h3>
                                                    <p className="text-[10px] text-brand-muted font-mono mt-1 uppercase">
                                                        Inferred Data Type: {profile_data.columns[selectedColumn].data_type}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Basic column counts details */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3.5 flex flex-col justify-center text-left">
                                                    <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider block">Null / Empty Cells</span>
                                                    <span className="text-lg font-extrabold text-white mt-1">
                                                        {profile_data.columns[selectedColumn].missing_count.toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-brand-muted/75 mt-0.5">
                                                        {profile_data.columns[selectedColumn].missing_percentage}% of column rows
                                                    </span>
                                                </div>
                                                <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3.5 flex flex-col justify-center text-left">
                                                    <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider block">Unique Values</span>
                                                    <span className="text-lg font-extrabold text-white mt-1">
                                                        {profile_data.columns[selectedColumn].unique_values_count.toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-brand-muted/75 mt-0.5">
                                                        Uniqueness ratio: {((profile_data.columns[selectedColumn].unique_values_count / rows) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="bg-brand-bg/70 border border-brand-border rounded-xl p-3.5 flex flex-col justify-center text-left">
                                                    <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider block">Completed Cells</span>
                                                    <span className="text-lg font-extrabold text-brand-accent mt-1">
                                                        {(rows - profile_data.columns[selectedColumn].missing_count).toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-brand-muted/75 mt-0.5">
                                                        {(100 - parseFloat(profile_data.columns[selectedColumn].missing_percentage)).toFixed(1)}% complete
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Numeric descriptive stats vs Categorical breakdown */}
                                            {profile_data.column_lists.numeric.includes(selectedColumn) ? (
                                                <div className="flex flex-col gap-4 text-left">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">Descriptive Statistics</h4>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <StatWidget title="Mean" value={formatStatValue(profile_data.columns[selectedColumn].stats?.mean)} />
                                                        <StatWidget title="Std Deviation" value={formatStatValue(profile_data.columns[selectedColumn].stats?.std)} />
                                                        <StatWidget title="Min Value" value={formatStatValue(profile_data.columns[selectedColumn].stats?.min)} />
                                                        <StatWidget title="Max Value" value={formatStatValue(profile_data.columns[selectedColumn].stats?.max)} />
                                                        <StatWidget title="Quartile 1 (25%)" value={formatStatValue(profile_data.columns[selectedColumn].stats?.['25%'])} />
                                                        <StatWidget title="Median (50%)" value={formatStatValue(profile_data.columns[selectedColumn].stats?.['50%'])} />
                                                        <StatWidget title="Quartile 3 (75%)" value={formatStatValue(profile_data.columns[selectedColumn].stats?.['75%'])} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-4 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">Top Distinct Values</h4>
                                                        {profile_data.columns[selectedColumn].stats?.mode && (
                                                            <span className="text-[10px] text-brand-muted font-bold bg-brand-bg px-2.5 py-1.5 rounded-lg border border-brand-border">
                                                                Mode: <span className="text-white">"{profile_data.columns[selectedColumn].stats.mode}"</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {profile_data.columns[selectedColumn].stats?.top_values?.length > 0 ? (
                                                        <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg/35">
                                                            <table className="w-full text-xs text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-brand-sidebar border-b border-brand-border font-bold">
                                                                        <th className="p-3 text-[10px] uppercase text-brand-muted font-bold">Value String</th>
                                                                        <th className="p-3 text-[10px] uppercase text-brand-muted font-bold text-center w-24">Frequency</th>
                                                                        <th className="p-3 text-[10px] uppercase text-brand-muted font-bold text-right w-44">Ratio</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-brand-border/60">
                                                                    {profile_data.columns[selectedColumn].stats.top_values.map((item, idx) => {
                                                                        const pct = ((item.count / rows) * 100);
                                                                        return (
                                                                            <tr key={idx} className="hover:bg-brand-card/25">
                                                                                <td className="p-3 font-semibold text-white font-mono text-[11px] truncate max-w-[200px]" title={item.value}>{item.value === "" ? '"" (Empty string)' : item.value}</td>
                                                                                <td className="p-3 text-center text-brand-text font-bold font-mono">{item.count.toLocaleString()}</td>
                                                                                <td className="p-3 flex items-center justify-end gap-3 select-none">
                                                                                    <span className="font-bold text-[10px] font-mono text-brand-muted">{pct.toFixed(2)}%</span>
                                                                                    <div className="w-24 bg-brand-bg border border-brand-border p-0.5 rounded-full h-3">
                                                                                        <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 text-center text-xs text-brand-muted italic">
                                                            No distinct values breakdown available for this column.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex-grow flex flex-col items-center justify-center text-center p-10 h-full">
                                            <FiInfo className="text-brand-muted text-3xl mb-2" />
                                            <span className="text-xs text-brand-muted">Select an attribute from the sidebar list to inspect statistics</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                        {activeTab === 'ai_analyst' && (
                            <motion.div
                                key="ai-tab"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <ChatInterface
                                    messages={chatMessages}
                                    onSendMessage={handleSendMessage}
                                    onClearHistory={handleClearChatHistory}
                                    isProcessing={isChatProcessing}
                                    statusText={chatStatusText}
                                    activeDatasetName={original_filename}
                                    activeDatasetId={id}
                                    onApplyCleaning={handleApplyCleaning}
                                />
                            </motion.div>
                        )}
                        {activeTab === 'predictions' && (
                            <motion.div
                                key="predictions-tab"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar text-left"
                            >
                                {/* Form parameters */}
                                <div className="flex flex-col gap-5 bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 h-fit">
                                    <div>
                                        <h3 className="text-sm font-bold text-white mb-1">AutoML Model Configuration</h3>
                                        <p className="text-[10px] text-brand-muted">Select task training options to fit analytics models.</p>
                                    </div>

                                    {/* Target variable selection */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Target Column (Y)</label>
                                        <select
                                            value={targetCol}
                                            onChange={(e) => {
                                                setTargetCol(e.target.value);
                                                // Deselect target column from features list
                                                setFeatureCols(prev => prev.filter(f => f !== e.target.value));
                                            }}
                                            className="bg-brand-bg border border-brand-border focus:border-brand-primary outline-none p-2.5 rounded-xl text-xs text-white"
                                        >
                                            <option value="">-- Choose Target --</option>
                                            {profile_data.column_lists.all.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Algorithm Selection */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Estimator Algorithm</label>
                                        <select
                                            value={algorithm}
                                            onChange={(e) => setAlgorithm(e.target.value)}
                                            className="bg-brand-bg border border-brand-border focus:border-brand-primary outline-none p-2.5 rounded-xl text-xs text-white"
                                        >
                                            <option value="Random Forest">Random Forest</option>
                                            <option value="Logistic Regression">Logistic Regression (Classification)</option>
                                            <option value="Linear Regression">Linear Regression (Regression)</option>
                                            <option value="Decision Tree">Decision Tree</option>
                                            <option value="KMeans">K-Means (Clustering)</option>
                                        </select>
                                    </div>

                                    {/* Feature Variables */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Feature Columns (X)</label>
                                            <button
                                                onClick={() => {
                                                    const allFiltered = profile_data.column_lists.all.filter(c => c !== targetCol);
                                                    setFeatureCols(featureCols.length === allFiltered.length ? [] : allFiltered);
                                                }}
                                                className="text-[9px] font-bold text-brand-primary hover:underline"
                                            >
                                                Toggle All
                                            </button>
                                        </div>
                                        <div className="border border-brand-border rounded-xl bg-brand-bg/50 p-3 max-h-44 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                                            {profile_data.column_lists.all.filter(c => c !== targetCol).map(c => (
                                                <label key={c} className="flex items-center gap-2 text-xs text-brand-text cursor-pointer hover:text-white">
                                                    <input
                                                        type="checkbox"
                                                        value={c}
                                                        checked={featureCols.includes(c)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFeatureCols(prev => [...prev, c]);
                                                            } else {
                                                                setFeatureCols(prev => prev.filter(f => f !== c));
                                                            }
                                                        }}
                                                        className="rounded border-brand-border text-brand-primary focus:ring-brand-primary bg-brand-bg"
                                                    />
                                                    <span className="truncate">{c}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex flex-col gap-2.5 mt-2">
                                        <button
                                            onClick={handleTrainModel}
                                            disabled={isTraining || !targetCol}
                                            className="w-full py-2.5 px-4 bg-brand-primary hover:bg-blue-600 disabled:bg-brand-card disabled:text-brand-muted text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-primary/10 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isTraining ? (
                                                <>
                                                    <FiRefreshCw className="animate-spin text-sm" />
                                                    <span>Fitting model...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiPlay className="text-xs" />
                                                    <span>Train Predictive Model</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={handleFetchAutoML}
                                            disabled={loadingAutoML}
                                            className="w-full py-2.5 px-4 bg-brand-card hover:bg-brand-hover text-white text-xs font-semibold rounded-xl border border-brand-border transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {loadingAutoML ? (
                                                <>
                                                    <FiRefreshCw className="animate-spin text-xs" />
                                                    <span>Analyzing details...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiCpu className="text-xs text-brand-accent" />
                                                    <span>Get AutoML Suggestions</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Results display */}
                                <div className="lg:col-span-2 flex flex-col gap-6">
                                    {/* AutoML Recommendation alert block */}
                                    {automlRecommendation && (
                                        <div className="bg-emerald-500/5 border border-brand-accent/25 rounded-2xl p-4 flex flex-col gap-2">
                                            <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                                <FiCpu className="text-brand-accent animate-pulse" />
                                                <span>Gemini AutoML Recommendations</span>
                                            </h4>
                                            <p className="text-[11px] text-brand-muted/95 leading-relaxed">
                                                Based on a schema breakdown, Gemini inferred this dataset is suited for a{' '}
                                                <span className="text-brand-primary font-bold">{automlRecommendation.prediction_task}</span> task, targeting{' '}
                                                <span className="text-white font-mono font-bold bg-brand-card px-1.5 py-0.5 rounded border border-brand-border">"{automlRecommendation.recommended_target}"</span>.
                                            </p>
                                            <p className="text-[10px] text-brand-muted leading-relaxed italic mt-1">
                                                Recommended features: {automlRecommendation.features_recommended.join(', ')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Training feedback details */}
                                    {trainedModel && (
                                        <div className="bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 flex flex-col gap-5">
                                            <div className="flex justify-between items-start border-b border-brand-border pb-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                        <FiCheckCircle className="text-brand-accent" />
                                                        <span>Model Fitted Successfully</span>
                                                    </h3>
                                                    <span className="text-[10px] text-brand-muted">Algorithm used: {trainedModel.algorithm}</span>
                                                </div>

                                                <button
                                                    onClick={handleRunPrediction}
                                                    disabled={isPredicting}
                                                    className="py-1.5 px-3 bg-brand-accent text-brand-bg text-xs font-bold rounded-lg hover:shadow-lg shadow-brand-accent/15 cursor-pointer flex items-center gap-1.5"
                                                >
                                                    {isPredicting ? (
                                                        <>
                                                            <FiRefreshCw className="animate-spin text-xs" />
                                                            <span>Predicting...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Run Predictions</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Metrics Cards */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {Object.entries(trainedModel.metrics).map(([mName, mValue]) => (
                                                    <div key={mName} className="bg-brand-bg/70 border border-brand-border rounded-xl p-3">
                                                        <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">{mName.replace('_', ' ')}</span>
                                                        <span className="text-sm font-black text-white font-mono mt-1 block">
                                                            {typeof mValue === 'number' ? mValue.toFixed(4) : String(mValue)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Feature Importance visual rank */}
                                            {trainedModel.feature_importances && Object.keys(trainedModel.feature_importances).length > 0 && (
                                                <div className="flex flex-col gap-3">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Feature Importance Rank</label>
                                                    <div className="border border-brand-border bg-brand-bg/40 rounded-xl p-3 flex flex-col gap-2.5">
                                                        {Object.entries(trainedModel.feature_importances)
                                                            .sort((a, b) => b[1] - a[1])
                                                            .slice(0, 8)
                                                            .map(([fName, val]) => {
                                                                const pct = (val * 100);
                                                                return (
                                                                    <div key={fName} className="flex items-center justify-between text-xs">
                                                                        <span className="font-semibold text-white font-mono text-[11px] truncate max-w-[200px]">{fName}</span>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="font-bold text-[10px] font-mono text-brand-muted">{pct.toFixed(2)}%</span>
                                                                            <div className="w-36 bg-brand-bg border border-brand-border p-0.5 rounded-full h-3">
                                                                                <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Prediction results outcome preview */}
                                    {predictionOutput && (
                                        <div className="bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 flex flex-col gap-4">
                                            <div className="flex justify-between items-center border-b border-brand-border pb-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-white">Generated Predictions Preview</h3>
                                                    <span className="text-[10px] text-brand-muted">New predictions saved to file system version</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <a
                                                        href={getDownloadUrl('csv', id)}
                                                        className="py-1.5 px-3 bg-brand-card border border-brand-border rounded-lg text-xs font-semibold text-white hover:bg-brand-hover flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FiDownload className="text-xs" />
                                                        <span>CSV</span>
                                                    </a>
                                                    <a
                                                        href={getDownloadUrl('excel', id)}
                                                        className="py-1.5 px-3 bg-brand-card border border-brand-border rounded-lg text-xs font-semibold text-white hover:bg-brand-hover flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FiDownload className="text-xs" />
                                                        <span>Excel</span>
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Preview rows */}
                                            {predictionOutput.preview_data && (
                                                <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg/35 max-h-56 overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-brand-sidebar border-b border-brand-border font-bold">
                                                                {predictionOutput.preview_data.columns?.slice(0, 5).map(c => (
                                                                    <th key={c} className="p-3 text-[10px] uppercase text-brand-muted font-bold truncate">{c}</th>
                                                                ))}
                                                                <th className="p-3 text-[10px] uppercase font-bold text-brand-accent bg-emerald-500/5">Predicted_{targetCol}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-brand-border/60">
                                                            {predictionOutput.preview_data.data?.slice(0, 5).map((row, rIdx) => (
                                                                <tr key={rIdx} className="hover:bg-brand-card/25">
                                                                    {predictionOutput.preview_data.columns?.slice(0, 5).map(c => (
                                                                        <td key={c} className="p-3 font-medium text-white truncate max-w-[120px]">{String(row[c] || '')}</td>
                                                                    ))}
                                                                    <td className="p-3 font-mono font-bold text-brand-accent bg-emerald-500/5">{String(row[`predicted_${targetCol}`] || '')}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!trainedModel && !automlRecommendation && (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-brand-card/10 border border-dashed border-brand-border rounded-2xl min-h-[300px]">
                                            <FiCpu className="text-brand-muted text-4xl mb-3" />
                                            <span className="text-xs text-white font-semibold">Ready to training pipelines</span>
                                            <span className="text-[10px] text-brand-muted max-w-xs mt-1">
                                                Input target column parameter and fit sk-learn estimators to evaluate and execute predictions.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                        {activeTab === 'reports' && (
                            <motion.div
                                key="reports-tab"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar text-left text-brand-text"
                            >
                                {/* Report generator generator controls */}
                                <div className="flex flex-col gap-4 bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 h-fit">
                                    <div>
                                        <h3 className="text-sm font-bold text-white mb-1">Generate Intelligence Report</h3>
                                        <p className="text-[10px] text-brand-muted font-medium">Use Gemini to generate KPIs, executive summary, and trends.</p>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Report title</label>
                                        <input
                                            type="text"
                                            value={reportTitle}
                                            onChange={(e) => setReportTitle(e.target.value)}
                                            placeholder="Enter report title..."
                                            className="bg-brand-bg border border-brand-border focus:border-brand-primary outline-none p-2.5 rounded-xl text-xs text-white"
                                        />
                                    </div>

                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport || !reportTitle.trim()}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90 disabled:bg-brand-card disabled:text-brand-muted text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-primary/10 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {isGeneratingReport ? (
                                            <>
                                                <FiRefreshCw className="animate-spin text-sm" />
                                                <span>Compiling Report...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiPieChart className="text-xs" />
                                                <span>Compile Report with Gemini</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Reports directory list */}
                                    <div className="flex flex-col gap-2 mt-4">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Generated Reports History</label>
                                        <div className="flex flex-col gap-2 pr-1">
                                            {reportsList.length === 0 ? (
                                                <div className="text-center py-6 border border-dashed border-brand-border rounded-xl bg-brand-card/10 select-none">
                                                    <span className="text-[10px] text-brand-muted block font-medium">No reports generated yet</span>
                                                </div>
                                            ) : (
                                                reportsList.map(r => (
                                                    <button
                                                        key={r.id}
                                                        onClick={() => setActiveReport(r)}
                                                        className={`w-full text-left p-3 border rounded-xl flex items-center justify-between transition-all active:scale-[0.98] outline-none cursor-pointer ${activeReport?.id === r.id
                                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold'
                                                            : 'border-brand-border bg-brand-card/30 hover:bg-brand-card/75 text-brand-text'
                                                            }`}
                                                    >
                                                        <div className="overflow-hidden pr-2">
                                                            <div className="text-xs font-semibold truncate text-white">{r.title}</div>
                                                            <span className="text-[9px] text-brand-muted block mt-0.5 font-mono">
                                                                {new Date(r.timestamp).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <FiPieChart size={12} className="shrink-0 text-brand-muted" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Report details view */}
                                <div className="lg:col-span-2 flex flex-col gap-6">
                                    {activeReport ? (
                                        <div className="bg-brand-card/25 border border-brand-border/60 rounded-2xl p-5 flex flex-col gap-5">
                                            <div className="flex justify-between items-start border-b border-brand-border pb-3">
                                                <div>
                                                    <h3 className="text-md font-bold text-white">{activeReport.title}</h3>
                                                    <span className="text-[10px] text-brand-muted">Compiled {new Date(activeReport.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <a
                                                        href={getDownloadReportUrl('pdf', activeReport.id)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="py-1.5 px-3 bg-brand-card border border-brand-border rounded-lg text-xs font-semibold text-white hover:bg-brand-hover flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FiDownload className="text-xs" />
                                                        <span>PDF</span>
                                                    </a>
                                                    <a
                                                        href={getDownloadReportUrl('html', activeReport.id)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="py-1.5 px-3 bg-brand-card border border-brand-border rounded-lg text-xs font-semibold text-white hover:bg-brand-hover flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FiDownload className="text-xs" />
                                                        <span>HTML</span>
                                                    </a>
                                                    <a
                                                        href={getDownloadReportUrl('markdown', activeReport.id)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="py-1.5 px-3 bg-brand-card border border-brand-border rounded-lg text-xs font-semibold text-white hover:bg-brand-hover flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FiDownload className="text-xs" />
                                                        <span>MD</span>
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Report contents segments */}
                                            {activeReport.content && (
                                                <div className="flex flex-col gap-4 text-left">
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">Executive Summary</h4>
                                                        <div className="bg-brand-bg/40 p-4 border border-brand-border rounded-xl text-xs text-brand-text leading-relaxed">
                                                            {activeReport.content.executive_summary}
                                                        </div>
                                                    </div>

                                                    {activeReport.content.kpis && activeReport.content.kpis.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">Key Performance Indicators</h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                {activeReport.content.kpis.map((k, idx) => (
                                                                    <div key={idx} className="bg-brand-bg/60 border border-brand-border rounded-xl p-3.5 flex flex-col">
                                                                        <span className="text-[10px] text-brand-muted font-bold block">{k.kpi_name}</span>
                                                                        <span className="text-lg font-black text-white mt-1 block">{k.value}</span>
                                                                        <span className="text-[9px] text-brand-muted mt-1 leading-snug">{k.interpretation}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeReport.content.insights && activeReport.content.insights.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">Trend & Findings Insights</h4>
                                                            <div className="flex flex-col gap-2.5">
                                                                {activeReport.content.insights.map((ins, idx) => (
                                                                    <div key={idx} className="bg-brand-bg/40 border border-brand-border rounded-xl p-3 flex gap-3 items-start">
                                                                        <span className="h-5 w-5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0 rounded text-[10px] font-bold font-mono">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-white">{ins.insight_name}</span>
                                                                            <span className="text-[11px] text-brand-muted mt-1 leading-relaxed">{ins.description}</span>
                                                                            <span className="text-[10px] text-brand-accent mt-1.5 font-bold">Action recommendation: {ins.actionable_recommendation}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-brand-card/10 border border-dashed border-brand-border rounded-2xl min-h-[300px] select-none">
                                            <FiPieChart className="text-brand-muted text-4xl mb-3" />
                                            <span className="text-xs text-white font-semibold">Reports Viewer</span>
                                            <span className="text-[10px] text-brand-muted max-w-xs mt-1">
                                                Select a generated report from history folder, or compile a new one with Gemini.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Collapsible side columns details reference */}
                <ColumnExplorer
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    columnsInfo={profile_data?.columns}
                />
            </div>

            {/* Version History Sidebar Overlay Drawer */}
            {showVersions && (
                <div className="fixed inset-0 bg-brand-bg/80 backdrop-blur-sm z-[100] flex justify-end animate-fade-in">
                    <div className="w-96 bg-brand-sidebar border-l border-brand-border h-full p-6 flex flex-col gap-5 text-left shadow-2xl relative">
                        <div className="flex justify-between items-center border-b border-brand-border pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiLayers className="text-brand-accent animate-pulse" />
                                <span>Dataset Version History</span>
                            </h3>
                            <button
                                onClick={() => setShowVersions(false)}
                                className="text-xs text-brand-muted hover:text-white cursor-pointer"
                            >
                                Close
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                            {datasetVersions.length === 0 ? (
                                <div className="text-center py-10 text-brand-muted text-xs">No saved versions found.</div>
                            ) : (
                                datasetVersions.map((v) => (
                                    <div
                                        key={v.id}
                                        className="p-3 border border-brand-border rounded-xl bg-brand-card/30 flex flex-col gap-2.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white">Version {v.version_number}</span>
                                            {v.filename === profile.filename ? (
                                                <span className="text-[9px] bg-brand-primary/20 border border-brand-primary/30 text-brand-primary font-bold px-2 py-0.5 rounded-full">
                                                    Active Selection
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleRestoreVersion(v.id)}
                                                    className="text-[10px] text-brand-accent hover:underline font-bold cursor-pointer"
                                                >
                                                    Restore
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-brand-text break-all">{v.name}</span>
                                        <span className="text-[9px] text-brand-muted font-mono">{new Date(v.created_at).toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Command Palette (Ctrl + K) Overlay */}
            {showCtrlK && (
                <div
                    className="fixed inset-0 bg-brand-bg/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowCtrlK(false);
                    }}
                >
                    <div className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-left">
                        <div className="flex justify-between items-center border-b border-brand-border pb-2.5">
                            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1.5">
                                <FiCpu className="text-brand-primary animate-pulse" />
                                <span>Interactive Command Palette</span>
                            </span>
                            <span className="text-[10px] text-brand-muted">ESC to close</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowCtrlK(false);
                                    setActiveTab('predictions');
                                    handleFetchAutoML();
                                }}
                                className="w-full p-3 rounded-xl border border-brand-border/40 hover:border-brand-primary bg-brand-bg/40 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>🧠 Run AutoML Recommend Scan</span>
                                <span className="text-[9px] text-brand-muted">Estimator</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowCtrlK(false);
                                    setActiveTab('predictions');
                                }}
                                className="w-full p-3 rounded-xl border border-brand-border/40 hover:border-brand-primary bg-brand-bg/40 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>📊 Fit Predictive Model Pipeline</span>
                                <span className="text-[9px] text-brand-muted">Scikit-Learn</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowCtrlK(false);
                                    setActiveTab('reports');
                                }}
                                className="w-full p-3 rounded-xl border border-brand-border/40 hover:border-brand-primary bg-brand-bg/40 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>📄 Compile Gemini BI Insights Report</span>
                                <span className="text-[9px] text-brand-muted">Business PDF</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowCtrlK(false);
                                    setShowVersions(true);
                                }}
                                className="w-full p-3 rounded-xl border border-brand-border/40 hover:border-brand-primary bg-brand-bg/40 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>🔄 Restore Historical Version</span>
                                <span className="text-[9px] text-brand-muted">Rollback</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowCtrlK(false);
                                    setActiveTab('ai_analyst');
                                    handleSendMessage('quality report');
                                }}
                                className="w-full p-3 rounded-xl border border-brand-border/40 hover:border-brand-primary bg-brand-bg/40 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>🔍 Trigger Quality Audit Scan</span>
                                <span className="text-[9px] text-brand-muted">Profiling</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Parameter Modal Dialog */}
            {showSettings && (
                <div className="fixed inset-0 bg-brand-bg/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl p-5 text-left flex flex-col gap-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-brand-border pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiSettings className="text-brand-muted" />
                                <span>Workspace Settings</span>
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-xs text-brand-muted hover:text-white cursor-pointer"
                            >
                                Save
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 py-2">
                            {/* API Key management */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Gemini API Key override</label>
                                <input
                                    type="password"
                                    defaultValue={settingsConfig.apiKey}
                                    onChange={(e) => {
                                        setSettingsConfig(prev => ({ ...prev, apiKey: e.target.value }));
                                        localStorage.setItem('GEMINI_API_KEY', e.target.value);
                                    }}
                                    className="bg-brand-bg border border-brand-border focus:border-brand-primary outline-none p-2.5 rounded-xl text-xs text-white"
                                />
                            </div>

                            {/* Theme settings */}
                            <div className="flex items-center justify-between text-xs text-white">
                                <span className="font-semibold">Dark themed glassmorphism</span>
                                <input
                                    type="checkbox"
                                    checked={settingsConfig.darkMode}
                                    onChange={(e) => setSettingsConfig(prev => ({ ...prev, darkMode: e.target.checked }))}
                                    className="rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                                />
                            </div>

                            {/* Layout selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Dashboard layouts</label>
                                <select
                                    value={settingsConfig.chartStyle}
                                    onChange={(e) => setSettingsConfig(prev => ({ ...prev, chartStyle: e.target.value }))}
                                    className="bg-brand-bg border border-brand-border focus:border-brand-primary outline-none p-2.5 rounded-xl text-xs text-white"
                                >
                                    <option value="glassmorphism">Premium UI Glassmorphism</option>
                                    <option value="high-contrast">High Contrast Dark</option>
                                    <option value="compact">Compact Grid Minimal</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Metric Display Widget Card helper */
function MetricCard({ title, value, subtitle, icon, highlight = false }) {
    return (
        <div className={`p-4 bg-brand-card/45 border rounded-2xl text-left transition-all ${highlight ? 'border-amber-500/30 shadow-sm shadow-amber-500/5' : 'border-brand-border/65'
            }`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">{title}</span>
                <div className="h-7 w-7 rounded-lg bg-brand-bg border border-brand-border flex items-center justify-center shadow-inner">
                    {icon}
                </div>
            </div>
            <div className={`text-xl font-black ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</div>
            <span className="text-[9px] text-brand-muted mt-1.5 block font-medium truncate">{subtitle}</span>
        </div>
    );
}

/* Local stat metric small card helper */
function StatWidget({ title, value }) {
    return (
        <div className="bg-brand-bg/50 border border-brand-border/60 rounded-xl p-3 text-left">
            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">{title}</span>
            <span className="text-sm font-extrabold text-white mt-1 block font-mono">
                {value}
            </span>
        </div>
    );
}

const formatStatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') {
        return val % 1 === 0 ? val.toLocaleString() : val.toFixed(4);
    }
    return String(val);
};
