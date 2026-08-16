import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    User,
    Copy,
    Check,
    PaperPlaneRight,
    Broom,
    DownloadSimple,
    FilePdf,
    Info,
    Sparkle,
    Terminal,
    Gear,
    ArrowCounterClockwise
} from '@phosphor-icons/react';
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

// --- Custom Code Block component with individual copy state ---
function CodeBlock({ language, code }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code block:', err);
        });
    };

    return (
        <div className="border border-brand-border/60 rounded-xl overflow-hidden my-4 bg-[#0d0e15] shadow-lg">
            <div className="flex justify-between items-center px-4 py-2 bg-brand-sidebar border-b border-brand-border/40 text-[10px] uppercase font-mono tracking-widest text-brand-muted">
                <span className="flex items-center gap-1.5 font-bold">
                    <Terminal size={12} className="text-brand-primary" />
                    {language || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="hover:text-brand-primary transition-colors flex items-center gap-1 cursor-pointer py-0.5 px-1.5 rounded bg-brand-bg/40 border border-brand-border/20 active:scale-95"
                >
                    {copied ? (
                        <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={11} />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs text-brand-accent leading-relaxed bg-[#0a0b10]/80">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// --- Markdown Parser Supporting headers, bold, bullet points, inline code and code block fencing ---
function MessageFormatter({ text }) {
    if (!text) return null;

    // RegEx checking for code block blocks: ```[lang]\n[code]```
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Push text preceding code block
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: text.substring(lastIndex, match.index)
            });
        }
        // Push code block item
        parts.push({
            type: 'code',
            language: match[1],
            content: match[2].trim()
        });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            content: text.substring(lastIndex)
        });
    }

    return (
        <div className="space-y-3.5 text-sm leading-relaxed text-slate-100 font-normal">
            {parts.map((part, index) => {
                if (part.type === 'code') {
                    return <CodeBlock key={index} language={part.language} code={part.content} />;
                }

                // Render paragraphs, lists, headers and format inline backticks
                const lineSegments = part.content.split('\n');
                return (
                    <div key={index} className="space-y-2">
                        {lineSegments.map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return <div key={idx} className="h-1" />;

                            // Headers
                            if (trimmed.startsWith('#')) {
                                const depth = (trimmed.match(/^#+/) || ['#'])[0].length;
                                const content = trimmed.replace(/^#+/, '').trim();
                                if (depth === 1) {
                                    return <h1 key={idx} className="text-xl font-bold tracking-tight text-white mt-4 mb-2">{parseInlineFormat(content)}</h1>;
                                } else if (depth === 2) {
                                    return <h2 key={idx} className="text-lg font-semibold tracking-tight text-white mt-3.5 mb-1.5">{parseInlineFormat(content)}</h2>;
                                } else {
                                    return <h3 key={idx} className="text-base font-medium text-brand-primary mt-3 mb-1">{parseInlineFormat(content)}</h3>;
                                }
                            }

                            // Bullet Lists
                            if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                                const content = trimmed.substring(1).trim();
                                return (
                                    <ul key={idx} className="list-disc pl-5 my-1 text-slate-200">
                                        <li className="pl-0.5">{parseInlineFormat(content)}</li>
                                    </ul>
                                );
                            }

                            // Numbered Lists
                            if (/^\d+\./.test(trimmed)) {
                                const dotIndex = trimmed.indexOf('.');
                                const number = trimmed.substring(0, dotIndex);
                                const content = trimmed.substring(dotIndex + 1).trim();
                                return (
                                    <ol key={idx} className="list-decimal pl-5 my-1 text-slate-200" start={parseInt(number)}>
                                        <li className="pl-0.5">{parseInlineFormat(content)}</li>
                                    </ol>
                                );
                            }

                            return <p key={idx} className="text-slate-200">{parseInlineFormat(trimmed)}</p>;
                        })}
                    </div>
                );
            })}
        </div>
    );
}

