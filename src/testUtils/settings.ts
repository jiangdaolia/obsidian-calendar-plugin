import type { ISettings } from "src/settings";

export function getDefaultSettings(
  overrides: Partial<ISettings> = {}
): ISettings {
  return Object.assign(
    {},
    {
      weekStart: "sunday",
      shouldConfirmBeforeCreate: false,
      wordsPerDot: 50,
      showWeeklyNote: false,
      weeklyNoteFolder: "",
      weeklyNoteFormat: "",
      weeklyNoteTemplate: "",
      showMonthlyNote: true,
      monthlyNoteFormat: "YYYY-MM",
      monthlyNoteFolder: "",
      monthlyNoteTemplate: "",
      showYearlyNote: true,
      yearlyNoteFormat: "YYYY",
      yearlyNoteFolder: "",
      yearlyNoteTemplate: "",
    },
    overrides
  );
}
