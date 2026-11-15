import type { Moment } from "moment";
import { normalizePath, Notice, TFile } from "obsidian";
import {
  createMonthlyNote as createPeriodicMonthlyNote,
  getMonthlyNoteSettings as getPeriodicMonthlySettings,
  getTemplateInfo,
} from "obsidian-daily-notes-interface";

import { appHasPeriodicMonthlyNotes, ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

export function getMonthlyNoteSettings(
  settings: ISettings
): { format: string; folder: string; template: string } {
  const config = appHasPeriodicMonthlyNotes()
    ? getPeriodicMonthlySettings()
    : {
        format: settings.monthlyNoteFormat,
        folder: settings.monthlyNoteFolder,
        template: settings.monthlyNoteTemplate,
      };
  return {
    format: config.format || "YYYY-MM",
    folder: config.folder?.trim() || "",
    template: config.template?.trim() || "",
  };
}

export function getMonthlyNotePath(date: Moment, settings: ISettings): string {
  const { folder, format } = getMonthlyNoteSettings(settings);
  const filename = date.clone().startOf("month").format(format);
  return normalizePath(
    `${folder}/${filename}${filename.endsWith(".md") ? "" : ".md"}`
  );
}

export function getMonthlyNote(
  date: Moment,
  notes: Record<string, TFile>,
  settings: ISettings
): TFile | null {
  return notes[getMonthlyNotePath(date, settings)] || null;
}

export function getMonthlyDateFromFile(
  file: TFile,
  settings: ISettings
): Moment | null {
  if (!file || file.extension !== "md") return null;
  const { format, folder } = getMonthlyNoteSettings(settings);
  const prefix = folder ? `${normalizePath(folder)}/` : "";
  if (!file.path.startsWith(prefix)) return null;
  const relativePath = file.path.slice(prefix.length);
  const date = window.moment(
    relativePath.slice(0, -3),
    format.replace(/\.md$/, ""),
    true
  );
  return date.isValid() && getMonthlyNotePath(date, settings) === file.path
    ? date
    : null;
}

async function createLocalMonthlyNote(
  date: Moment,
  settings: ISettings
): Promise<TFile> {
  const { vault } = window.app;
  const { template, format } = getMonthlyNoteSettings(settings);
  const path = getMonthlyNotePath(date, settings);
  let contents = "";
  if (template) {
    const templateFile = window.app.metadataCache.getFirstLinkpathDest(template, "");
    if (!templateFile) {
      throw new Error(`Monthly note template not found: ${template}`);
    }
    [contents] = await getTemplateInfo(template);
  }
  const now = window.moment();
  contents = contents
    .replace(
      /{{\s*(date|time)\s*:\s*(.*?)}}/gi,
      (_, _type, tokenFormat: string) => date.clone().set({
        hour: now.hour(),
        minute: now.minute(),
        second: now.second(),
      }).format(tokenFormat.trim())
    )
    .replace(/{{\s*(date|title)\s*}}/gi, () => date.format(format))
    .replace(/{{\s*time\s*}}/gi, () => now.format("HH:mm"));
  const parts = path.split("/");
  parts.pop();
  for (let i = 1; i <= parts.length; i++) {
    const folder = parts.slice(0, i).join("/");
    if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
  }
  return vault.create(path, contents);
}

// Recheck inside the confirmation callback, including rapid repeated clicks.
const pendingCreates = new Map<string, Promise<TFile>>();

export async function tryToCreateMonthlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const month = date.clone().startOf("month");
  const path = getMonthlyNotePath(month, settings);
  const createFile = async () => {
    try {
      const { vault, workspace } = window.app;
      let file = vault.getAbstractFileByPath(path);
      if (!file) {
        let pending = pendingCreates.get(path);
        if (!pending) {
          pending = appHasPeriodicMonthlyNotes()
            ? createPeriodicMonthlyNote(month)
            : createLocalMonthlyNote(month, settings);
          pendingCreates.set(path, pending);
        }
        try {
          file = await pending;
        } finally {
          pendingCreates.delete(path);
        }
      }
      if (!(file instanceof TFile)) {
        throw new Error(`Unable to open monthly note: ${path}`);
      }
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(file, { active: true });
      cb?.(file);
    } catch (error) {
      console.error("[Calendar] Failed to create monthly note", error);
      new Notice(`Unable to create monthly note: ${error.message}`);
    }
  };
  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${path} does not exist. Would you like to create it?`,
      title: "New Monthly Note",
    });
  } else {
    await createFile();
  }
}
