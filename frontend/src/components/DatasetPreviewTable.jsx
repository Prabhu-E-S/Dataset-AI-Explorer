import React, { useState, useMemo } from 'react';
import {
    FiSearch,
    FiChevronLeft,
    FiChevronRight,
    FiChevronsLeft,
    FiChevronsRight,
    FiFilter
} from 'react-icons/fi';

export default function DatasetPreviewTable({ columns = [], data = [], totalRows = 0 }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // 1. Client-side Search Filter (across all column cells)
    const filteredData = useMemo(() => {
        setCurrentPage(1); // Reset to page 1 on filter
        if (!searchTerm.trim()) return data;

        const term = searchTerm.toLowerCase().trim();
        return data.filter(row => {
            return Object.values(row).some(val =>
                val !== null && val !== undefined && String(val).toLowerCase().includes(term)
            );
        });
    }, [data, searchTerm]);

    // 2. Pagination Calculations
    const totalRecords = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredData.slice(startIndex, startIndex + pageSize);
    }, [filteredData, currentPage, pageSize]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-brand-card/15 border border-brand-border/55 rounded-lg p-4 select-none">

            {/* Table Controllers Block */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72 group">
                        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary transition-colors text-[13px]" />
                        <input
                            type="text"
                            placeholder="Search preview rows..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-brand-bg/40 border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-text placeholder-brand-muted outline-none transition-all font-medium"
                        />
                    </div>
                    {searchTerm && (
                        <span className="text-[9px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded border border-brand-primary/20 font-bold whitespace-nowrap">
                            {filteredData.length} matches
                        </span>
                    )}
                </div>

                {/* Rows per page toggle */}
                <div className="flex items-center gap-2 text-xs text-brand-muted self-end sm:self-auto font-medium">
                    <span>Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="bg-brand-sidebar border border-brand-border/80 rounded-lg px-2 py-1 focus:border-brand-primary outline-none text-white text-xs cursor-pointer font-medium"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            {/* 100-Row Sticky Table Grid */}
            <div className="flex-1 overflow-auto border border-brand-border/55 rounded-lg custom-scrollbar relative bg-[#0a0c10]/40">
                {paginatedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <FiFilter className="text-brand-muted text-2xl mb-2.5" />
                        <h4 className="text-xs font-bold text-white mb-1">No matching results</h4>
                        <p className="text-[11px] text-brand-muted max-w-xs">No records matched your search query. Try clearing the filter or adjusting terms.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs select-text">
                        <thead>
                            <tr className="bg-brand-sidebar/80 border-b border-brand-border sticky top-0 z-20 shadow-sm">
                                <th className="py-2.5 px-3 text-brand-muted font-bold text-[9px] uppercase tracking-wider text-center w-12 select-none">#</th>
                                {columns.map((col) => (
                                    <th
                                        key={col}
                                        className="py-2.5 px-3 text-brand-muted font-bold text-[9px] uppercase tracking-wider truncate max-w-[200px] border-r border-brand-border/30 last:border-r-0 select-none"
                                        title={col}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/50">
                            {paginatedData.map((row, idx) => {
                                const globalRowIndex = (currentPage - 1) * pageSize + idx + 1;
                                return (
                                    <tr key={idx} className="hover:bg-brand-card/25 transition-colors odd:bg-brand-card/5">
                                        <td className="py-2 px-3 text-brand-muted font-mono font-medium text-[10px] text-center bg-brand-sidebar/20 select-none">{globalRowIndex}</td>
                                        {columns.map((col) => {
                                            const val = row[col];
                                            const valStr = val === null || val === undefined ? 'NULL' : String(val);
                                            const isNull = val === null || val === undefined;
                                            return (
                                                <td
                                                    key={col}
                                                    className={`py-2 px-3 border-r border-brand-border/20 last:border-r-0 truncate max-w-[220px] font-mono text-[11px] ${isNull ? 'text-gray-600 italic' : 'text-brand-text/90'
                                                        }`}
                                                    title={valStr}
                                                >
                                                    {valStr}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Footer Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-4 border-t border-brand-border/60 pt-3.5 text-xs text-brand-muted">
                <div className="text-left font-medium">
                    Showing <span className="text-white font-semibold">{Math.min(filteredData.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredData.length, currentPage * pageSize)}</span> of{' '}
                    <span className="text-white font-semibold">{filteredData.length}</span> preview records
                    {totalRows > 100 && (
                        <span className="text-[10px] text-brand-muted block mt-0.5">
                            (Preview limited to initial 100 rows of {totalRows.toLocaleString()} total rows)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 border border-brand-border rounded-lg bg-brand-card/10 text-brand-text hover:bg-brand-hover hover:border-brand-border disabled:opacity-35 disabled:hover:bg-brand-card/10 disabled:hover:border-brand-border transition-all active:scale-95 cursor-pointer"
                        title="First page"
                    >
                        <FiChevronsLeft size={13} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 border border-brand-border rounded-lg bg-brand-card/10 text-brand-text hover:bg-brand-hover hover:border-brand-border disabled:opacity-35 disabled:hover:bg-brand-card/10 disabled:hover:border-brand-border transition-all active:scale-95 cursor-pointer"
                        title="Previous page"
                    >
                        <FiChevronLeft size={13} />
                    </button>

                    <span className="px-3 py-1 text-xs font-semibold text-white bg-brand-card/30 border border-brand-border rounded-lg select-none">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 border border-brand-border rounded-lg bg-brand-card/10 text-brand-text hover:bg-brand-hover hover:border-brand-border disabled:opacity-35 disabled:hover:bg-brand-card/10 disabled:hover:border-brand-border transition-all active:scale-95 cursor-pointer"
                        title="Next page"
                    >
                        <FiChevronRight size={13} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 border border-brand-border rounded-lg bg-brand-card/10 text-brand-text hover:bg-brand-hover hover:border-brand-border disabled:opacity-35 disabled:hover:bg-brand-card/10 disabled:hover:border-brand-border transition-all active:scale-95 cursor-pointer"
                        title="Last page"
                    >
                        <FiChevronsRight size={13} />
                    </button>
                </div>
            </div>

        </div>
    );
}
