import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "db");
const DB_PATH = path.join(DB_DIR, "database.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('image', 'video')),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    has_transparency INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scene_plan TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','planned','rendering','completed','failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS renders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT,
    duration_seconds REAL,
    resolution TEXT DEFAULT '1920x1080',
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','rendering','completed','failed')),
    progress INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try {
  db.exec(`ALTER TABLE projects ADD COLUMN music_path TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN music_volume REAL DEFAULT 0.15`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN voice_rate REAL DEFAULT 1.05`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN voice_pitch TEXT DEFAULT 'normal'`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN show_captions INTEGER DEFAULT 1`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN caption_size TEXT DEFAULT 'medium'`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN show_progress_bar INTEGER DEFAULT 1`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN is_planning INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN planning_error TEXT`);
} catch {}

export interface Asset {
  id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_type: "image" | "video";
  mime_type: string;
  file_size: number;
  tags: string[];
  has_transparency: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  prompt: string;
  scene_plan: any | null;
  status: string;
  music_path: string | null;
  music_volume: number;
  voice_rate: number;
  voice_pitch: string;
  show_captions: boolean;
  caption_size: string;
  show_progress_bar: boolean;
  is_planning: boolean;
  planning_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Render {
  id: string;
  project_id: string;
  file_path: string | null;
  duration_seconds: number | null;
  resolution: string;
  status: string;
  progress: number;
  error_message: string | null;
  created_at: string;
}

function rowToAsset(row: any): Asset {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
    has_transparency: Boolean(row.has_transparency),
  };
}

function rowToProject(row: any): Project {
  return {
    ...row,
    scene_plan: row.scene_plan ? (() => { try { return JSON.parse(row.scene_plan); } catch { return null; } })() : null,
    music_volume: row.music_volume ?? 0.15,
    voice_rate: row.voice_rate ?? 1.05,
    voice_pitch: row.voice_pitch ?? "normal",
    show_captions: row.show_captions == null ? true : Boolean(row.show_captions),
    caption_size: row.caption_size ?? "medium",
    show_progress_bar: row.show_progress_bar == null ? true : Boolean(row.show_progress_bar),
    is_planning: Boolean(row.is_planning),
    planning_error: row.planning_error ?? null,
  };
}

export const assets = {
  getAll(search?: string): Asset[] {
    let rows;
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      rows = db
        .prepare(
          `SELECT * FROM assets WHERE LOWER(tags) LIKE ? OR LOWER(original_name) LIKE ? ORDER BY created_at DESC`
        )
        .all(term, term);
    } else {
      rows = db.prepare("SELECT * FROM assets ORDER BY created_at DESC").all();
    }
    return rows.map(rowToAsset);
  },

  getById(id: string): Asset | null {
    const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
    return row ? rowToAsset(row) : null;
  },

  create(asset: Omit<Asset, "created_at" | "updated_at">): Asset {
    db.prepare(
      `INSERT INTO assets (id, filename, original_name, file_path, file_type, mime_type, file_size, tags, has_transparency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      asset.id,
      asset.filename,
      asset.original_name,
      asset.file_path,
      asset.file_type,
      asset.mime_type,
      asset.file_size,
      JSON.stringify(asset.tags),
      asset.has_transparency ? 1 : 0
    );
    return this.getById(asset.id)!;
  },

  updateTags(id: string, tags: string[]): Asset | null {
    db.prepare(
      "UPDATE assets SET tags = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(tags), id);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare("DELETE FROM assets WHERE id = ?").run(id);
    return result.changes > 0;
  },

  getAllTags(): string[] {
    const rows = db.prepare("SELECT tags FROM assets").all() as any[];
    const tagSet = new Set<string>();
    for (const row of rows) {
      const parsed = JSON.parse(row.tags || "[]");
      for (const tag of parsed) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  },

  searchByTags(tags: string[]): Asset[] {
    const all = this.getAll();
    return all.filter((a) =>
      tags.some((t) => a.tags.includes(t.toLowerCase()))
    );
  },
};

export const projects = {
  getAll(): Project[] {
    return db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all()
      .map(rowToProject);
  },

  getById(id: string): Project | null {
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return row ? rowToProject(row) : null;
  },

  create(project: { id: string; name: string; prompt: string }): Project {
    db.prepare(
      "INSERT INTO projects (id, name, prompt) VALUES (?, ?, ?)"
    ).run(project.id, project.name, project.prompt);
    return this.getById(project.id)!;
  },

  updateScenePlan(id: string, scenePlan: any): void {
    db.prepare(
      "UPDATE projects SET scene_plan = ?, status = 'planned', updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(scenePlan), id);
  },

  updateStatus(id: string, status: string): void {
    db.prepare(
      "UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);
  },

  updateSettings(id: string, settings: {
    music_path?: string | null;
    music_volume?: number;
    voice_rate?: number;
    voice_pitch?: string;
    show_captions?: boolean;
    caption_size?: string;
    show_progress_bar?: boolean;
  }): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (settings.music_path !== undefined) { fields.push("music_path = ?"); values.push(settings.music_path); }
    if (settings.music_volume !== undefined) { fields.push("music_volume = ?"); values.push(settings.music_volume); }
    if (settings.voice_rate !== undefined) { fields.push("voice_rate = ?"); values.push(settings.voice_rate); }
    if (settings.voice_pitch !== undefined) { fields.push("voice_pitch = ?"); values.push(settings.voice_pitch); }
    if (settings.show_captions !== undefined) { fields.push("show_captions = ?"); values.push(settings.show_captions ? 1 : 0); }
    if (settings.caption_size !== undefined) { fields.push("caption_size = ?"); values.push(settings.caption_size); }
    if (settings.show_progress_bar !== undefined) { fields.push("show_progress_bar = ?"); values.push(settings.show_progress_bar ? 1 : 0); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
  },

  setPlanning(id: string, isPlanning: boolean): void {
    db.prepare(
      "UPDATE projects SET is_planning = ?, planning_error = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(isPlanning ? 1 : 0, id);
  },

  setPlanningError(id: string, error: string): void {
    db.prepare(
      "UPDATE projects SET is_planning = 0, planning_error = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(error, id);
  },

  delete(id: string): boolean {
    const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  },
};

export const renders = {
  getAll(): Render[] {
    return db
      .prepare("SELECT * FROM renders ORDER BY created_at DESC")
      .all() as Render[];
  },

  getById(id: string): Render | null {
    return (db.prepare("SELECT * FROM renders WHERE id = ?").get(id) as Render) || null;
  },

  getByProjectId(projectId: string): Render[] {
    return db
      .prepare("SELECT * FROM renders WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as Render[];
  },

  create(render: { id: string; project_id: string }): Render {
    db.prepare(
      "INSERT INTO renders (id, project_id) VALUES (?, ?)"
    ).run(render.id, render.project_id);
    return this.getById(render.id)!;
  },

  updateProgress(id: string, progress: number): void {
    db.prepare("UPDATE renders SET progress = ?, status = 'rendering' WHERE id = ?").run(
      progress,
      id
    );
  },

  complete(id: string, filePath: string, durationSeconds: number): void {
    db.prepare(
      "UPDATE renders SET file_path = ?, duration_seconds = ?, status = 'completed', progress = 100 WHERE id = ?"
    ).run(filePath, durationSeconds, id);
  },

  fail(id: string, error: string): void {
    db.prepare(
      "UPDATE renders SET status = 'failed', error_message = ? WHERE id = ?"
    ).run(error, id);
  },
};

export default db;
