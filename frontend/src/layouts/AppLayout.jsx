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
            <header className="sticky top-0 bg-brand-sidebar/85 backdrop-blur-md border-b border-brand-border h-14 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-3">
                    {/* Mobile menu trigger */}
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="md:hidden p-1.5 text-brand-muted hover:text-white rounded-lg hover:bg-brand-hover/50 transition-colors"
                    >
                        <FiMenu className="text-lg" />
                    </button>

                    <Link to="/" className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shadow-sm">
                            <span className="font-bold text-brand-primary text-sm">AE</span>
                        </div>
                        <div className="leading-tight text-left">
                            <h1 className="font-semibold text-white text-sm tracking-tight">AI Dataset Explorer</h1>
                            <span className="text-[9px] text-brand-muted font-semibold tracking-wider font-mono">WORKSPACE</span>
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/15">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                            Connection Online
                        </span>
                    </div>

                    {/* Profile Avatar */}
                    <div className="flex items-center gap-2 border-l border-brand-border pl-4">
                        <div className="h-8 w-8 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center text-xs font-semibold text-brand-primary">
                            PE
                        </div>
                        <div className="hidden md:block text-left">
                            <div className="text-xs font-medium text-white leading-none">Prabhu E S</div>
                            <div className="text-[9px] text-brand-muted font-mono mt-0.5">Data Scientist</div>
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
                            animate={{ opacity: 0.4 }}
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
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed top-0 bottom-0 left-0 w-64 bg-brand-sidebar border-r border-brand-border z-50 flex flex-col p-4 md:hidden"
                        >
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-border/40">
                                <span className="text-[10px] font-bold uppercase text-brand-muted tracking-wider">Datasets</span>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-1 text-brand-muted hover:text-white rounded hover:bg-brand-hover/50 transition-colors"
                                >
                                    <FiX className="text-lg" />
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
                    className={`hidden md:flex flex-col bg-brand-sidebar border-r border-brand-border transition-all duration-300 relative ${sidebarCollapsed ? 'w-16' : 'w-64'
                        }`}
                >
                    {/* Collapse toggle button */}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="absolute top-1/2 -translate-y-1/2 -right-2.5 bg-brand-card hover:bg-brand-hover text-brand-text border border-brand-border rounded-full p-1 shadow-sm z-30 transition-transform hover:scale-105 active:scale-95"
                    >
                        {sidebarCollapsed ? <FiChevronsRight size={11} /> : <FiChevronsLeft size={11} />}
                    </button>

                    <div className="flex-1 flex flex-col p-3.5 overflow-hidden">
                        {sidebarCollapsed ? (
                            <div className="flex flex-col items-center gap-5 py-2">
                                <button
                                    onClick={() => navigate('/')}
                                    className={`p-2.5 rounded-lg border border-dashed transition-all active:scale-95 ${isUploadPage
                                        ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary'
                                        : 'border-brand-border hover:border-brand-primary/40 text-brand-muted hover:text-white'
                                        }`}
                                    title="Upload New Dataset"
                                >
                                    <FiUploadCloud size={18} />
                                </button>
                                <div className="h-px w-6 bg-brand-border/60" />
                                <div className="flex-grow flex flex-col gap-2 overflow-y-auto px-0.5 w-full items-center custom-scrollbar">
                                    {datasets.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => navigate(`/dataset/${d.id}`)}
                                            className={`p-2 rounded-lg border transition-all ${location.pathname.includes(d.id)
                                                ? 'bg-brand-primary/10 border-brand-primary/45 text-brand-primary'
                                                : 'border-brand-border/60 bg-brand-card/40 text-brand-muted hover:text-white hover:border-brand-border'
                                                }`}
                                            title={d.original_filename}
                                        >
                                            <FiDatabase size={14} />
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
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold border transition-all duration-200 active:scale-[0.98] ${isUploadPage
                    ? 'bg-brand-primary hover:bg-blue-600 text-white border-brand-primary shadow-sm shadow-brand-primary/10'
                    : 'border-brand-border bg-brand-card hover:bg-brand-hover text-white hover:border-brand-primary/30'
                    }`}
            >
                <FiUploadCloud className="text-base" />
                <span className="text-xs">Upload Dataset</span>
            </button>

            {/* Separator line */}
            <div className="h-px bg-brand-border/60 my-4" />

            {/* Datasets Header and Search Bar */}
            <div className="mb-3 text-left">
                <label className="text-[9px] font-bold uppercase tracking-wider text-brand-muted block mb-2">
                    Workspaces ({datasets.length})
                </label>
                <div className="relative group">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-brand-primary transition-colors text-xs" />
                    <input
                        type="text"
                        placeholder="Search workspace..."
                        value={searchTerm || ''}
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-text placeholder-brand-muted outline-none transition-all"
                    />
                </div>
            </div>

            {/* Dataset Scrollable Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 custom-scrollbar">
                {datasets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-3 text-center border border-dashed border-brand-border rounded-lg bg-brand-bg/20">
                        <FiDatabase className="text-brand-muted text-xl mb-1.5" />
                        <span className="text-xs text-brand-muted font-medium">No workspaces</span>
                        <span className="text-[9px] text-brand-muted/70 mt-0.5">Upload a raw dataset to start</span>
                    </div>
                ) : (
                    datasets
                        .filter(d => d.original_filename.toLowerCase().includes((searchTerm || '').toLowerCase()))
                        .map(d => {
                            const isActive = location.pathname.includes(d.id);
                            return (
                                <div
                                    key={d.id}
                                    className={`group relative w-full flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-150 ${isActive
                                        ? 'bg-brand-primary/5 border-brand-primary/50 text-brand-primary'
                                        : 'border-brand-border/60 bg-brand-card/20 hover:bg-brand-card/50 text-brand-text hover:border-brand-border'
                                        }`}
                                    onClick={() => onSelect(d.id)}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden pr-5 text-left">
                                        <FiDatabase className={`text-sm flex-shrink-0 ${isActive ? 'text-brand-primary' : 'text-brand-muted group-hover:text-white/80'}`} />
                                        <div className="overflow-hidden">
                                            <div className="text-xs font-medium truncate text-white">{d.original_filename}</div>
                                            <div className="text-[9px] text-brand-muted mt-0.5 font-mono">
                                                {d.rows.toLocaleString()} rows • {d.file_type.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(d.id);
                                        }}
                                        className="absolute right-2.5 opacity-0 group-hover:opacity-100 p-1 text-brand-muted hover:text-red-400 hover:bg-brand-hover rounded transition-all duration-100"
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
