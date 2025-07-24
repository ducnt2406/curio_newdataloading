import React, { useEffect, useState } from "react";
import styles from "./DatasetsWindow.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";

// Create a custom event for dataset refresh
export const refreshDatasetsEvent = new Event('refreshDatasets');

// Function to trigger dataset refresh
export function refreshDatasets() {
    console.log('refreshDatasets function called');
    window.dispatchEvent(refreshDatasetsEvent);
}

export default function DatasetsWindow({
    open,
    closeModal
} : {
    open: boolean;
    closeModal: any;
}) {
   
    const [datasetNames, setDatasetNames] = useState<string[]>([]);

    // Function to fetch datasets
    const fetchDatasets = () => {
        console.log('Fetching datasets from:', process.env.BACKEND_URL + "/datasets");
        
        // First, let's try to get the environment variables
        fetch(process.env.BACKEND_URL + "/debug-env", {
            method: "GET",
        })
        .then(response => response.json())
        .then(envData => {
            console.log('Environment variables:', envData);
        })
        .catch(error => {
            console.error('Error fetching environment variables:', error);
        });
        
        // Now fetch the datasets
        fetch(process.env.BACKEND_URL + "/datasets", {
            method: "GET",
        })
        .then(response => {
            console.log('Datasets response status:', response.status);
            if (!response.ok) {
                throw new Error('Error in retrieving datasets: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('List of files:', data);
            setDatasetNames(data);
        })
        .catch(error => {
            console.error('Error fetching files:', error);
        });
    };

    // Fetch datasets when the window opens
    useEffect(() => {
        if (open) {
            fetchDatasets();
        }
    }, [open]);
    
    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => {
            if (open) {
                console.log('Refreshing datasets from event...');
                fetchDatasets();
            }
        };
        
        window.addEventListener('refreshDatasets', handleRefresh);
        
        return () => {
            window.removeEventListener('refreshDatasets', handleRefresh);
        };
    }, [open]);

    // Add a manual refresh function
    const handleManualRefresh = () => {
        console.log('Manual refresh triggered');
        fetchDatasets();
    };
    
    return (
        <>
            {open ? 
                <div>
                    <div className={styles.modalBackground}></div>
                    <div className={styles.modal}>
                        <span className={styles.closeX} onClick={closeModal}>X</span>
                        <div className={styles.datasetContainer}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2>Available Datasets</h2>
                                <button 
                                    onClick={handleManualRefresh} 
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        color: '#007bff'
                                    }}
                                    title="Refresh datasets"
                                >
                                    <FontAwesomeIcon icon={faSync} />
                                </button>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.datasetTable}>
                                    <thead>
                                    <tr>
                                        <th>Name</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                        {datasetNames.length > 0 ? (
                                            datasetNames.map((dataset, index) => (
                                                <tr key={index}>
                                                    <td>{dataset}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td style={{ textAlign: 'center', padding: '20px' }}>No datasets found. Try uploading a file.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div> : null
            }
        </>

    );
}
