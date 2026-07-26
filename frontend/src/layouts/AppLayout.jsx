import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    FiUploadCloud,
    FiDatabase,
    FiSearch,
    FiTrash2,
    FiMenu,
    FiX,
    FiInfo,
    FiChevronsLeft,
    FiChevronsRight
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLayout({ children, datasets = [], onDeleteDataset, onSearchChange, searchTerm }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleDatasetSelect = (id) => {
        setMobileMenuOpen(false);
        navigate(`/dataset/${id}`);
    };

    const isUploadPage = location.pathname === '/';

    return (
        <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col font-sans select-none antialiased">
            {/* 1. Header (Top Navigation) */}
            <header className="sticky top-0 bg-brand-sidebar border-b border-brand-border h-16 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-3">
                    {/* Mobile menu trigger */}
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="md:hidden p-2 text-brand-muted hover:text-white rounded-lg hover:bg-brand-card transition-colors"
                    >
                        <FiMenu className="text-xl" />
                    </button>

                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-accent p-0.5 shadow-md flex items-center justify-center">
                            <span className="font-extrabold text-white text-base">AE</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-md tracking-tight leading-none">AI Dataset Explorer</h1>
                            <span className="text-[10px] text-brand-muted font-medium uppercase tracking-wider">Workspace Phase 1</span>
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-block text-xs font-semibold text-brand-accent bg-emerald-500/10 px-2.5 py-1 rounded-full border border-brand-accent/20">
                            Connection Online
                        </span>
                    </div>

                    {/* Profile Avatar */}
                    <div className="flex items-center gap-2 border-l border-brand-border pl-4">
                        <div className="h-9 w-9 rounded-xl bg-brand-card border border-brand-border flex items-center justify-center text-sm font-semibold text-brand-primary shadow-inner">
                            PE
                        </div>
                        <div className="hidden md:block text-left">
                            <div className="text-xs font-semibold text-white">Prabhu E S</div>
                            <div className="text-[10px] text-brand-muted">Data Scientist</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. Main Scaffold */}
            <div className="flex flex-1 relative overflow-hidden">

                {/* Mobile Navigation Drawer Backdrop */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black z-40 md:hidden"
                        />
                    )}
                </AnimatePresence>

                {/* Mobile Navigation Drawer */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 bottom-0 left-0 w-72 bg-brand-sidebar border-r border-brand-border z-50 flex flex-col p-4 md:hidden"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold uppercase text-brand-muted tracking-wider">Datasets Area</span>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-1 text-brand-muted hover:text-white rounded-lg hover:bg-brand-card transition-colors"
                                >
                                    <FiX className="text-xl" />
                                </button>
                            </div>

                            {/* Sidebar Content inside Mobile Drawer */}
                            <SidebarContent
                                datasets={datasets}
                                onSelect={handleDatasetSelect}
                                onDelete={onDeleteDataset}
                                onSearch={onSearchChange}
                                searchTerm={searchTerm}
                                isUploadPage={isUploadPage}
                                navigate={navigate}
                            />
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* Desktop Sidebar */}
                <aside
                    className={`hidden md:flex flex-col bg-brand-sidebar border-r border-brand-border transition-all duration-300 relative ${sidebarCollapsed ? 'w-20' : 'w-72'
                        }`}
                >
                    {/* Collapse toggle button */}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="absolute top-1/2 -translate-y-1/2 -right-3 bg-brand-card hover:bg-brand-hover text-brand-text border border-brand-border rounded-full p-1.5 shadow-md z-30 transition-transform active:scale-95"
                    >
                        {sidebarCollapsed ? <FiChevronsRight size={13} /> : <FiChevronsLeft size={13} />}
                    </button>

                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        {sidebarCollapsed ? (
                            <div className="flex flex-col items-center gap-6 py-4">
                                <button
                                    onClick={() => navigate('/')}
                                    className={`p-3 rounded-xl border border-dashed transition-all active:scale-95 ${isUploadPage
                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                            : 'border-brand-border hover:border-brand-primary text-brand-muted hover:text-white'
                                        }`}
                                    title="Upload New Dataset"
                                >
                                    <FiUploadCloud size={20} />
                                </button>
                                <div className="h-px w-8 bg-brand-border" />
                                <div className="flex-1 flex flex-col gap-3 overflow-y-auto px-1 w-full items-center">
                                    {datasets.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => navigate(`/dataset/${d.id}`)}
                                            className={`p-2.5 rounded-lg border transition-all ${location.pathname.includes(d.id)
                                                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm shadow-brand-primary/10'
                                                    : 'border-brand-border bg-brand-card/50 text-brand-muted hover:text-white hover:border-brand-hover'
                                                }`}
                                            title={d.original_filename}
                                        >
                                            <FiDatabase size={16} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <SidebarContent
                                datasets={datasets}
                                onSelect={handleDatasetSelect}
                                onDelete={onDeleteDataset}
                                onSearch={onSearchChange}
                                searchTerm={searchTerm}
                                isUploadPage={isUploadPage}
                                navigate={navigate}
                            />
                        )}
                    </div>
                </aside>

                {/* 3. Main Display Workspace */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {children}
                </main>

            </div>
        </div>
    );
}

