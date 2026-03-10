import { useState } from "react";
import { useFetcher, useRevalidator } from "@remix-run/react";

interface TagEditorProps {
  assetId: string;
  tags: string[];
  onClose: () => void;
}

export function TagEditor({ assetId, tags, onClose }: TagEditorProps) {
  const [currentTags, setCurrentTags] = useState<string[]>(tags);
  const [newTag, setNewTag] = useState("");
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !currentTags.includes(tag)) {
      const updated = [...currentTags, tag];
      setCurrentTags(updated);
      setNewTag("");
      saveTags(updated);
    }
  };

  const removeTag = (tag: string) => {
    const updated = currentTags.filter((t) => t !== tag);
    setCurrentTags(updated);
    saveTags(updated);
  };

  const saveTags = (tags: string[]) => {
    fetcher.submit(
      { intent: "updateTags", id: assetId, tags: JSON.stringify(tags) },
      { method: "post", action: "/api/assets" }
    );
    setTimeout(() => revalidator.revalidate(), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div style={{ marginTop: 8, padding: 8, background: "var(--bg-tertiary)", borderRadius: "var(--radius)" }}>
      <div className="tags-container" style={{ marginBottom: 8 }}>
        {currentTags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
            <button className="tag-remove" onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          style={{ fontSize: 12, padding: "4px 8px" }}
        />
        <button className="btn btn-primary btn-sm" onClick={addTag}>Add</button>
      </div>
    </div>
  );
}
