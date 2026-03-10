import { useState, useRef, useCallback } from "react";
import { useRevalidator } from "@remix-run/react";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revalidator = useRevalidator();

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadCount(files.length);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Upload failed");
      } else {
        revalidator.revalidate();
      }
    } catch (error) {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadCount(0);
    }
  }, [revalidator]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div
      className={`upload-zone ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,video/mp4,video/webm"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {uploading ? (
        <>
          <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto 12px" }} />
          <p>Uploading {uploadCount} file{uploadCount > 1 ? "s" : ""}...</p>
        </>
      ) : (
        <>
          <div className="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p><strong>Drop files here</strong> or click to browse</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            PNG, JPG, WEBP, SVG, MP4, WEBM (max 50MB)
          </p>
        </>
      )}
    </div>
  );
}
