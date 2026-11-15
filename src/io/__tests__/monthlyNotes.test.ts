import moment from "moment";
import { Notice, TFile } from "obsidian";
import { createMonthlyNote, getMonthlyNoteSettings as periodicSettings, getTemplateInfo } from "obsidian-daily-notes-interface";
import { defaultSettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";
import { getMonthlyNote, getMonthlyNotePath, getMonthlyDateFromFile, getMonthlyNoteSettings, tryToCreateMonthlyNote } from "../monthlyNotes";

jest.mock("obsidian", () => ({
  TFile: class TFile {},
  PluginSettingTab: class {},
  Notice: jest.fn(),
  normalizePath: (path: string) => path.replace(/\\/g, "/").split("/").filter(Boolean).join("/"),
}), { virtual: true });
jest.mock("src/ui/modal", () => ({ createConfirmationDialog: jest.fn() }));
jest.mock("obsidian-daily-notes-interface", () => ({
  createMonthlyNote: jest.fn(),
  getMonthlyNoteSettings: jest.fn(),
  getTemplateInfo: jest.fn(),
}));

const settings = { ...defaultSettings, shouldConfirmBeforeCreate: false, monthlyNoteFolder: "Monthly" };
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
  // Only the APIs exercised by monthly notes are needed in this fixture.
  window.app = {
    plugins: { getPlugin: () => periodic },
    vault: {
      getAbstractFileByPath: (path: string) => files[path] || null,
      create,
      createFolder,
    },
    metadataCache: { getFirstLinkpathDest: () => file("Templates/Monthly.md") },
    workspace: {
      getUnpinnedLeaf: () => ({ openFile }),
      splitActiveLeaf: () => ({ openFile: splitOpenFile }),
    },
  } as unknown as typeof window.app;
});

test("uses local configuration and exact paths instead of similarly named files", () => {
  expect(getMonthlyNoteSettings(settings).folder).toBe("Monthly");
  expect(getMonthlyNotePath(date, settings)).toBe("Monthly/2026-11.md");
  expect(getMonthlyNote(date, { "Other/2026-11.md": file("Other/2026-11.md") }, settings)).toBeNull();
  expect(getMonthlyDateFromFile(file("Other/2026-11.md"), settings)).toBeNull();
});

test("recognizes nested date formats and year boundaries", () => {
  const nested = { ...settings, monthlyNoteFormat: "YYYY/MM-[Monthly]" };
  const target = file("Monthly/2027/01-Monthly.md");
  expect(getMonthlyDateFromFile(target, nested)?.format("YYYY-MM")).toBe("2027-01");
  expect(getMonthlyNotePath(moment("2027-01-31"), nested)).toBe(target.path);
});

test("enabled Periodic Notes overrides local settings; disabled uses local settings", () => {
  periodic = { settings: { monthly: { enabled: true } } };
  (periodicSettings as jest.Mock).mockReturnValue({ format: "YYYY/[M]MM", folder: "Periodic", template: "Template" });
  expect(getMonthlyNotePath(date, settings)).toBe("Periodic/2026/M11.md");
  periodic = { settings: { monthly: { enabled: false } } };
  expect(getMonthlyNotePath(date, settings)).toBe("Monthly/2026-11.md");
});

test("creates missing folders, renders template dates for the selected month, and opens the file", async () => {
  (getTemplateInfo as jest.Mock).mockResolvedValue(["# {{title}}\n{{date:YYYY-MM-DD}} {{date}} {{time}}", null]);
  await tryToCreateMonthlyNote(date, false, { ...settings, monthlyNoteFolder: "Notes/Monthly", monthlyNoteTemplate: "Templates/Monthly" });
  expect(createFolder.mock.calls).toEqual([["Notes"], ["Notes/Monthly"]]);
  expect(create).toHaveBeenCalledWith("Notes/Monthly/2026-11.md", expect.stringMatching(/^# 2026-11\n2026-11-01 2026-11 \d\d:\d\d$/));
  expect(openFile).toHaveBeenCalledWith(files["Notes/Monthly/2026-11.md"], { active: true });
  expect(date.format("YYYY-MM-DD")).toBe("2026-11-19");
});

test("confirmation cancellation creates nothing; accepting rechecks for an existing note", async () => {
  await tryToCreateMonthlyNote(date, false, { ...settings, shouldConfirmBeforeCreate: true });
  expect(create).not.toHaveBeenCalled();
  files["Monthly/2026-11.md"] = file("Monthly/2026-11.md");
  await (createConfirmationDialog as jest.Mock).mock.calls[0][0].onAccept();
  expect(create).not.toHaveBeenCalled();
  expect(openFile).toHaveBeenCalled();
});

test("simultaneous clicks create one file and support split opening", async () => {
  await Promise.all([
    tryToCreateMonthlyNote(date, true, settings),
    tryToCreateMonthlyNote(date, false, settings),
  ]);
  expect(create).toHaveBeenCalledTimes(1);
  expect(splitOpenFile).toHaveBeenCalled();
  expect(openFile).toHaveBeenCalled();
});

test("uses the existing Periodic Notes creator when monthly notes are enabled", async () => {
  periodic = { settings: { monthly: { enabled: true } } };
  (periodicSettings as jest.Mock).mockReturnValue({ format: "YYYY-MM", folder: "Periodic" });
  (createMonthlyNote as jest.Mock).mockResolvedValue(file("Periodic/2026-11.md"));
  await tryToCreateMonthlyNote(date, false, settings);
  expect(createMonthlyNote).toHaveBeenCalledWith(expect.objectContaining({}));
  expect((createMonthlyNote as jest.Mock).mock.calls[0][0].date()).toBe(1);
  expect(create).not.toHaveBeenCalled();
});

test("failed creation reports an error and does not open a file", async () => {
  create.mockRejectedValueOnce(new Error("Disk full"));
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await tryToCreateMonthlyNote(date, false, settings);
  expect(Notice).toHaveBeenCalledWith("Unable to create monthly note: Disk full");
  expect(openFile).not.toHaveBeenCalled();
  log.mockRestore();
});
