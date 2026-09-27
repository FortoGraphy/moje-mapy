import { Directory, type DownloadTask, File, Paths } from "expo-file-system";

import { dataUrl } from "@/config";
import { type RegionFiles, removeRegion, upsertRegion } from "@/db/regions";
import { currentLang, t } from "@/i18n";
import { closeOfflineSearch } from "@/search/offline";
import { fmtBytes } from "@/utils/format";

import type { CatalogRegion, RegionFileKey } from "./catalog";
import { useOffline } from "./store";

const KEYS: RegionFileKey[] = ["map", "outdoor", "terrain", "search"];

interface Job {
  region: CatalogRegion;
  task: DownloadTask | null;
  paused: boolean;
  cancelled: boolean;
  bytes: number;
  /** resolves the wait of a paused job */
  wake: (() => void) | null;
}

const queue: string[] = [];
const jobs = new Map<string, Job>();
let running: string | null = null;

const regionDir = (id: string) => new Directory(Paths.document, "regions", id);
const ext = (path: string) => (/\.[a-z0-9]+$/i.exec(path)?.[0] ?? "");
/** Versioned file names let an update download next to the files currently in use. */
const relPath = (r: CatalogRegion, key: RegionFileKey, path: string) =>
  `regions/${r.id}/${key}-${r.version.replace(/[^a-zA-Z0-9.-]/g, "_")}${ext(path)}`;

function progress(job: Job, bytes: number, state: "queued" | "downloading" | "paused" | "error", error?: string) {
  job.bytes = bytes;
  useOffline.getState().setProgress({ regionId: job.region.id, bytes, total: job.region.size, state, error });
}

export function freeSpace(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function downloadRegion(region: CatalogRegion) {
  if (jobs.has(region.id)) return;
  const needed = region.size * 1.05 + 200 * 1024 * 1024;
  if (freeSpace() < needed) throw new Error(t("offline.noSpace", { size: fmtBytes(needed) }));
  const job: Job = { region, task: null, paused: false, cancelled: false, bytes: 0, wake: null };
  jobs.set(region.id, job);
  queue.push(region.id);
  progress(job, 0, "queued");
  pump();
}

async function pump() {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  const job = jobs.get(id);
  if (!job) return pump();
  running = id;
  try {
    await runJob(job);
  } finally {
    running = null;
    pump();
  }
}

async function runJob(job: Job) {
  const r = job.region;
  const dir = regionDir(r.id);
  if (!dir.exists) dir.create({ intermediates: true });
  const files: RegionFiles = {};
  let done = 0;
  try {
    for (const key of KEYS) {
      const spec = r.files[key];
      if (!spec) continue;
      const rel = relPath(r, key, spec.path);
      const dest = new File(Paths.document, rel);
      if (dest.exists && dest.size === spec.size) {
        files[key] = rel;
        done += spec.size;
        progress(job, done, "downloading");
        continue;
      }
      if (job.paused) {
        progress(job, done, "paused");
        await new Promise<void>((resolve) => (job.wake = resolve));
        job.wake = null;
        if (job.cancelled) throw new Error("cancelled");
      }
      const tmp = new File(Paths.document, `${rel}.part`);
      if (tmp.exists) tmp.delete();
      const url = dataUrl(spec.path);
      if (!url) throw new Error(t("offline.noCatalog"));
      const base = done;
      job.task = File.createDownloadTask(url, tmp, {
        sessionType: "background",
        onProgress: ({ bytesWritten }) => progress(job, base + bytesWritten, job.paused ? "paused" : "downloading"),
      });
      let result = await job.task.downloadAsync();
      while (result == null && !job.cancelled) {
        progress(job, job.bytes, "paused");
        if (job.paused) await new Promise<void>((resolve) => (job.wake = resolve));
        job.wake = null;
        if (job.cancelled) break;
        progress(job, job.bytes, "downloading");
        result = await job.task.resumeAsync();
      }
      if (job.cancelled) throw new Error("cancelled");
      if (dest.exists) dest.delete();
      tmp.move(dest);
      job.task.release();
      job.task = null;
      files[key] = rel;
      done += spec.size;
    }

    const prev = useOffline.getState().downloaded.find((d) => d.id === r.id);
    upsertRegion({
      id: r.id,
      name: r.name[currentLang()] ?? r.name.cs,
      kind: r.kind,
      version: r.version,
      size: r.size,
      bbox: r.bbox,
      files,
      downloaded_at: Date.now(),
    });
    if (prev) {
      // remove files of the replaced version
      if (prev.files.search) closeOfflineSearch(prev.files.search);
      for (const rel of Object.values(prev.files)) {
        if (rel && !Object.values(files).includes(rel)) {
          const f = new File(Paths.document, rel);
          if (f.exists) f.delete();
        }
      }
    }
    jobs.delete(r.id);
    useOffline.getState().clearProgress(r.id);
    useOffline.getState().refreshDownloaded();
  } catch (e) {
    job.task?.release();
    job.task = null;
    jobs.delete(r.id);
    if (job.cancelled) {
      useOffline.getState().clearProgress(r.id);
      for (const f of dir.list()) if (f instanceof File && f.name.endsWith(".part")) f.delete();
    } else {
      useOffline.getState().setProgress({
        regionId: r.id,
        bytes: done,
        total: r.size,
        state: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export function pauseDownload(id: string) {
  const job = jobs.get(id);
  if (!job || job.paused) return;
  job.paused = true;
  job.task?.pause();
}

export function resumeDownload(id: string) {
  const job = jobs.get(id);
  if (job) {
    job.paused = false;
    job.wake?.();
    return;
  }
  // failed or interrupted earlier: start again, completed files are skipped
  const region = useOffline.getState().catalog?.regions.find((r) => r.id === id);
  useOffline.getState().clearProgress(id);
  if (region) downloadRegion(region);
}

export function cancelDownload(id: string) {
  const job = jobs.get(id);
  if (!job) {
    useOffline.getState().clearProgress(id);
    return;
  }
  job.cancelled = true;
  job.paused = false;
  job.wake?.();
  const qi = queue.indexOf(id);
  if (qi >= 0) {
    queue.splice(qi, 1);
    jobs.delete(id);
    useOffline.getState().clearProgress(id);
  }
  job.task?.cancel();
}

export function deleteRegion(id: string) {
  const region = useOffline.getState().downloaded.find((d) => d.id === id);
  if (region?.files.search) closeOfflineSearch(region.files.search);
  removeRegion(id);
  const dir = regionDir(id);
  if (dir.exists) dir.delete();
  useOffline.getState().refreshDownloaded();
}
