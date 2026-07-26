import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ColumnExplorer({ isOpen, onClose, columnsInfo }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedColumn, setExpandedColumn] = useState(null);

    // Filter columns based on search input
    const filteredColumns = useMemo(() => {
        if (!columnsInfo) return [];
        return Object.entries(columnsInfo).filter(([name]) =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [columnsInfo, searchTerm]);

    const toggleColumnExpand = (colName) => {
        if (expandedColumn === colName) {
            setExpandedColumn(null);
        } else {
            setExpandedColumn(colName);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay for mobile viewports */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed lg:sticky right-0 top-0 lg:top-auto h-full lg:h-[calc(100vh-64px)] w-80 max-w-[90vw] bg-brand-sidebar border-l border-brand-border z-40 flex flex-col shadow-2xl lg:shadow-none"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-brand-border flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-brand-text">Column Explorer</h3>
                                <p className="text-xs text-brand-muted">Explore structural variables and distributions</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-brand-hover text-brand-muted hover:text-brand-text transition-colors"
                                title="Collapse sidebar"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Quick Clean Search Filter */}
                        <div className="p-3 border-b border-brand-border">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Filter columns..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-lg py-1.5 pl-8 pr-4 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-primary transition-all duration-200"
                                />
                                <svg
                                    className="w-4 h-4 text-brand-muted absolute left-2.5 top-2.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Columns listings */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredColumns.length === 0 ? (
                                <div className="text-center py-8 text-sm text-brand-muted">
                                    No columns found.
                                </div>
                            ) : (
                                filteredColumns.map(([name, details]) => {
                                    const isExpanded = expandedColumn === name;
                                    const isNumeric = ['int', 'float'].some(t =>
                                        details.data_type?.toLowerCase().includes(t)
                                    );
                                    const missingCount = details.missing_count || 0;
                                    const totalRows = details.total_count || 1; // avoid / 0
                                    const missingPct = ((missingCount / totalRows) * 100).toFixed(1);

                                    return (
                                        <div
                                            key={name}
                                            className={`border rounded-lg transition-all duration-200 ${isExpanded
                                                    ? 'border-brand-primary bg-brand-card/50'
                                                    : 'border-brand-border hover:border-brand-hover bg-brand-card/20'
                                                }`}
                                        >
                                            {/* Accordion Trigger */}
                                            <button
                                                onClick={() => toggleColumnExpand(name)}
                                                className="w-full px-3 py-2.5 flex items-center justify-between text-left focus:outline-none"
                                            >
                                                <div className="flex items-center space-x-2.5 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isNumeric ? 'bg-blue-400' : 'bg-green-400'
                                                        }`} title={isNumeric ? 'Numeric Variable' : 'Categorical Variable'} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-brand-text truncate pr-2">{name}</p>
                                                        <p className="text-xs text-brand-muted font-mono lowercase truncate">
                                                            {details.data_type || 'object'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <svg
                                                    className={`w-4 h-4 text-brand-muted shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-primary' : ''
                                                        }`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {/* Expandable statistics panel */}
                                            <AnimatePresence initial={false}>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden border-t border-brand-border/40 font-sans"
                                                    >
                                                        <div className="p-3 space-y-2 text-xs">
                                                            {/* Missing and Uniques stats */}
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="p-2 rounded bg-brand-bg/50 border border-brand-border/40">
                                                                    <span className="block text-[10px] text-brand-muted uppercase">Missing</span>
                                                                    <span className="font-semibold text-brand-text">
                                                                        {missingCount} <span className="text-[10px] font-normal text-brand-muted">({missingPct}%)</span>
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 rounded bg-brand-bg/50 border border-brand-border/40">
                                                                    <span className="block text-[10px] text-brand-muted uppercase">Unique</span>
                                                                    <span className="font-semibold text-brand-text">
                                                                        {details.distinct_count ?? 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Numeric Details */}
                                                            {isNumeric && details.stats && (
                                                                <div className="space-y-1.5 bg-brand-bg/30 p-2.5 rounded-lg border border-brand-border/40 font-mono">
                                                                    {details.stats.mean !== undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-brand-muted">Mean:</span>
                                                                            <span className="text-brand-text truncate max-w-[120px]">{Number(details.stats.mean).toFixed(4)}</span>
                                                                        </div>
                                                                    )}
                                                                    {details.stats["50%"] !== undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-brand-muted">Median:</span>
                                                                            <span className="text-brand-text truncate max-w-[120px]">{Number(details.stats["50%"]).toFixed(4)}</span>
                                                                        </div>
                                                                    )}
                                                                    {details.stats.min !== undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-brand-muted">Min:</span>
                                                                            <span className="text-brand-text truncate max-w-[120px]">{Number(details.stats.min).toFixed(4)}</span>
                                                                        </div>
                                                                    )}
                                                                    {details.stats.max !== undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-brand-muted">Max:</span>
                                                                            <span className="text-brand-text truncate max-w-[120px]">{Number(details.stats.max).toFixed(4)}</span>
                                                                        </div>
                                                                    )}
                                                                    {details.stats.std !== undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-brand-muted">Std Dev:</span>
                                                                            <span className="text-brand-text truncate max-w-[120px]">{Number(details.stats.std).toFixed(4)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Categorical Details */}
                                                            {!isNumeric && details.stats && details.stats.top_values && (
                                                                <div className="space-y-1.5">
                                                                    <span className="block text-[10px] text-brand-muted uppercase mb-1">Top Frequencies</span>
                                                                    <div className="space-y-1 bg-brand-bg/30 p-2 rounded-lg border border-brand-border/40 max-h-32 overflow-y-auto">
                                                                        {details.stats.top_values.map(([val, freq], idx) => (
                                                                            <div key={idx} className="flex justify-between text-[11px] truncate">
                                                                                <span className="text-brand-text truncate max-w-[130px]" title={String(val)}>
                                                                                    {String(val) === 'null' || val === null ? <em className="text-red-400">null</em> : String(val)}
                                                                                </span>
                                                                                <span className="text-brand-muted font-mono shrink-0 pr-1">{freq}x</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
