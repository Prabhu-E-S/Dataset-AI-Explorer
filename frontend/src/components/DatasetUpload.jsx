import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUploadCloud,
    FiFileText,
    FiCheckCircle,
    FiAlertCircle,
    FiRefreshCw,
    FiClock,
    FiTrendingUp,
    FiHardDrive,
    FiActivity,
    FiAward,
    FiPieChart
} from 'react-icons/fi';

const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function DatasetUpload({ onUploadComplete, recentDatasets = [] }) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successFile, setSuccessFile] = useState(null);
    const [dbSchemaStats, setDbSchemaStats] = useState({
        total_datasets: 0,
        total_reports: 0,
        cleaning_sessions: 0,
        total_storage: 0,
        avg_quality_score: 0.0
    });
    const [activityTimeline, setActivityTimeline] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const { getDashboardSummary, getActivityLogs } = await import('../services/api');
                const stats = await getDashboardSummary();
                setDbSchemaStats(stats);
                const logs = await getActivityLogs();
                setActivityTimeline(logs);
            } catch (err) {
                console.error("Failed to load dashboard metrics or activity logs:", err);
            }
        };
        fetchDashboardData();
    }, [recentDatasets]);

    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setUploading(true);
        setProgress(0);
        setErrorMsg(null);
        setSuccessFile(null);

        // Call service upload logic
        const { uploadDataset } = await import('../services/api');

        try {
            const data = await uploadDataset(file, (percent) => {
                setProgress(percent);
            });
            setSuccessFile(data);
            if (onUploadComplete) {
                onUploadComplete(data);
            }
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.detail || 'Failed to upload dataset. Ensure it is a valid CSV or Excel file.';
            setErrorMsg(errMsg);
        } finally {
            setUploading(false);
        }
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1,
        disabled: uploading
    });

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto max-w-6xl mx-auto w-full gap-6 select-none custom-scrollbar">

            {/* 1. Header Hero Segment */}
            <div className="text-left mt-2 border-b border-brand-border/60 pb-5">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                    Explore Your <span className="text-gradient">Data Workspace</span>
                </h2>
                <p className="text-brand-muted text-xs mt-1.5 max-w-2xl leading-relaxed">
                    Upload a raw CSV or Excel sheet. We will automatically parse columns, build statistical profiling metrics, diagnose missing attributes, and structure a high-performance preview grid.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* 2. Drag and Drop Zone Container */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted text-left">
                        Upload Dataset
                    </label>

                    <div
                        {...getRootProps()}
                        className={`border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[300px] relative overflow-hidden ${isDragActive
                            ? 'border-brand-primary bg-brand-primary/5'
                            : 'border-brand-border/80 bg-brand-card/10 hover:bg-brand-card/25 hover:border-brand-primary/40'
                            } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
                    >
                        <input {...getInputProps()} />

                        {/* Glowing background accent on drag */}
                        <AnimatePresence>
                            {isDragActive && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-brand-primary blur-3xl animate-pulse"
                                />
                            )}
                        </AnimatePresence>

                        <div className="relative flex flex-col items-center z-10">

                            {/* Dynamic Icon State */}
                            <motion.div
                                animate={isDragActive ? { y: -5 } : uploading ? { rotate: 360 } : { y: 0 }}
                                transition={uploading ? { repeat: Infinity, duration: 2, ease: "linear" } : { type: 'spring', stiffness: 200 }}
                                className={`h-12 w-12 rounded-lg flex items-center justify-center border mb-4 transition-colors ${isDragActive
                                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                    : uploading
                                        ? 'bg-brand-card border-brand-border text-brand-primary'
                                        : 'bg-brand-card/50 border-brand-border text-brand-muted'
                                    }`}
                            >
                                {uploading ? (
                                    <FiRefreshCw className="text-xl animate-spin" />
                                ) : (
                                    <FiUploadCloud className="text-xl" />
                                )}
                            </motion.div>

                            {!uploading ? (
                                <>
                                    <h3 className="text-sm font-semibold text-white mb-1.5">
                                        {isDragActive ? 'Drop your dataset here' : 'Drag & drop your files here'}
                                    </h3>
                                    <p className="text-xs text-brand-muted mb-4 max-w-sm">
                                        Supports spreadsheet uploads including <span className="text-slate-205 font-medium">CSV</span> or <span className="text-slate-205 font-medium">Excel (.xlsx, .xls)</span> up to 50MB.
                                    </p>
                                    <button className="px-4 py-2 bg-brand-card hover:bg-brand-hover text-white text-xs font-semibold rounded-lg border border-brand-border transition-all active:scale-95 shadow-sm">
                                        Select File
                                    </button>
                                </>
                            ) : (
                                <div className="w-60">
                                    <h3 className="text-xs font-semibold text-white mb-2 text-center">
                                        Profiling & Uploading Dataset...
                                    </h3>
                                    <div className="w-full bg-brand-sidebar rounded-full h-2 overflow-hidden border border-brand-border p-0.5">
                                        <motion.div
                                            className="bg-brand-primary h-1 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.1 }}
                                        />
                                    </div>
                                    <span className="text-[9px] text-brand-muted font-bold tracking-wider mt-2 block text-center uppercase">
                                        {progress}% Complete
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback messages */}
                    <AnimatePresence mode="wait">
                        {errorMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="bg-red-500/5 border border-red-500/15 p-3 rounded-lg flex items-start gap-2.5 text-left"
                            >
                                <FiAlertCircle className="text-red-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-xs font-semibold text-red-200">Upload Process Failed</h4>
                                    <p className="text-[11px] text-red-300/80 mt-0.5">{errorMsg}</p>
                                </div>
                            </motion.div>
                        )}

                        {successFile && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="bg-emerald-500/5 border border-brand-accent/15 p-3 rounded-lg flex items-start gap-2.5 text-left"
                            >
                                <FiCheckCircle className="text-brand-accent mt-0.5 flex-shrink-0" />
                                <div className="flex-grow">
                                    <h4 className="text-xs font-semibold text-white">Dataset Loaded Successfully</h4>
                                    <p className="text-[11px] text-brand-muted mt-0.5">
                                        "{successFile.original_filename}" has been successfully saved & profiled.
                                    </p>
                                    <p className="text-[10px] text-brand-accent font-semibold mt-1 font-mono">
                                        {successFile.rows.toLocaleString()} rows • {successFile.columns} columns detected
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Recent Uploads & Stats Panels */}
                <div className="flex flex-col gap-5 lg:max-w-sm w-full mx-auto">

                    {/* Quick Metrics */}
                    <div className="bg-brand-card/20 border border-brand-border/60 rounded-xl p-4.5 flex flex-col gap-3.5">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 text-left">
                            <FiHardDrive className="text-brand-primary" /> Workspace Status
                        </h4>

                        <div className="grid grid-cols-2 gap-3 border-b border-brand-border/40 pb-3">
                            <div className="text-left">
                                <span className="text-[9px] text-brand-muted block font-semibold">DATASETS</span>
                                <span className="text-lg font-bold text-white mt-0.5 block">{dbSchemaStats.total_datasets}</span>
                            </div>
                            <div className="text-left">
                                <span className="text-[9px] text-brand-muted block font-semibold">STORAGE</span>
                                <span className="text-lg font-bold text-white mt-0.5 block">
                                    {formatBytes(dbSchemaStats.total_storage)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-left">
                                <span className="text-[9px] text-brand-muted block font-semibold">REPORTS</span>
                                <span className="text-lg font-bold text-white mt-0.5 block flex items-center gap-1">
                                    <FiPieChart size={12} className="text-brand-primary" />
                                    <span>{dbSchemaStats.total_reports}</span>
                                </span>
                            </div>
                            <div className="text-left">
                                <span className="text-[9px] text-brand-muted block font-semibold">QUALITY</span>
                                <span className="text-lg font-bold text-brand-accent mt-0.5 block flex items-center gap-1">
                                    <FiAward size={12} />
                                    <span>{(dbSchemaStats.avg_quality_score || 0).toFixed(1)}%</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Logs Timeline Feed */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted text-left flex items-center gap-1.5">
                            <FiActivity className="text-brand-primary" />
                            <span>System Activity Timeline</span>
                        </label>

                        <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 text-left custom-scrollbar">
                            {activityTimeline.length === 0 ? (
                                <div className="text-center py-5 border border-dashed border-brand-border/60 rounded-lg bg-brand-card/5">
                                    <span className="text-[9px] text-brand-muted italic">No activity logged yet</span>
                                </div>
                            ) : (
                                activityTimeline.slice(0, 10).map((act) => (
                                    <div key={act.id} className="p-2.5 bg-brand-card/10 border border-brand-border/60 rounded-lg flex gap-2">
                                        <div className="h-5 w-5 bg-brand-card border border-brand-border/60 rounded flex items-center justify-center shrink-0">
                                            <FiClock size={10} className="text-brand-muted" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-center leading-none">
                                                <span className="text-[8px] font-bold text-white uppercase tracking-wider">{act.action_type}</span>
                                                <span className="text-[7.5px] text-brand-muted font-mono">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-300 leading-snug mt-1 truncate" title={act.description}>
                                                {act.description}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recent Workspaces list */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted text-left">
                            Recent Workspaces
                        </label>

                        <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                            {recentDatasets.length === 0 ? (
                                <div className="text-center py-5 border border-dashed border-brand-border/60 rounded-lg bg-brand-card/5">
                                    <FiClock className="text-brand-muted mx-auto text-base mb-1" />
                                    <span className="text-[10px] text-brand-muted font-medium">No uploads yet</span>
                                </div>
                            ) : (
                                recentDatasets.slice(0, 4).map((d) => (
                                    <div
                                        key={d.id}
                                        className="flex items-center gap-2.5 p-2 bg-brand-card/15 border border-brand-border/50 hover:bg-brand-card/45 rounded-lg transition-all"
                                    >
                                        <div className="h-7 w-7 bg-brand-card border border-brand-border/60 rounded flex items-center justify-center text-brand-muted shrink-0">
                                            <FiFileText className="text-xs" />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <h4 className="text-xs font-semibold text-white truncate">{d.original_filename}</h4>
                                            <p className="text-[9px] text-brand-muted truncate mt-0.5 font-mono">
                                                {d.rows.toLocaleString()} rows • {formatBytes(d.file_size)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
