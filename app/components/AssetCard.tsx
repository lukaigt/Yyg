import { useState } from "react";
import { useFetcher, useRevalidator } from "@remix-run/react";
import { TagEditor } from "./TagEditor";

interface AssetCardProps {
  asset: {
    id: string;
    filename: string;
    original_name: string;
    file_type: string;
    tags: string[];
    file_size: number;
    has_transparency: boolean;
    created_at: string;
  };
}

export function AssetCard({ asset }: AssetCardProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [showTags, setShowTags] = useState(false);

  const assetUrl = `/storage/assets/${asset.filename}`;
  const isDeleting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "delete";
  const isRemovingBg = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "removeBackground";

  const handleDelete = () => {
    if (confirm("Delete this asset?")) {
      fetcher.submit(
        { intent: "delete", id: asset.id },
        { method: "post", action: "/api/assets" }
      );
      setTimeout(() => revalidator.revalidate(), 500);
    }
  };

  const handleRemoveBg = () => {
    fetcher.submit(
      { intent: "removeBackground", id: asset.id },
      { method: "post", action: "/api/assets" }
    );
    setTimeout(() => revalidator.revalidate(), 1000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="asset-card" style={{ opacity: isDeleting ? 0.5 : 1 }}>
      {asset.file_type === "video" ? (
        <video src={assetUrl} className="asset-card-image" muted preload="metadata" />
      ) : (
        <img
          src={assetUrl}
          alt={asset.original_name}
          className="asset-card-image"
          style={{
            background: asset.has_transparency
              ? "repeating-conic-gradient(#2a2a3e 0% 25%, #1a1a24 0% 50%) 50% / 16px 16px"
              : "var(--bg-tertiary)",
          }}
          loading="lazy"
        />
      )}

      <div className="asset-card-body">
        <div className="asset-card-name" title={asset.original_name}>
          {asset.original_name}
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: 6 }}>
          {formatSize(asset.file_size)}
          {asset.has_transparency ? " · Transparent" : ""}
        </p>

        <div className="tags-container" style={{ marginBottom: 8 }}>
          {asset.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {asset.tags.length > 4 && (
            <span className="tag" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              +{asset.tags.length - 4}
            </span>
          )}
        </div>

        {showTags && (
          <TagEditor
            assetId={asset.id}
            tags={asset.tags}
            onClose={() => setShowTags(false)}
          />
        )}

        <div className="asset-card-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowTags(!showTags)}
            title="Edit tags"
          >
            Tags
          </button>
          {asset.file_type === "image" && !asset.has_transparency && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRemoveBg}
              disabled={isRemovingBg}
              title="Remove background"
            >
              {isRemovingBg ? "..." : "Remove BG"}
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete"
          >
            {isDeleting ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
