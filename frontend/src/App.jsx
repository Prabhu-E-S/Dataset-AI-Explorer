import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DatasetUpload from './components/DatasetUpload';
import DatasetDashboard from './pages/DatasetDashboard';
import { getDatasets } from './services/api';

export default function App() {
  const [datasets, setDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  // Fetch all datasets to display in the sidebar list
  useEffect(() => {
    const fetchDatasetsList = async () => {
      try {
        const list = await getDatasets();
        setDatasets(list);
      } catch (err) {
        console.error('Failed to retrieve datasets for sidebar list:', err);
      }
    };
    fetchDatasetsList();
  }, [sidebarRefresh]);

  const handleUploadComplete = (newDataset) => {
    // Trigger refreshing dataset listing
    setSidebarRefresh(prev => prev + 1);
  };

  const handleDatasetDeleted = (deletedId) => {
    // Remove dataset from memory state and trigger list validation
    setDatasets(prev => prev.filter(d => d.id !== deletedId));
    setSidebarRefresh(prev => prev + 1);
  };

  return (
    <BrowserRouter>
      <AppLayout
        datasets={datasets}
        onDeleteDataset={handleDatasetDeleted}
        onSearchChange={setSearchTerm}
        searchTerm={searchTerm}
      >
        <Routes>
          <Route
            path="/"
            element={
              <DatasetUpload
                onUploadComplete={handleUploadComplete}
                recentDatasets={datasets}
              />
            }
          />
          <Route
            path="/dataset/:id"
            element={
              <DatasetDashboard
                onDatasetDeleted={handleDatasetDeleted}
              />
            }
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
