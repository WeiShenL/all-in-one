'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';

interface TaskFileUploadProps {
  taskId: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedById: string;
  uploadedAt: string;
}

/**
 * Task File Upload Component
 * Integrated with authentication - uses logged-in user context
 */
export function TaskFileUpload({ taskId }: TaskFileUploadProps) {
  const { userProfile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  // Fetch uploaded files on mount
  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, userProfile]);

  const fetchFiles = async () => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/task.getTaskFiles?input=${encodeURIComponent(
          JSON.stringify({
            taskId,
            userId: userProfile.id,
            userRole: userProfile.role,
            departmentId: userProfile.departmentId,
          })
        )}`
      );
      const data = await response.json();

      if (data.result?.data?.files) {
        setUploadedFiles(data.result.data.files);
        setTotalSize(data.result.data.totalSize || 0);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/task.getFileDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({
            fileId,
            userId: userProfile.id,
            userRole: userProfile.role,
            departmentId: userProfile.departmentId,
          })
        )}`
      );
      const data = await response.json();

      if (data.result?.data?.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.result.data.downloadUrl;
        link.download = fileName;
        link.click();
      }
    } catch {
      setError('Failed to download file');
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!userProfile) {
      return;
    }
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/trpc/task.deleteFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          userId: userProfile.id,
          userRole: userProfile.role,
          departmentId: userProfile.departmentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setSuccess(`✅ File "${fileName}" deleted successfully!`);
      fetchFiles(); // Refresh list

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        `Failed to delete file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(null);

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(
        `File size exceeds 10MB limit. Current: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      );
      setSelectedFile(null);
      return;
    }

    // Validate file type
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
    ];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        `File type "${file.type}" not allowed. Allowed: PDF, images, Word, Excel, text, ZIP`
      );
      setSelectedFile(null);
      return;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userProfile) {
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      setUploadProgress(20);

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async event => {
        try {
          const base64Data = event.target?.result as string;
          const base64Content = base64Data.split(',')[1];

          setUploadProgress(40);

          // Make API call with user context
          const response = await fetch('/api/trpc/task.uploadFile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              fileName: selectedFile.name,
              fileType: selectedFile.type,
              fileData: base64Content,
              userId: userProfile.id,
              userRole: userProfile.role,
              departmentId: userProfile.departmentId,
            }),
          });

          setUploadProgress(80);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Upload failed');
          }

          setUploadProgress(100);
          setSuccess(`✅ File "${selectedFile.name}" uploaded successfully!`);
          setSelectedFile(null);
          setUploading(false);

          // Refresh file list
          fetchFiles();

          // Clear success message after 3 seconds
          setTimeout(() => {
            setSuccess(null);
            setUploadProgress(0);
          }, 3000);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
          setUploading(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
        setUploadProgress(0);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!userProfile) {
    return <p>Please login to upload files</p>;
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* File Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor='file-input'
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: selectedFile ? '#28a745' : '#007bff',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {selectedFile ? `✓ ${selectedFile.name}` : '📁 Choose File'}
        </label>
        <input
          id='file-input'
          type='file'
          onChange={handleFileSelect}
          disabled={uploading}
          accept='.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt,.zip'
          style={{ display: 'none' }}
        />
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              marginLeft: '10px',
              padding: '10px 20px',
              backgroundColor: uploading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? '⏳ Uploading...' : '⬆️ Upload'}
          </button>
        )}
      </div>

      {/* File Info */}
      {selectedFile && !uploading && (
        <div style={{ marginBottom: '1rem', fontSize: '14px', color: '#666' }}>
          Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB | Type:{' '}
          {selectedFile.type}
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div
          style={{
            width: '100%',
            height: '30px',
            backgroundColor: '#eee',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${uploadProgress}%`,
              backgroundColor: '#28a745',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              transition: 'width 0.3s ease',
            }}
          >
            {uploadProgress}%
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          {success}
        </div>
      )}

      {/* Hints */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '1rem' }}>
        💡 Max 10MB per file • 50MB total per task • Allowed: PDF, images, Word,
        Excel, text, ZIP
      </div>

      {/* Storage Usage */}
      {!loadingFiles && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.75rem',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '500' }}>
              Storage Usage:
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: totalSize > 50 * 1024 * 1024 ? '#dc3545' : '#28a745',
              }}
            >
              {(totalSize / (1024 * 1024)).toFixed(2)} MB / 50 MB
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min((totalSize / (50 * 1024 * 1024)) * 100, 100)}%`,
                height: '100%',
                backgroundColor:
                  totalSize > 50 * 1024 * 1024
                    ? '#dc3545'
                    : totalSize > 40 * 1024 * 1024
                      ? '#ffc107'
                      : '#28a745',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Uploaded Files List */}
      <div style={{ marginTop: '2rem' }}>
        <h3
          style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}
        >
          📂 Uploaded Files
        </h3>

        {loadingFiles ? (
          <p style={{ color: '#666', fontSize: '14px' }}>Loading files...</p>
        ) : uploadedFiles.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>
            No files uploaded yet.
          </p>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {file.fileName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {(file.fileSize / (1024 * 1024)).toFixed(2)} MB •{' '}
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleDownload(file.id, file.fileName)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ⬇️ Download
                  </button>
                  <button
                    onClick={() => handleDelete(file.id, file.fileName)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
