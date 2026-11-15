import type { Moment } from "moment";
import type { TFile } from "obsidian";
import { getTemplateInfo } from "obsidian-daily-notes-interface";

export async function createNoteFromTemplate(
  date: Moment,
  path: string,
  config: { format: string; template: string }
): Promise<TFile> {
  const { vault } = window.app;
  const { template, format } = config;
  let contents = "";
  if (template) {
    const templateFile = window.app.metadataCache.getFirstLinkpathDest(template, "");
    if (!templateFile) {
      throw new Error(`Note template not found: ${template}`);
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

