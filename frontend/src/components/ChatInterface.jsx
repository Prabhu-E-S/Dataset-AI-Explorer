import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDownloadUrl, getDownloadReportUrl } from '../services/api';

// --- Inline Plotly Chart renderer ---
function PlotlyChart({ chartData }) {
    const chartRef = useRef(null);

    useEffect(() => {
        if (chartRef.current && chartData && window.Plotly) {
            try {
                window.Plotly.newPlot(
                    chartRef.current,
                    chartData.data,
                    chartData.layout,
                    { responsive: true, displayModeBar: false }
                );
            } catch (err) {
                console.error('Error drawing inline Plotly chart:', err);
            }
        }
    }, [chartData]);

    return (
        <div
            ref={chartRef}
            className="w-full h-[320px] rounded-xl bg-brand-bg/40 border border-brand-border/60 p-2 my-4 shadow-inner"
        />
    );
}

// --- Markdown parser ---
function MessageFormatter({ text }) {
    if (!text) return null;
    const segments = text.split('\n');

    return (
        <div className="space-y-2 text-sm leading-relaxed text-slate-200">
            {segments.map((seg, idx) => {
                const trimmed = seg.trim();
                if (!trimmed) return <div key={idx} className="h-2" />;

                if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    const content = trimmed.substring(1).trim();
                    return (
                        <ul key={idx} className="list-disc pl-5 my-1 text-slate-300">
                            <li>{parseFormat(content)}</li>
                        </ul>
                    );
                }

                if (trimmed.startsWith('#')) {
                    const depth = trimmed.match(/^#+/)[0].length;
                    const content = trimmed.replace(/^#+/, '').trim();
                    const classes = depth === 1
                        ? 'text-lg font-bold text-brand-primary mt-3 mb-1'
                        : 'text-base font-semibold text-brand-accent mt-2 mb-1';
                    return <div key={idx} className={classes}>{parseFormat(content)}</div>;
                }

                return <p key={idx}>{parseFormat(trimmed)}</p>;
            })}
        </div>
    );
}

function parseFormat(text) {
    const parts = text.split('**');
    if (parts.length > 1) {
        return parts.map((part, index) =>
            index % 2 === 1 ? <strong key={index} className="text-brand-primary font-semibold">{part}</strong> : part
        );
    }
    return text;
}

// --- Circular Score rendering ---
function CircularProgress({ score, size = 120, strokeWidth = 10 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const strokeColor = score >= 85 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';

    return (
        <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    className="text-brand-border"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <motion.circle
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round"
                    stroke={strokeColor}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-brand-text">{score}</span>
                <span className="text-[10px] text-brand-muted font-semibold uppercase">Score</span>
            </div>
        </div>
    );
}

// --- Timeline progress component ---
function CleaningTimeline() {
    const steps = [
        { key: 'inspect', text: 'Inspecting Dataset...' },
        { key: 'missing', text: 'Checking Missing Values...' },
        { key: 'dups', text: 'Finding Duplicates...' },
        { key: 'std', text: 'Standardizing Data...' },
        { key: 'mem', text: 'Optimizing Memory...' },
        { key: 'pdf', text: 'Generating Report...' },
        { key: 'done', text: 'Cleaning Complete.' }
    ];

    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStepIdx(prev => {
                if (prev >= steps.length - 1) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 1;
            });
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-brand-card/80 border border-brand-border/60 p-5 rounded-2xl space-y-4 my-3 max-w-sm">
            <h4 className="text-sm font-semibold text-brand-text flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-brand-primary animate-ping rounded-full" />
                <span>Modular Cleaning Pipeline Running</span>
            </h4>
            <div className="space-y-2.5">
                {steps.map((st, i) => {
                    const isDone = i < currentStepIdx;
                    const isActive = i === currentStepIdx;

                    return (
                        <div key={st.key} className="flex items-center space-x-3 text-xs">
                            {isDone ? (
                                <div className="text-brand-accent">✓</div>
                            ) : isActive ? (
                                <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent animate-spin rounded-full" />
                            ) : (
                                <div className="w-2 h-2 bg-brand-muted/40 rounded-full ml-1" />
                            )}
                            <span className={isActive ? 'text-brand-primary font-medium' : isDone ? 'text-brand-muted/80' : 'text-brand-muted'}>
                                {st.text}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function ChatInterface({
    messages,
    onSendMessage,
    onClearHistory,
    isProcessing,
    statusText,
    activeDatasetName,
    activeDatasetId,
    onApplyCleaning
}) {
    const [inputValue, setInputValue] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const messagesEndRef = useRef(null);

    const handleCopy = (text, msgId) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(msgId);
            setTimeout(() => setCopiedId(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    // Checklist Configurator state
    const [cleanConfig, setCleanConfig] = useState({
        duplicate_cleaner: true,
        text_cleaner: true,
        validator: true,
        datetime_cleaner: true,
        outlier_cleaner: false,
        missing_value_cleaner: true,
        datatype_cleaner: true
    });

    const [missingStrategy, setMissingStrategy] = useState('median');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isProcessing]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isProcessing) return;
        onSendMessage(inputValue.trim());
        setInputValue('');
    };

    // Quick action chips
    const actionChips = [
        { label: 'Clean Dataset', prompt: 'Clean Dataset' },
        { label: 'Quality Report', prompt: 'Quality Report' },
        { label: 'Missing Values', prompt: 'Analyze Missing Values' },
        { label: 'Duplicates', prompt: 'Count Duplicates' },
        { label: 'Outliers', prompt: 'Show Outliers' },
        { label: 'Invalid Data Types', prompt: 'Find Invalid Data Types' },
        { label: 'Normalize Text', prompt: 'Normalize Text' },
        { label: 'Download Dataset', prompt: 'Download Dataset' },
        { label: 'Generate Cleaning Report', prompt: 'Generate Cleaning Report' }
    ];

    const handleChipClick = (prompt) => {
        if (isProcessing) return;
        onSendMessage(prompt);
    };

    const handleToggleConfig = (key) => {
        setCleanConfig(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const triggerApplyClean = () => {
        // Assemble clean operations configuration payload
        const ops = {};
        if (cleanConfig.duplicate_cleaner) ops.duplicate_cleaner = { keep: 'first' };
        if (cleanConfig.text_cleaner) ops.text_cleaner = { trim_spaces: true, case: 'none', remove_extra_spaces: true };
        if (cleanConfig.validator) ops.validator = { email_columns: [], phone_columns: [] };
        if (cleanConfig.datetime_cleaner) ops.datetime_cleaner = { output_format: '%Y-%m-%d' };
        if (cleanConfig.outlier_cleaner) ops.outlier_cleaner = { strategy: 'clamp' };
        if (cleanConfig.missing_value_cleaner) ops.missing_value_cleaner = { strategy: missingStrategy };
        if (cleanConfig.datatype_cleaner) ops.datatype_cleaner = { downcast_numeric: true, normalize_booleans: true, category_conversion: true };

        if (onApplyCleaning) {
            onApplyCleaning(ops);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-brand-bg relative overflow-hidden">
            {/* Top info summary */}
            <div className="px-6 py-3 border-b border-brand-border/60 bg-brand-sidebar/40 flex items-center justify-between z-10">
                <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-pulse" />
                    <span className="text-sm font-medium text-brand-text truncate max-w-[200px]">
                        {activeDatasetName || 'Active Dataset'}
                    </span>
                </div>
                <button
                    onClick={onClearHistory}
                    disabled={messages.length === 0}
                    className="text-xs text-red-400 hover:text-red-300 disabled:text-brand-muted hover:bg-red-500/10 disabled:bg-transparent px-2.5 py-1.5 rounded-lg border border-red-500/20 disabled:border-transparent transition-all duration-200 focus:outline-none"
                >
                    Clear Chat
                </button>
            </div>

            {/* Messages Pane */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 mt-12">
                        <div className="w-16 h-16 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-center mb-4 text-brand-primary shadow-lg animate-bounce">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-brand-text">AI Data Cleaning Workspace</h2>
                        <p className="text-sm text-brand-muted max-w-md mt-2">
                            Review dataset quality issues, configure cleaner strategies, apply automated python cleaning pipelines and generate reports.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div
                                key={msg.id || Math.random().toString()}
                                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`w-full max-w-[90%] md:max-w-[78%] rounded-2xl p-4 shadow-md ${isUser
                                    ? 'bg-brand-primary text-white rounded-br-none ml-auto'
                                    : 'bg-brand-card border border-brand-border/60 text-slate-100 rounded-bl-none Mr-auto'
                                    }`}>
                                    <div className="text-[10px] text-brand-muted mb-1 font-semibold uppercase tracking-wider">
                                        {isUser ? 'You' : 'Data Integrity Engineer'}
                                    </div>

                                    {/* Text content formatting */}
                                    {msg.content && <MessageFormatter text={msg.content} />}

                                    {/* Render inline Chart */}
                                    {msg.type === 'chart' && msg.chart_data && (
                                        <PlotlyChart chartData={msg.chart_data} />
                                    )}

                                    {/* PHASE 3 CUSTOM BUBBLES */}

                                    {/* 1. Quality report score visualization */}
                                    {msg.type === 'quality_report' && msg.data && (
                                        <div className="mt-4 p-4 rounded-xl bg-brand-bg/50 border border-brand-border/40 space-y-4">
                                            <div className="flex flex-col md:flex-row items-center md:items-start justify-around space-y-4 md:space-y-0">
                                                {/* Circular scorecard */}
                                                <CircularProgress score={msg.data.quality_score} />

                                                {/* Breakdowns */}
                                                <div className="w-full md:w-[60%] space-y-2">
                                                    <span className="text-xs font-semibold text-brand-primary uppercase">Breakdowns</span>
                                                    {Object.entries(msg.data.breakdown || {}).map(([key, val]) => (
                                                        <div key={key} className="space-y-1">
                                                            <div className="flex justify-between text-xs font-mono">
                                                                <span className="capitalize">{key}</span>
                                                                <span>{val}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-brand-border rounded-full overflow-hidden">
                                                                <div className="h-full bg-brand-accent" style={{ width: `${val}%` }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Defect items detail list */}
                                            {msg.data.issues && msg.data.issues.length > 0 && (
                                                <div className="mt-4 border-t border-brand-border/30 pt-3 space-y-2">
                                                    <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider block">Detected Defects</span>
                                                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                                                        {msg.data.issues.map((iss, index) => (
                                                            <div key={index} className="p-2.5 rounded-lg bg-brand-sidebar/40 border-l-2 border-red-500 flex justify-between space-x-2 text-xs">
                                                                <div className="space-y-0.5">
                                                                    <div className="font-semibold text-slate-200">
                                                                        {iss.column ? `Column ${iss.column}` : 'Global Quality'}
                                                                    </div>
                                                                    <div className="text-slate-350">{iss.description}</div>
                                                                    <div className="text-[10px] text-brand-accent mt-1">
                                                                        💡 Rec: {iss.recommendation}
                                                                    </div>
                                                                </div>
                                                                <div className={`shrink-0 uppercase text-[9px] font-bold px-1.5 py-0.5 rounded-md h-fit ${iss.findings_severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                    {iss.findings_severity}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. Cleaning Recommendations Configurator Checklist */}
                                    {msg.type === 'clean_recommend' && (
                                        <div className="mt-4 p-4 rounded-xl bg-brand-bg/50 border border-brand-border/40 space-y-4">
                                            <div className="text-xs font-semibold text-brand-primary uppercase tracking-wider">
                                                Configure Selective Data Cleaning
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.duplicate_cleaner}
                                                        onChange={() => handleToggleConfig('duplicate_cleaner')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">Remove Duplicates</div>
                                                        <div className="text-[10px] text-brand-muted">Drop duplicate rows</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.text_cleaner}
                                                        onChange={() => handleToggleConfig('text_cleaner')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">Normalize Text</div>
                                                        <div className="text-[10px] text-brand-muted">Trim spaces & extra margins</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.validator}
                                                        onChange={() => handleToggleConfig('validator')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">Email/Phone Formats</div>
                                                        <div className="text-[10px] text-brand-muted">Nullify invalid address tokens</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.datetime_cleaner}
                                                        onChange={() => handleToggleConfig('datetime_cleaner')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">Standardize Dates</div>
                                                        <div className="text-[10px] text-brand-muted">Parses mixed date forms</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.outlier_cleaner}
                                                        onChange={() => handleToggleConfig('outlier_cleaner')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">IQR Outlier Handling</div>
                                                        <div className="text-[10px] text-brand-muted">Clamp outlier cells caps</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2.5 p-2 bg-brand-card rounded-lg cursor-pointer border border-brand-border/40 hover:border-brand-primary/40">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanConfig.datatype_cleaner}
                                                        onChange={() => handleToggleConfig('datatype_cleaner')}
                                                        className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                    />
                                                    <div>
                                                        <div className="font-semibold">Type Optimization</div>
                                                        <div className="text-[10px] text-brand-muted">Downcast types + compact RAM</div>
                                                    </div>
                                                </label>

                                                <div className="col-span-1 md:col-span-2 p-2 bg-brand-card rounded-lg border border-brand-border/40 space-y-1">
                                                    <label className="flex items-center space-x-2.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={cleanConfig.missing_value_cleaner}
                                                            onChange={() => handleToggleConfig('missing_value_cleaner')}
                                                            className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border"
                                                        />
                                                        <div>
                                                            <div className="font-semibold">Impute Missing Values</div>
                                                            <div className="text-[10px] text-brand-muted font-normal">Fills missing fields cleanly</div>
                                                        </div>
                                                    </label>
                                                    {cleanConfig.missing_value_cleaner && (
                                                        <div className="pl-6 mt-1 flex items-center space-x-4">
                                                            <span className="text-[10px] text-brand-muted font-medium">Strategy:</span>
                                                            {['median', 'mean', 'mode', 'ffill'].map((str) => (
                                                                <label key={str} className="flex items-center space-x-1 cursor-pointer text-[10px]">
                                                                    <input
                                                                        type="radio"
                                                                        name="missingStrategy"
                                                                        value={str}
                                                                        checked={missingStrategy === str}
                                                                        onChange={(e) => setMissingStrategy(e.target.value)}
                                                                        className="text-brand-primary focus:ring-brand-primary bg-brand-bg md:w-3.5 md:h-3.5"
                                                                    />
                                                                    <span className="capitalize">{str}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={triggerApplyClean}
                                                className="w-full bg-brand-accent hover:bg-emerald-600 text-white text-xs font-semibold py-2 px-4 rounded-xl transition duration-200 mt-2 flex items-center justify-center space-x-2 shadow-md focus:outline-none"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Apply Customized Pipeline</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* 3. Steps timeline progress loading elements */}
                                    {msg.type === 'cleaning_timeline' && (
                                        <CleaningTimeline />
                                    )}

                                    {/* 4. Comparison dashboard and downloads center */}
                                    {msg.type === 'cleaning_results' && msg.data && (
                                        <div className="mt-4 p-4 rounded-xl bg-brand-bg/50 border border-brand-border/40 space-y-4">
                                            <div className="text-xs font-semibold text-brand-accent uppercase tracking-wider block">
                                                Pipeline Completed — Quality Metrics Summary
                                            </div>

                                            {/* Score change card */}
                                            <div className="flex items-center justify-around bg-brand-card p-3 rounded-xl border border-brand-border/40">
                                                <div className="text-center font-mono">
                                                    <div className="text-xs text-brand-muted">Score Before</div>
                                                    <div className="text-lg font-bold text-red-400">{msg.data.quality_score_before}</div>
                                                </div>
                                                <div className="text-lg text-brand-muted">➔</div>
                                                <div className="text-center font-mono">
                                                    <div className="text-xs text-brand-muted">Score After</div>
                                                    <div className="text-lg font-bold text-brand-accent">{msg.data.quality_score_after}</div>
                                                </div>
                                            </div>

                                            {/* Metrics Grid */}
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {msg.data.comparison && msg.data.comparison.map((item, i) => {
                                                    const isImpr = item.pct_impr !== null && item.pct_impr !== 0;
                                                    const textClr = isImpr ? 'text-brand-accent' : 'text-slate-350';
                                                    return (
                                                        <div key={i} className="p-2.5 bg-brand-card rounded-lg border border-brand-border/30 text-xs flex justify-between items-center">
                                                            <div>
                                                                <div className="font-semibold text-slate-300">{item.metric}</div>
                                                                <div className="text-[10px] text-brand-muted mt-0.5">
                                                                    Before: <span className="font-mono text-slate-400">{item.before}</span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-200 mt-0.5">
                                                                    After: <span className="font-mono">{item.after}</span>
                                                                </div>
                                                            </div>
                                                            {isImpr && (
                                                                <span className="text-[10px] bg-brand-accent/10 px-1.5 py-0.5 rounded text-brand-accent font-semibold font-mono">
                                                                    {item.pct_impr > 0 ? `+${item.pct_impr}` : item.pct_impr}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Download Center */}
                                            <div className="border-t border-brand-border/30 pt-3 space-y-2">
                                                <span className="text-xs font-semibold text-brand-primary uppercase tracking-wider block">Downloads Center</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <a
                                                        href={getDownloadUrl('csv', activeDatasetId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-center rounded-lg bg-brand-card hover:bg-brand-hover text-xs font-medium border border-brand-border border-b-2 hover:-translate-y-0.5 transition-all text-slate-200"
                                                    >
                                                        📥 CSV Dataset
                                                    </a>
                                                    <a
                                                        href={getDownloadUrl('excel', activeDatasetId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-center rounded-lg bg-brand-card hover:bg-brand-hover text-xs font-medium border border-brand-border border-b-2 hover:-translate-y-0.5 transition-all text-slate-200"
                                                    >
                                                        📥 Excel Workbook
                                                    </a>
                                                    <a
                                                        href={getDownloadUrl('json', activeDatasetId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-center rounded-lg bg-brand-card hover:bg-brand-hover text-xs font-medium border border-brand-border border-b-2 hover:-translate-y-0.5 transition-all text-slate-200"
                                                    >
                                                        📥 JSON Array
                                                    </a>
                                                    <a
                                                        href={getDownloadReportUrl(activeDatasetId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-center rounded-lg bg-brand-primary hover:bg-blue-600 text-xs font-semibold border-b-2 border-brand-theme hover:-translate-y-0.5 transition-all text-white col-span-2 flex items-center justify-center space-x-1"
                                                    >
                                                        <span>📄 Download Operations PDF Report</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Copy Button */}
                                    {msg.content && (
                                        <div className="flex justify-end mt-2.5 pt-2 border-t border-brand-border/20">
                                            <button
                                                onClick={() => handleCopy(msg.content, msg.id || idx)}
                                                className={`flex items-center space-x-1.5 text-[10px] font-semibold py-1.5 px-2.5 rounded-lg border transition-all duration-200 focus:outline-none ${isUser
                                                        ? 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                                                        : 'text-brand-muted hover:text-brand-primary bg-brand-bg/30 hover:bg-brand-bg/50 border-brand-border/40 hover:border-brand-primary/30'
                                                    }`}
                                                title="Copy to clipboard"
                                            >
                                                {copiedId === (msg.id || idx) ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span className="text-emerald-400">Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                        </svg>
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-brand-card border border-brand-border/60 rounded-2xl rounded-bl-none p-4 max-w-[75%] shadow-md">
                            <div className="text-[10px] text-brand-muted mb-1 font-semibold uppercase tracking-wider">
                                Data Integrity Engineer
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="relative w-5 h-5 flex items-center justify-center">
                                    <div className="absolute inset-0 border-2 border-brand-primary/20 rounded-full" />
                                    <div className="absolute inset-0 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                                <span className="text-sm font-mono text-brand-muted truncate">
                                    {statusText || '🧠 Analyzing structures...'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar Footer */}
            <div className="p-4 border-t border-brand-border/60 bg-brand-sidebar/20">
                <div className="max-w-4xl mx-auto space-y-3">
                    {/* Horizontal chips container */}
                    <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none snap-x mask-fade">
                        {actionChips.map((chip, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleChipClick(chip.prompt)}
                                disabled={isProcessing}
                                className="shrink-0 snap-start bg-brand-card border border-brand-border hover:border-brand-primary/55 disabled:opacity-50 text-xs text-brand-text px-3 py-1.5 rounded-full transition-all duration-200 focus:outline-none"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                        <input
                            type="text"
                            placeholder={isProcessing ? "Processing..." : "Describe cleaning instructions or ask database issues..."}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isProcessing}
                            className="flex-1 bg-brand-card border border-brand-border focus:border-brand-primary rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-muted outline-none focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-50 transition-all duration-200"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isProcessing}
                            className="bg-brand-primary hover:bg-blue-600 disabled:bg-brand-muted/20 text-white p-3 rounded-xl transition-all duration-200 shrink-0 shadow-md focus:outline-none"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
