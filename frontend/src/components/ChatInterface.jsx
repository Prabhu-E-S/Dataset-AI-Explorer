import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Brain,
    User,
    Copy,
    Check,
    PaperPlaneRight,
    DownloadSimple,
    FilePdf,
    Terminal,
    Trash
} from '@phosphor-icons/react';

import { getDownloadUrl, getDownloadReportUrl } from '../services/api';

const CLEANING_STEPS = [
    { key: 'inspect', text: 'Inspecting dataset' },
    { key: 'missing', text: 'Checking missing values' },
    { key: 'dups', text: 'Finding duplicates' },
    { key: 'std', text: 'Standardizing values' },
    { key: 'mem', text: 'Optimizing memory' },
    { key: 'pdf', text: 'Generating report' },
    { key: 'done', text: 'Cleaning complete' }
];

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
            className="w-full h-[320px] rounded-lg bg-brand-bg border border-brand-border/70 p-2 my-4"
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
        <div className="border border-brand-border/70 rounded-lg overflow-hidden my-4 bg-[#0d0e15]">
            <div className="flex justify-between items-center px-4 py-2 bg-brand-sidebar border-b border-brand-border/60 text-[10px] uppercase font-mono tracking-wider text-brand-muted">
                <span className="flex items-center gap-1.5 font-semibold">
                    <Terminal size={12} className="text-brand-muted" />
                    {language || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1 px-2 rounded border border-transparent hover:border-brand-border active:scale-95"
                >
                    {copied ? (
                        <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy size={11} />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs text-slate-200 leading-relaxed bg-[#0a0b10]">
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
        <div className="space-y-3 text-[13px] sm:text-sm leading-7 text-slate-200 font-normal">
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
                                    return <h1 key={idx} className="text-lg font-semibold tracking-tight text-white mt-4 mb-2">{parseInlineFormat(content)}</h1>;
                                } else if (depth === 2) {
                                    return <h2 key={idx} className="text-base font-semibold tracking-tight text-white mt-3.5 mb-1.5">{parseInlineFormat(content)}</h2>;
                                } else {
                                    return <h3 key={idx} className="text-sm font-semibold text-white mt-3 mb-1">{parseInlineFormat(content)}</h3>;
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
            return <strong key={`b-${index}`} className="text-white font-semibold">{part}</strong>;
        }

        // Inside unchanged text, look for inline code (ticks)
        let codeSegs = part.split('`');
        if (codeSegs.length > 1) {
            return codeSegs.map((codePart, codeIdx) => {
                if (codeIdx % 2 === 1) {
                    return (
                        <code key={`c-${codeIdx}`} className="px-1.5 py-0.5 rounded bg-brand-card/80 border border-brand-border/70 text-slate-100 text-xs font-mono font-medium mx-0.5">
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
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStepIdx(prev => {
                if (prev >= CLEANING_STEPS.length - 1) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 1;
            });
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-brand-card/25 border border-brand-border/70 p-4 rounded-lg space-y-3.5 my-3 max-w-sm">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                <span>Cleaning pipeline</span>
            </h4>
            <div className="space-y-2">
                {CLEANING_STEPS.map((st, i) => {
                    const isDone = i < currentStepIdx;
                    const isActive = i === currentStepIdx;

                    return (
                        <div key={st.key} className="flex items-center space-x-3 text-xs">
                            {isDone ? (
                                <Check size={12} className="text-brand-accent" />
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
        { label: 'Quality Report', prompt: 'Quality Report' },
        { label: 'Clean Dataset', prompt: 'Clean Dataset' },
        { label: 'Count Duplicates', prompt: 'Count Duplicates' },
        { label: 'Missing Values', prompt: 'Analyze Missing Values' },
        { label: 'Show Outliers', prompt: 'Show Outliers' },
        { label: 'Invalid Types', prompt: 'Find Invalid Data Types' }
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
        <div className="flex-1 flex flex-col h-full bg-brand-bg relative overflow-hidden font-sans">
            {/* Top Workspace Header Bar */}
            <div className="px-4 sm:px-6 py-3 border-b border-brand-border/70 bg-brand-sidebar flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded-md bg-brand-card border border-brand-border text-brand-muted">
                        <Brain size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-brand-muted uppercase font-semibold tracking-wider">AI Analyst</span>
                        <span className="text-xs font-semibold text-white truncate max-w-[220px]">
                            {activeDatasetName || 'Dataset workspace'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onClearHistory}
                        disabled={messages.length === 0}
                        className="text-[10px] text-brand-muted hover:text-red-300 disabled:opacity-30 hover:bg-red-500/5 px-2.5 py-1.5 rounded-md border border-brand-border hover:border-red-500/30 transition-all font-semibold cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                        <Trash size={12} />
                        <span>Clear chat</span>
                    </button>
                </div>
            </div>

            {/* Chat Conversation Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-7">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-start p-5 sm:p-6 mt-8 bg-brand-sidebar border border-brand-border rounded-lg">
                            <div className="w-9 h-9 rounded-md bg-brand-card border border-brand-border flex items-center justify-center mb-4 text-brand-muted">
                                <Brain size={18} />
                            </div>
                            <h2 className="text-base font-semibold text-white tracking-tight">Start with the dataset context</h2>
                            <p className="text-sm text-brand-muted max-w-xl mt-2 leading-6 text-left">
                                Ask for a quality report, cleaning plan, duplicate count, missing-value analysis, outlier scan, or a plain-language summary of the active dataset.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div
                                    key={msg.id || idx}
                                    className={`flex items-start gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    {/* Avatar Column */}
                                    <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center border ${isUser
                                        ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                                        : 'bg-brand-card border-brand-border text-brand-muted'
                                        }`}>
                                        {isUser ? (
                                            <User size={15} />
                                        ) : (
                                            <Brain size={15} />
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className={`flex-1 min-w-0 space-y-2 ${isUser ? 'flex flex-col items-end' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider">
                                                {isUser ? 'You' : 'AI Analyst'}
                                            </span>
                                        </div>

                                        <div className={`min-w-0 text-slate-100 text-sm leading-relaxed border ${isUser
                                            ? 'max-w-[85%] rounded-lg bg-brand-primary/10 border-brand-primary/25 px-3.5 py-2.5 text-left'
                                            : 'w-full rounded-lg bg-brand-sidebar border-brand-border/70 p-4 sm:p-5'
                                            }`}>
                                            {/* Text formatted */}
                                            {msg.content && <MessageFormatter text={msg.content} />}

                                            {/* Plotly inline charts */}
                                            {msg.type === 'chart' && msg.chart_data && (
                                                <PlotlyChart chartData={msg.chart_data} />
                                            )}

                                            {/* Dynamic Quality Score breakdown report card */}
                                            {msg.type === 'quality_report' && msg.data && (
                                                <div className="mt-4 p-4 rounded-lg bg-brand-bg/60 border border-brand-border/70 space-y-4">
                                                    <div className="flex flex-col md:flex-row items-center justify-around gap-4">
                                                        <CircularProgress score={msg.data.quality_score} />
                                                        <div className="flex-1 w-full space-y-2.5">
                                                            <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider block">Quality metric breakdown</span>
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
                                                            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">Detected issues</span>
                                                            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                                {msg.data.issues.map((iss, i) => (
                                                                    <div key={i} className="p-3 rounded-md bg-brand-sidebar border border-brand-border/70 border-l-2 border-l-red-500 flex flex-col sm:flex-row sm:justify-between gap-3 text-xs">
                                                                        <div className="space-y-1">
                                                                            <span className="font-semibold text-slate-200 block">
                                                                                {iss.column ? `Column: ${iss.column}` : 'Workspace'}
                                                                            </span>
                                                                            <span className="text-slate-400 block leading-normal">{iss.description}</span>
                                                                            <span className="text-[10px] text-brand-muted font-medium mt-1 inline-block">
                                                                                Recommendation: {iss.recommendation}
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
                                                <div className="mt-4 p-4 rounded-lg bg-brand-bg/60 border border-brand-border/70 space-y-4">
                                                    <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider block">Configure cleaning operations</span>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <label className="flex items-center space-x-3 p-3 bg-brand-sidebar hover:bg-brand-hover rounded-lg cursor-pointer border border-brand-border/70 hover:border-brand-primary/40 transition-colors">
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

                                                        <div className="col-span-1 sm:col-span-2 p-3 bg-brand-sidebar rounded-lg border border-brand-border/70 space-y-2">
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
                                                                <div className="pl-7 pt-1 flex flex-wrap items-center gap-3">
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
                                                        className="w-full bg-brand-accent hover:bg-emerald-600 active:scale-[0.98] transition-all text-brand-bg text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 cursor-pointer border border-brand-accent"
                                                    >
                                                        <Check size={14} weight="bold" />
                                                        <span>Apply cleaning pipeline</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Modular Step cleaning timelines */}
                                            {msg.type === 'cleaning_timeline' && (
                                                <CleaningTimeline />
                                            )}

                                            {/* Results overview stats comparisons & download panel */}
                                            {msg.type === 'cleaning_results' && msg.data && (
                                                <div className="mt-4 p-4 rounded-lg bg-brand-bg/60 border border-brand-border/70 space-y-4">
                                                    <span className="text-[10px] font-semibold text-brand-accent uppercase tracking-wider block">Dataset cleaned</span>

                                                    <div className="flex items-center justify-center gap-6 bg-brand-sidebar p-3 rounded-lg border border-brand-border/70 font-mono">
                                                        <div className="text-center">
                                                            <span className="text-[9px] text-brand-muted uppercase block">Before</span>
                                                            <span className="text-base font-bold text-red-400">{msg.data.quality_score_before}</span>
                                                        </div>
                                                        <span className="text-brand-muted text-sm shrink-0">to</span>
                                                        <div className="text-center">
                                                            <span className="text-[9px] text-brand-muted uppercase block">After</span>
                                                            <span className="text-base font-bold text-brand-accent">{msg.data.quality_score_after}</span>
                                                        </div>
                                                    </div>

                                                    {/* Comparison Metrics Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {msg.data.comparison && msg.data.comparison.map((item, i) => {
                                                            const isImpr = item.pct_impr !== null && item.pct_impr !== 0;
                                                            return (
                                                                <div key={i} className="p-3 bg-brand-sidebar rounded-lg border border-brand-border/70 text-xs flex justify-between items-center gap-2 min-w-0">
                                                                    <div className="min-w-0">
                                                                        <span className="font-semibold text-slate-200 block truncate">{item.metric}</span>
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
                                                        <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider block">Export files</span>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            <a
                                                                href={getDownloadUrl('csv', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-lg bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/70 transition-all text-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>CSV</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadUrl('excel', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-lg bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/70 transition-all text-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>Excel</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadUrl('json', activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2 text-center rounded-lg bg-brand-sidebar hover:bg-brand-hover text-xs font-semibold border border-brand-border/70 transition-all text-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
                                                            >
                                                                <DownloadSimple size={13} className="text-brand-muted" />
                                                                <span>JSON</span>
                                                            </a>
                                                            <a
                                                                href={getDownloadReportUrl(activeDatasetId)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="py-2.5 text-center rounded-lg bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary text-xs font-semibold border border-brand-primary/30 transition-all col-span-1 sm:col-span-3 flex items-center justify-center gap-2 cursor-pointer"
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
                                                <div className="flex justify-end mt-3 pt-2 border-t border-brand-border/30">
                                                    <button
                                                        onClick={() => handleCopy(msg.content, msg.id || idx)}
                                                        className={`flex items-center gap-1 py-1 px-2 rounded-md border text-[10px] transition-all cursor-pointer ${isUser
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
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center border bg-brand-card border-brand-border text-brand-muted">
                                <Brain size={15} />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider">AI Analyst</div>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-brand-sidebar border border-brand-border/70 rounded-lg w-fit">
                                        <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-brand-muted px-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                                        <span>{statusText || 'Working on the request...'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Chat Bottom Suggestion Chips & Form Input Footer Bar */}
            <div className="border-t border-brand-border/70 bg-brand-sidebar px-4 py-4 z-10">
                <div className="max-w-3xl mx-auto space-y-3">

                    {/* suggestion quick action pills select chips */}
                    {!isProcessing && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar snap-x">
                            {actionChips.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleChipClick(chip.prompt)}
                                    disabled={isProcessing}
                                    className="shrink-0 snap-start bg-brand-bg hover:bg-brand-hover hover:border-brand-primary/40 text-[11px] text-slate-200 border border-brand-border px-3 py-1.5 rounded-md transition-all duration-150 cursor-pointer font-medium active:scale-95"
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Integrated Chat Box Area */}
                    <div className="relative rounded-lg bg-brand-bg border border-brand-border focus-within:border-brand-primary/80 focus-within:ring-1 focus-within:ring-brand-primary/20 transition-all p-2 select-none">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder={isProcessing ? "AI Analyst is working..." : "Ask about this dataset..."}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing}
                            className="w-full bg-transparent text-brand-text placeholder-brand-muted/75 text-sm outline-none resize-none px-3 pt-2 pb-1.5 max-h-44 custom-scrollbar font-medium leading-relaxed"
                            style={{ height: '40px' }}
                        />

                        {/* Send button inside text-box wrapper */}
                        <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-1.5 border-t border-brand-border/40">
                            <span className="text-[9px] text-brand-muted/60 font-semibold font-sans tracking-wide">
                                Enter to send, Shift+Enter for new line
                            </span>
                            <button
                                onClick={() => handleSubmit()}
                                disabled={!inputValue.trim() || isProcessing}
                                className="bg-brand-primary hover:bg-blue-600 disabled:bg-brand-muted/20 text-white p-2 rounded-md transition-all duration-150 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
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