/* Internal helper component to render Sidebar items smoothly */
function SidebarContent({ datasets, onSelect, onDelete, onSearch, searchTerm, isUploadPage, navigate }) {
    const location = useLocation();

    return (
        <div className="flex flex-col h-full overflow-hidden select-none">
            {/* Upload button wrapper */}
            <button
                onClick={() => {
                    navigate('/');
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border transition-all duration-200 active:scale-[0.98] ${isUploadPage
                        ? 'bg-brand-primary hover:bg-blue-600 text-white border-brand-primary shadow-lg shadow-brand-primary/25'
                        : 'border-brand-border bg-brand-card hover:bg-brand-hover text-white hover:border-brand-primary'
                    }`}
            >
                <FiUploadCloud className="text-lg" />
                <span className="text-sm">Upload Dataset</span>
            </button>

            {/* Separator line */}
            <div className="h-px bg-brand-border my-5" />

            {/* Datasets Header and Search Bar */}
            <div className="mb-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block mb-2.5">
                    Workspaces ({datasets.length})
                </label>
                <div className="relative group">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary transition-colors text-sm" />
                    <input
                        type="text"
                        placeholder="Search datasets..."
                        value={searchTerm || ''}
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary rounded-xl pl-9 pr-4 py-2 text-xs text-brand-text placeholder-brand-muted outline-none transition-all"
                    />
                </div>
            </div>

            {/* Dataset Scrollable Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1.5 custom-scrollbar">
                {datasets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-brand-border rounded-xl">
                        <FiDatabase className="text-brand-muted text-2xl mb-2" />
                        <span className="text-xs text-brand-muted font-medium">No datasets loaded</span>
                        <span className="text-[10px] text-brand-muted/70 mt-1">Upload a CSV or Excel file to begin analysis</span>
                    </div>
                ) : (
                    datasets
                        .filter(d => d.original_filename.toLowerCase().includes((searchTerm || '').toLowerCase()))
                        .map(d => {
                            const isActive = location.pathname.includes(d.id);
                            return (
                                <div
                                    key={d.id}
                                    className={`group relative w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 ${isActive
                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm shadow-brand-primary/5'
                                            : 'border-brand-border bg-brand-card/30 hover:bg-brand-card/85 text-brand-text hover:border-brand-hover'
                                        }`}
                                    onClick={() => onSelect(d.id)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden pr-6">
                                        <FiDatabase className={`text-base flex-shrink-0 ${isActive ? 'text-brand-primary' : 'text-brand-muted group-hover:text-white'}`} />
                                        <div className="text-left overflow-hidden">
                                            <div className="text-xs font-semibold truncate text-white">{d.original_filename}</div>
                                            <div className="text-[10px] text-brand-muted/80 mt-0.5">
                                                {d.rows.toLocaleString()} rows • {d.file_type}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(d.id);
                                        }}
                                        className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 text-brand-muted hover:text-red-400 hover:bg-brand-hover rounded-lg transition-all duration-150 active:scale-95"
                                        title="Delete workspace"
                                    >
                                        <FiTrash2 className="text-xs" />
                                    </button>
                                </div>
                            );
                        })
                )}
            </div>
        </div>
    );
}