// Format double asterisks (bolds) and single backticks (inline codes)
function parseInlineFormat(text) {
    if (!text) return '';

    // First handle double asterisks (bold)
    let segments = text.split('**');
    let boldNodes = segments.map((part, index) => {
        if (index % 2 === 1) {
            return <strong key={`b-${index}`} className="text-brand-primary font-bold">{part}</strong>;
        }

        // Inside unchanged text, look for inline code (ticks)
        let codeSegs = part.split('`');
        if (codeSegs.length > 1) {
            return codeSegs.map((codePart, codeIdx) => {
                if (codeIdx % 2 === 1) {
                    return (
                        <code key={`c-${codeIdx}`} className="px-1.5 py-0.5 rounded bg-brand-card/75 border border-brand-border/60 text-brand-accent text-xs font-mono font-bold mx-0.5">
                            {codePart}
                        </code>
                    );
                }
                return codePart;
            });
        }
        return part;
    });

    return boldNodes;
}

// --- Circular Score rendering ---
function CircularProgress({ score, size = 100, strokeWidth = 8 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const strokeColor = score >= 85 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';

    return (
        <div className="relative flex flex-col items-center justify-center p-2" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    className="text-brand-border/40"
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
                    transition={{ type: "spring", duration: 1.2, bounce: 0.2 }}
                    strokeLinecap="round"
                    stroke={strokeColor}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-bold tracking-tight text-white font-mono">{score}</span>
                <span className="text-[8px] text-brand-muted font-bold uppercase tracking-wider">Score</span>
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
        <div className="bg-brand-card/25 border border-brand-border/50 p-4 rounded-xl space-y-3.5 my-3 max-w-sm">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-primary rounded-full animate-ping" />
                <span>Running Pipeline...</span>
            </h4>
            <div className="space-y-2">
                {steps.map((st, i) => {
                    const isDone = i < currentStepIdx;
                    const isActive = i === currentStepIdx;

                    return (
                        <div key={st.key} className="flex items-center space-x-3 text-xs">
                            {isDone ? (
                                <div className="text-brand-primary font-bold">✓</div>
                            ) : isActive ? (
                                <div className="w-3 h-3 border-2 border-brand-primary border-t-transparent animate-spin rounded-full" />
                            ) : (
                                <div className="w-1.5 h-1.5 bg-brand-border rounded-full ml-1" />
                            )}
                            <span className={isActive ? 'text-brand-primary font-semibold' : isDone ? 'text-brand-muted' : 'text-brand-muted/50'}>
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
    const textareaRef = useRef(null);

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

    // Auto-scroll on new message
    useEffect(() => {
        scrollToBottom();
    }, [messages, isProcessing]);

    // Handle shift-enter and input growth
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '40px';
            const scrollHeight = textareaRef.current.scrollHeight;
            if (scrollHeight > 40) {
                textareaRef.current.style.height = Math.min(scrollHeight, 180) + 'px';
            }
        }
    }, [inputValue]);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed || isProcessing) return;
        onSendMessage(trimmed);
        setInputValue('');
        if (textareaRef.current) {
            textareaRef.current.style.height = '40px';
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Quick Action Suggestions Chips
    const actionChips = [
        { label: 'Inspect Quality', prompt: 'Quality Report' },
        { label: 'Full Auto-Clean', prompt: 'Clean Dataset' },
        { label: 'Check Duplicates', prompt: 'Count Duplicates' },
        { label: 'Missing Values', prompt: 'Analyze Missing Values' },
        { label: 'Outlier Analysis', prompt: 'Show Outliers' },
        { label: 'Data Type Tweaks', prompt: 'Find Invalid Data Types' }
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
        <div className="flex-1 flex flex-col h-full bg-[#0a0c14] relative overflow-hidden font-sans">
            {/* Top Workspace Header Bar */}
            <div className="px-6 py-3.5 border-b border-brand-border/40 bg-[#0d101a]/85 backdrop-blur-md flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                        <Sparkle size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Workspace Copilot</span>
                        <span className="text-xs font-semibold text-white truncate max-w-[220px]">
                            {activeDatasetName || 'Interactive Terminal'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onClearHistory}
                        disabled={messages.length === 0}
                        className="text-[10px] text-brand-muted hover:text-red-400 disabled:opacity-30 hover:bg-red-500/5 px-2.5 py-1.5 rounded-lg border border-brand-border/40 hover:border-red-500/20 transition-all font-semibold cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                        <Trash size={12} />
                        <span>Clear chat</span>
                    </button>
                </div>
            </div>

            {/* Chat Conversation Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-0 py-6 space-y-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 mt-12 bg-[#0d101a]/40 border border-brand-border/40 rounded-2xl">
                            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4 text-brand-primary shadow-lg shadow-brand-primary/5">
                                <Brain size={24} />
                            </div>
                            <h2 className="text-base font-bold text-white tracking-wide">Welcome to Antigravity Copilot</h2>
                            <p className="text-xs text-brand-muted max-w-md mt-2 leading-relaxed">
                                Meet your intelligent data integrity assistant. Clean missing values, scan data quality anomalies, generate BI reports, or edit columns in real-time.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div
                                    key={msg.id || idx}
                                    className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    {/* Avatar Column */}
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border shadow-sm ${isUser
                                            ? 'bg-brand-primary/15 border-brand-primary/30 text-brand-primary'
                                            : 'bg-[#181c2e] border-brand-border/70 text-brand-accent'
                                        }`}>
                                        {isUser ? (
                                            <User size={15} />
                                        ) : (
                                            <Brain size={15} className="animate-pulse" />
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">
                                                {isUser ? 'You' : 'Antigravity'}
                                            </span>
                                        </div>

                                        <div className={`p-4 rounded-xl text-slate-100 text-sm leading-relaxed border shadow-sm ${isUser
                                                ? 'bg-[#121626]/75 border-brand-border/80 text-right md:-ml-12'
                                                : 'bg-[#0d101a]/60 border-brand-border/30 md:-mr-12'
                                            }`}>
                                            {/* Text formatted */}
                                            {msg.content && <MessageFormatter text={msg.content} />}

                                            {/* Plotly inline charts */}
                                            {msg.type === 'chart' && msg.chart_data && (
                                                <PlotlyChart chartData={msg.chart_data} />
                                            )}

                                            {/* Dynamic Quality Score breakdown report card */}
                                            {msg.type === 'quality_report' && msg.data && (
                                                <div className="mt-4 p-4 rounded-xl bg-brand-bg/40 border border-brand-border/60 space-y-4">
                                                    <div className="flex flex-col md:flex-row items-center justify-around gap-4">
                                                        <CircularProgress score={msg.data.quality_score} />
                                                        <div className="flex-1 w-full space-y-2.5">
                                                            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">Quality Metric Breakdown</span>
                                                            {Object.entries(msg.data.breakdown || {}).map(([key, val]) => (
                                                                <div key={key} className="space-y-1">
                                                                    <div className="flex justify-between text-xs font-semibold">
                                                                        <span className="capitalize font-mono text-brand-muted">{key}</span>
                                                                        <span className="text-white font-mono">{val}%</span>
                                                                    </div>
                                                                    <div className="w-full h-1 bg-[#151928] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-brand-accent rounded-full" style={{ width: `${val}%` }} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {msg.data.issues && msg.data.issues.length > 0 && (
                                                        <div className="border-t border-brand-border/30 pt-3 space-y-2">
                                                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Detected Defects</span>
                                                            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                                {msg.data.issues.map((iss, i) => (
                                                                    <div key={i} className="p-3 rounded-lg bg-brand-bg/50 border border-brand-border/40 border-l-2 border-l-red-500 flex justify-between gap-3 text-xs">
                                                                        <div className="space-y-1">
                                                                            <span className="font-semibold text-slate-200 block">
                                                                                {iss.column ? `Column: ${iss.column}` : 'Workspace'}
                                                                            </span>
                                                                            <span className="text-slate-400 block leading-normal">{iss.description}</span>
                                                                            <span className="text-[10px] text-brand-accent font-medium mt-1 inline-block bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/20">
                                                                                💡 Suggestion: {iss.recommendation}
                                                                            </span>
                                                                        </div>
                                                                        <span className={`shrink-0 uppercase text-[8px] font-bold px-2 py-0.5 rounded h-fit ${iss.findings_severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                                                            }`}>
                                                                            {iss.findings_severity}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Customized Selective Operations Checklist Configurator */}
                                            {msg.type === 'clean_recommend' && (
                                                <div className="mt-4 p-4 rounded-xl bg-brand-bg/40 border border-brand-border/60 space-y-4">
                                                    <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">Configure Data Operations Pipeline</span>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.duplicate_cleaner}
                                                                onChange={() => handleToggleConfig('duplicate_cleaner')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">Drop Duplicates</span>
                                                                <span className="text-[10px] text-brand-muted">Drop duplicate row entries</span>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.text_cleaner}
                                                                onChange={() => handleToggleConfig('text_cleaner')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">Text Normalization</span>
                                                                <span className="text-[10px] text-brand-muted">Standardize text case & margins</span>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.validator}
                                                                onChange={() => handleToggleConfig('validator')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">Email/Phone Formats</span>
                                                                <span className="text-[10px] text-brand-muted">Nullify invalid structural strings</span>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.datetime_cleaner}
                                                                onChange={() => handleToggleConfig('datetime_cleaner')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">Standardize Dates</span>
                                                                <span className="text-[10px] text-brand-muted">Parse varied column formats</span>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.outlier_cleaner}
                                                                onChange={() => handleToggleConfig('outlier_cleaner')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">IQR Outlier Clamp</span>
                                                                <span className="text-[10px] text-brand-muted">Cap feature values outlier bounds</span>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-xl cursor-pointer border border-brand-border/40 hover:border-brand-primary/40 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={cleanConfig.datatype_cleaner}
                                                                onChange={() => handleToggleConfig('datatype_cleaner')}
                                                                className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-white block">Type Downcasting</span>
                                                                <span className="text-[10px] text-brand-muted">Compress numeric floats & sizes</span>
                                                            </div>
                                                        </label>

                                                        <div className="col-span-1 sm:col-span-2 p-3 bg-brand-sidebar rounded-xl border border-brand-border/40 space-y-2">
                                                            <label className="flex items-center space-x-3 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={cleanConfig.missing_value_cleaner}
                                                                    onChange={() => handleToggleConfig('missing_value_cleaner')}
                                                                    className="rounded text-brand-primary focus:ring-brand-primary bg-brand-bg border-brand-border w-4 h-4 cursor-pointer"
                                                                />
                                                                <div>
                                                                    <span className="font-semibold text-white">Impute Zero/Empty Fields</span>
                                                                    <span className="text-[10px] text-brand-muted block">Calculate replacement entries</span>
                                                                </div>
                                                            </label>

                                                            {cleanConfig.missing_value_cleaner && (
                                                                <div className="pl-7 pt-1 flex items-center gap-3">
                                                                    <span className="text-[10px] text-brand-muted font-bold font-mono">STRATEGY:</span>
                                                                    {['median', 'mean', 'mode', 'ffill'].map((str) => (
                                                                        <label key={str} className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                                                                            <input
                                                                                type="radio"
                                                                                name="missingStrategy"
                                                                                value={str}
                                                                                checked={missingStrategy === str}
                                                                                onChange={(e) => setMissingStrategy(e.target.value)}
                                                                                className="text-brand-primary focus:ring-brand-primary bg-brand-bg w-3 h-3 cursor-pointer"
                                                                            />
                                                                            <span className="capitalize font-mono font-medium text-slate-350">{str}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={triggerApplyClean}
                                                        className="w-full bg-brand-accent hover:bg-emerald-600 active:scale-[0.98] transition-all text-brand-bg text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-md hover:shadow-emerald-500/10 cursor-pointer border border-brand-accent"
                                                    >
                                                        <Sparkle size={14} weight="fill" />
                                                        <span>Apply Operations Pipeline</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Modular Step cleaning timelines */}
                                            {msg.type === 'cleaning_timeline' && (
                                                <CleaningTimeline />
                                            )}

                                            {/* Results overview stats comparisons & download panel */}
                                            {msg.type === 'cleaning_results' && msg.data && (
                                                <div className="mt-4 p-4 rounded-xl bg-brand-bg/40 border border-brand-border/60 space-y-4">
                                                    <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">Operations Success — Dataset Cleaned</span>

                                                    <div className="flex items-center justify-center gap-6 bg-[#0a0b10]/80 p-3 rounded-xl border border-brand-border/40 font-mono">
                                                        <div className="text-center">
                                                            <span className="text-[9px] text-brand-muted uppercase block">Before Code</span>
                                                            <span className="text-base font-bold text-red-400">{msg.data.quality_score_before}</span>
                                                        </div>
                                                        <span className="text-brand-muted text-sm shrink-0">➔</span>
                                                        <div className="text-center">
                                                            <span className="text-[9px] text-brand-muted uppercase block">After Code</span>
                                                            <span className="text-base font-bold text-brand-accent">{msg.data.quality_score_after}</span>
                                                        </div>
                                                    </div>

                                                    {/* Comparison Metrics Grid */}
                                                    <div className="grid grid-cols-2 gap-2.5">
                                                        {msg.data.comparison && msg.data.comparison.map((item, i) => {
                                                            const isImpr = item.pct_impr !== null && item.pct_impr !== 0;
                                                            return (
                                                                <div key={i} className="p-3 bg-[#0f111c] rounded-xl border border-brand-border/40 text-xs flex justify-between items-center gap-2">
                                                                    <div>
                                                                        <span className="font-semibold text-slate-200 block truncate max-w-[110px]">{item.metric}</span>
                                                                        <span className="text-[10px] text-brand-muted block mt-0.5 font-mono">
                                                                            Before: <span className="text-slate-400">{item.before}</span>
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-300 block mt-0.5 font-mono">
                                                                            After: <span className="text-white font-bold">{item.after}</span>
                                                                        </span>
                                                                    </div>
                                                                    {isImpr && (
                                                                        <span className="text-[9px] bg-brand-accent/10 px-1.5 py-0.5 rounded text-brand-accent font-bold font-mono">
                                                                            {item.pct_impr > 0 ? `+${item.pct_impr}` : item.pct_impr}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Operations PDF & File Downloads Center */}
                                                    <div className="border-t border-brand-border/30 pt-3.5 space-y-2">
                                                        <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">Export Workspace Formats</span>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            <a
                                                                href={getDownloadUrl('csv', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-xl bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/60 hover:-translate-y-0.5 transition-all text-slate-250 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>CSV</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadUrl('excel', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-xl bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/60 hover:-translate-y-0.5 transition-all text-slate-250 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>Excel</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadUrl('json', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-xl bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/60 hover:-translate-y-0.5 transition-all text-slate-250 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>JSON</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadReportUrl(activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2.5 text-center rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold border border-brand-primary/30 hover:-translate-y-0.5 transition-all col-span-1 sm:col-span-3 flex items-center justify-center gap-2 cursor-pointer"
                                                            >
                                                                <FilePdf size={14} />
                                                                <span>Download Cleaning Report (PDF)</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Chat message manual copies */}
                                            {msg.content && (
                                                <div className="flex justify-end mt-2 pt-2 border-t border-brand-border/20">
                                                    <button
                                                        onClick={() => handleCopy(msg.content, msg.id || idx)}
                                                        className={`flex items-center gap-1 py-1 px-2 rounded-lg border text-[10px] transition-all cursor-pointer ${isUser
                                                                ? 'text-white/60 hover:text-white bg-white/5 border-white/10 hover:bg-white/10 active:scale-95'
                                                                : 'text-brand-muted hover:text-brand-primary bg-brand-bg/30 border-brand-border/60 hover:border-brand-primary/30 hover:bg-brand-bg/50 active:scale-[0.95]'
                                                            }`}
                                                        title="Copy text content"
                                                    >
                                                        {copiedId === (msg.id || idx) ? (
                                                            <>
                                                                <Check size={11} className="text-emerald-400" />
                                                                <span className="text-emerald-400 font-bold">Copied!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={11} />
                                                                <span className="font-semibold">Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Active dynamic typing/thinking status indicator bubble */}
                    {isProcessing && (
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border bg-[#181c2e] border-brand-border/70 text-brand-accent">
                                <Brain size={15} className="animate-spin" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">Antigravity</div>
                                <div className="space-y-2.5">
                                    <div className="flex items-center space-x-1.5 px-4 py-3 bg-[#0d101a]/40 border border-brand-border/40 rounded-xl rounded-tl-none w-fit">
                                        <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-brand-muted bg-[#0c0d15]/50 px-2.5 py-1 rounded w-fit border border-brand-border/20">
                                        <ArrowCounterClockwise size={11} className="animate-spin text-brand-primary" />
                                        <span>{statusText || 'Executing Pandas commands...'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Chat Bottom Suggestion Chips & Form Input Footer Bar */}
            <div className="border-t border-brand-border/40 bg-[#0d101a]/70 backdrop-blur-md px-4 py-4 z-10">
                <div className="max-w-3xl mx-auto space-y-3">

                    {/* suggestion quick action pills select chips */}
                    {!isProcessing && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x mask-fade">
                            {actionChips.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleChipClick(chip.prompt)}
                                    disabled={isProcessing}
                                    className="shrink-0 snap-start bg-brand-sidebar hover:bg-brand-hover hover:border-brand-primary/50 text-[10px] text-slate-200 border border-brand-border/60 hover:text-white px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer font-bold uppercase tracking-wider active:scale-95"
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Integrated Chat Box Area */}
                    <div className="relative rounded-2xl bg-[#0f1220]/75 border border-brand-border focus-within:border-brand-primary/80 focus-within:ring-1 focus-within:ring-brand-primary/20 transition-all p-2 select-none">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder={isProcessing ? "Antigravity is working..." : "Message Antigravity..."}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing}
                            className="w-full bg-transparent text-brand-text placeholder-brand-muted/75 text-xs outline-none resize-none px-3.5 pt-2 pb-1.5 max-h-44 custom-scrollbar font-medium leading-relaxed"
                            style={{ height: '40px' }}
                        />

                        {/* Send button inside text-box wrapper */}
                        <div className="flex items-center justify-between px-3 pb-1 pt-1.5 border-t border-brand-border/10">
                            <span className="text-[9px] text-brand-muted/60 font-semibold font-sans tracking-wide">
                                Enter to send, Shift+Enter for new line
                            </span>
                            <button
                                onClick={() => handleSubmit()}
                                disabled={!inputValue.trim() || isProcessing}
                                className="bg-brand-primary hover:bg-blue-600 disabled:bg-brand-muted/20 text-white p-2 rounded-xl transition-all duration-150 shrink-0 shadow-md cursor-pointer disabled:opacity-40 active:scale-95"
                                title="Send Message"
                            >
                                <PaperPlaneRight size={13} weight="fill" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
