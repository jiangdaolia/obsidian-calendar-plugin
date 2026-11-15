import type { Moment } from "moment";
import { normalizePath, Notice, TFile } from "obsidian";
import type { ISettings } from "src/settings";
import { createNoteFromTemplate } from "./createNoteFromTemplate";
import { createConfirmationDialog } from "src/ui/modal";

export function getYearlyNoteSettings(
  settings: ISettings
): { format: string; folder: string; template: string } {
  return {
    format: settings.yearlyNoteFormat || "YYYY",
    folder: settings.yearlyNoteFolder?.trim() || "",
    template: settings.yearlyNoteTemplate?.trim() || "",
  };
}

export function getYearlyNotePath(date: Moment, settings: ISettings): string {
  const { folder, format } = getYearlyNoteSettings(settings);
  const filename = date.clone().startOf("year").format(format);
  return normalizePath(
    `${folder}/${filename}${filename.endsWith(".md") ? "" : ".md"}`
  );
}

export function getYearlyNote(
  date: Moment,
  notes: Record<string, TFile>,
  settings: ISettings
): TFile | null {
  return notes[getYearlyNotePath(date, settings)] || null;
}

export function getYearlyDateFromFile(
  file: TFile,
  settings: ISettings
): Moment | null {
  if (!file || file.extension !== "md") return null;
  const { format, folder } = getYearlyNoteSettings(settings);
  const prefix = folder ? `${normalizePath(folder)}/` : "";
  if (!file.path.startsWith(prefix)) return null;
  const relativePath = file.path.slice(prefix.length);
  const date = window.moment(
    relativePath.slice(0, -3),
    format.replace(/\.md$/, ""),
    true
  );
  return date.isValid() && getYearlyNotePath(date, settings) === file.path
    ? date
    : null;
}

// Recheck inside the confirmation callback, including rapid repeated clicks.
const pendingCreates = new Map<string, Promise<TFile>>();

export async function tryToCreateYearlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const year = date.clone().startOf("year");
  const path = getYearlyNotePath(year, settings);
  const createFile = async () => {
    try {
      const { vault, workspace } = window.app;
      let file = vault.getAbstractFileByPath(path);
      if (!file) {
        let pending = pendingCreates.get(path);
        if (!pending) {
          pending = createNoteFromTemplate(year, path, getYearlyNoteSettings(settings));
          pendingCreates.set(path, pending);
        }
        try {
          file = await pending;
        } finally {
          pendingCreates.delete(path);
        }
      }
      if (!(file instanceof TFile)) {
        throw new Error(`Unable to open yearly note: ${path}`);
      }
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(file, { active: true });
      cb?.(file);
    } catch (error) {
      console.error("[Calendar] Failed to create yearly note", error);
      new Notice(`Unable to create yearly note: ${error.message}`);
    }
  };
  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${path} does not exist. Would you like to create it?`,
      title: "New Yearly Note",
    });
  } else {
    await createFile();
  }
}
