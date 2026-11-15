import moment from "moment";
import { Notice, TFile } from "obsidian";
import { getTemplateInfo } from "obsidian-daily-notes-interface";
import { defaultSettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";
import { getYearlyNote, getYearlyNotePath, getYearlyDateFromFile, getYearlyNoteSettings, tryToCreateYearlyNote } from "../yearlyNotes";

jest.mock("obsidian", () => ({
  TFile: class TFile {},
  PluginSettingTab: class {},
  Notice: jest.fn(),
  normalizePath: (path: string) => path.replace(/\\/g, "/").split("/").filter(Boolean).join("/"),
}), { virtual: true });
jest.mock("src/ui/modal", () => ({ createConfirmationDialog: jest.fn() }));
jest.mock("obsidian-daily-notes-interface", () => ({
  createYearlyNote: jest.fn(),
  getYearlyNoteSettings: jest.fn(),
  getTemplateInfo: jest.fn(),
}));

const settings = { ...defaultSettings, shouldConfirmBeforeCreate: false, yearlyNoteFolder: "Yearly" };
const date = moment("2026-11-19");
let periodic: unknown;
let files: Record<string, TFile>;
const openFile = jest.fn();
const splitOpenFile = jest.fn();
const create = jest.fn();
const createFolder = jest.fn();

function file(path: string): TFile {
  return Object.assign(new TFile(), { path, extension: "md", basename: path.split("/").pop().slice(0, -3) });
}

beforeEach(() => {
  jest.clearAllMocks();
  periodic = null;
  files = {};
  create.mockImplementation(async (path) => (files[path] = file(path)));
  window.moment = moment;
  // Only the APIs exercised by yearly notes are needed in this fixture.
  window.app = {
    plugins: { getPlugin: () => periodic },
    vault: {
      getAbstractFileByPath: (path: string) => files[path] || null,
      create,
      createFolder,
    },
    metadataCache: { getFirstLinkpathDest: () => file("Templates/Yearly.md") },
    workspace: {
      getUnpinnedLeaf: () => ({ openFile }),
      splitActiveLeaf: () => ({ openFile: splitOpenFile }),
    },
  } as unknown as typeof window.app;
});

test("uses local configuration and exact paths instead of similarly named files", () => {
  expect(getYearlyNoteSettings(settings).folder).toBe("Yearly");
  expect(getYearlyNotePath(date, settings)).toBe("Yearly/2026.md");
  expect(getYearlyNote(date, { "Other/2026.md": file("Other/2026.md") }, settings)).toBeNull();
  expect(getYearlyDateFromFile(file("Other/2026.md"), settings)).toBeNull();
});

test("recognizes nested date formats and year boundaries", () => {
  const nested = { ...settings, yearlyNoteFormat: "YYYY/[Yearly]" };
  const target = file("Yearly/2027/Yearly.md");
  expect(getYearlyDateFromFile(target, nested)?.format("YYYY")).toBe("2027");
  expect(getYearlyNotePath(moment("2027-01-31"), nested)).toBe(target.path);
});

test("creates missing folders, renders template dates for the selected month, and opens the file", async () => {
  (getTemplateInfo as jest.Mock).mockResolvedValue(["# {{title}}\n{{date:YYYY-MM-DD}} {{date}} {{time}}", null]);
  await tryToCreateYearlyNote(date, false, { ...settings, yearlyNoteFolder: "Notes/Yearly", yearlyNoteTemplate: "Templates/Yearly" });
  expect(createFolder.mock.calls).toEqual([["Notes"], ["Notes/Yearly"]]);
  expect(create).toHaveBeenCalledWith("Notes/Yearly/2026.md", expect.stringMatching(/^# 2026\n2026-01-01 2026 \d\d:\d\d$/));
  expect(openFile).toHaveBeenCalledWith(files["Notes/Yearly/2026.md"], { active: true });
  expect(date.format("YYYY-MM-DD")).toBe("2026-11-19");
});

test("confirmation cancellation creates nothing; accepting rechecks for an existing note", async () => {
  await tryToCreateYearlyNote(date, false, { ...settings, shouldConfirmBeforeCreate: true });
  expect(create).not.toHaveBeenCalled();
  files["Yearly/2026.md"] = file("Yearly/2026.md");
  await (createConfirmationDialog as jest.Mock).mock.calls[0][0].onAccept();
  expect(create).not.toHaveBeenCalled();
  expect(openFile).toHaveBeenCalled();
});

test("simultaneous clicks create one file and support split opening", async () => {
  await Promise.all([
    tryToCreateYearlyNote(date, true, settings),
    tryToCreateYearlyNote(date, false, settings),
  ]);
  expect(create).toHaveBeenCalledTimes(1);
  expect(splitOpenFile).toHaveBeenCalled();
  expect(openFile).toHaveBeenCalled();
});

test("failed creation reports an error and does not open a file", async () => {
  create.mockRejectedValueOnce(new Error("Disk full"));
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await tryToCreateYearlyNote(date, false, settings);
  expect(Notice).toHaveBeenCalledWith("Unable to create yearly note: Disk full");
  expect(openFile).not.toHaveBeenCalled();
  log.mockRestore();
});
