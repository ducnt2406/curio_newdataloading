import React, { useRef, useState, useEffect } from 'react';
import styles from './FileUpload.module.css';
import clsx from 'clsx';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileArrowUp, faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { refreshDatasets } from '../datasets/DatasetsWindow';

const FileUpload = ({  }) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log(`Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    setUploadStatus('uploading');

    try {
      console.log(`Sending upload request to: ${process.env.BACKEND_URL}/upload`);
      const res = await fetch(`${process.env.BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log(`Upload response status: ${res.status}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Upload failed with status ${res.status}: ${errorText}`);
        throw new Error(`Upload failed: ${errorText}`);
      }
      
      const responseText = await res.text();
      console.log(`Upload response: ${responseText}`);
      
      setUploadStatus('success');
      
      // Trigger refresh of datasets list
      console.log('Upload successful, refreshing datasets list...');
      try {
        // First try the custom event
        refreshDatasets();
        
        // Then try a direct fetch as a backup
        console.log('Also trying direct fetch of datasets...');
        const datasetsRes = await fetch(`${process.env.BACKEND_URL}/datasets`, {
          method: 'GET',
        });
        
        if (datasetsRes.ok) {
          const datasets = await datasetsRes.json();
          console.log('Datasets fetched directly after upload:', datasets);
        } else {
          console.error('Failed to fetch datasets directly:', datasetsRes.statusText);
        }
      } catch (refreshError) {
        console.error('Error refreshing datasets:', refreshError);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus('error');
    }
  };

  // Reset status after a few seconds
  useEffect(() => {
    if (uploadStatus === 'success' || uploadStatus === 'error') {
      const timeout = setTimeout(() => setUploadStatus('idle'), 2000);
      return () => clearTimeout(timeout);
    }
  }, [uploadStatus]);

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={uploadStatus === 'uploading'}
      />

      <button
        className={styles.icon}
        type="button"
        onClick={handleFileClick}
        disabled={uploadStatus === 'uploading'}
      >
        {uploadStatus === 'uploading' ? (
          <>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            {' '}
          </>
        ) : uploadStatus === 'success' ? (
          <FontAwesomeIcon icon={faCheck} />
        ) : uploadStatus === 'error' ? (
          <FontAwesomeIcon icon={faXmark} />
        ) : (
          <FontAwesomeIcon icon={faFileArrowUp} />
        )}
      </button>
    </>
  );
};

export default FileUpload;
