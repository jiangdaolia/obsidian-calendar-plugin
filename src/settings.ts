import { App, PluginSettingTab, Setting } from "obsidian";
import { appHasDailyNotesPluginLoaded } from "obsidian-daily-notes-interface";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { DEFAULT_WEEK_FORMAT, DEFAULT_WORDS_PER_DOT } from "src/constants";

import type CalendarPlugin from "./main";

export interface ISettings {
  wordsPerDot: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;

  // Weekly Note settings
  showWeeklyNote: boolean;
  weeklyNoteFormat: string;
  weeklyNoteTemplate: string;
  weeklyNoteFolder: string;

  // Monthly Note settings
  showMonthlyNote: boolean;
  monthlyNoteFormat: string;
  monthlyNoteTemplate: string;
  monthlyNoteFolder: string;

  // Yearly Note settings
  showYearlyNote: boolean;
  yearlyNoteFormat: string;
  yearlyNoteTemplate: string;
  yearlyNoteFolder: string;

  localeOverride: ILocaleOverride;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const defaultSettings = Object.freeze({
  shouldConfirmBeforeCreate: true,
  weekStart: "locale" as IWeekStartOption,

  wordsPerDot: DEFAULT_WORDS_PER_DOT,

  showWeeklyNote: false,
  weeklyNoteFormat: "",
  weeklyNoteTemplate: "",
  weeklyNoteFolder: "",

  showMonthlyNote: true,
  monthlyNoteFormat: "YYYY-MM",
  monthlyNoteTemplate: "",
  monthlyNoteFolder: "",

  showYearlyNote: true,
  yearlyNoteFormat: "YYYY",
  yearlyNoteTemplate: "",
  yearlyNoteFolder: "",

  localeOverride: "system-default",
});

export function appHasPeriodicNotesPluginLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodicNotes = (<any>window.app).plugins.getPlugin("periodic-notes");
  return periodicNotes && periodicNotes.settings?.weekly?.enabled;
}

export function appHasPeriodicMonthlyNotes(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = (window.app as any).plugins.getPlugin("periodic-notes");
  return !!plugin?.settings?.monthly?.enabled;
}

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    if (!appHasDailyNotesPluginLoaded()) {
      this.containerEl.createDiv("settings-banner", (banner) => {
        banner.createEl("h3", {
          text: "⚠️ Daily Notes plugin not enabled",
        });
        banner.createEl("p", {
          cls: "setting-item-description",
          text:
            "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
        });
      });
    }

    this.containerEl.createEl("h3", {
      text: "General Settings",
    });
    this.addDotThresholdSetting();
    this.addWeekStartSetting();
    this.addConfirmCreateSetting();
    this.addShowWeeklyNoteSetting();

    if (
      this.plugin.options.showWeeklyNote &&
      !appHasPeriodicNotesPluginLoaded()
    ) {
      this.containerEl.createEl("h3", {
        text: "Weekly Note Settings",
      });
      this.containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
          "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
      });
      this.addWeeklyNoteFormatSetting();
      this.addWeeklyNoteTemplateSetting();
      this.addWeeklyNoteFolderSetting();
    }

    this.addMonthlyNoteSettings();
    this.addYearlyNoteSettings();

    this.containerEl.createEl("h3", {
      text: "Advanced Settings",
    });
    this.addLocaleOverrideSetting();
  }

  addDotThresholdSetting(): void {
    new Setting(this.containerEl)
      .setName("Words per dot")
      .setDesc("How many words should be represented by a single dot?")
      .addText((textfield) => {
        textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordsPerDot));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordsPerDot: value !== "" ? Number(value) : undefined,
          }));
        });
      });
  }

  addMonthlyNoteSettings(): void {
    this.containerEl.createEl("h3", { text: "Monthly Note Settings" });
    new Setting(this.containerEl)
      .setName("Enable monthly notes")
      .setDesc("Click the month in the calendar title to open or create its monthly note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showMonthlyNote);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({ showMonthlyNote: value }));
          this.display();
        });
      });

    if (!this.plugin.options.showMonthlyNote) return;
    if (appHasPeriodicMonthlyNotes()) {
      this.containerEl.createEl("p", {
        cls: "setting-item-description",
        text: "Monthly note format, folder and template are managed by Periodic Notes. New notes use the shared confirmation setting above.",
      });
      return;
    }

    const fields = [
      {
        key: "monthlyNoteFormat",
        name: "Monthly note format",
        description: "Moment date format for monthly note names",
        placeholder: "YYYY-MM",
      },
      {
        key: "monthlyNoteFolder",
        name: "Monthly note folder",
        description: "New monthly notes will be placed here",
        placeholder: "Vault root",
      },
      {
        key: "monthlyNoteTemplate",
        name: "Monthly note template",
        description: "Path to the template for new monthly notes",
        placeholder: "Templates/Monthly",
      },
    ] as const;
    fields.forEach(({ key, name, description, placeholder }) => {
      new Setting(this.containerEl)
        .setName(name)
        .setDesc(description)
        .addText((textfield) => {
          textfield.setValue(this.plugin.options[key]);
          textfield.setPlaceholder(placeholder);
          textfield.onChange(async (value) => {
            await this.plugin.writeOptions(() => ({ [key]: value }));
          });
        });
    });
  }

  addYearlyNoteSettings(): void {
    this.containerEl.createEl("h3", { text: "Yearly Note Settings" });
    new Setting(this.containerEl)
      .setName("Enable yearly notes")
      .setDesc("Click the year in the calendar title to open or create its yearly note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showYearlyNote);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({ showYearlyNote: value }));
          this.display();
        });
      });

    if (!this.plugin.options.showYearlyNote) return;
    const fields = [
      {
        key: "yearlyNoteFormat",
        name: "Yearly note format",
        description: "Moment date format for yearly note names",
        placeholder: "YYYY",
      },
      {
        key: "yearlyNoteFolder",
        name: "Yearly note folder",
        description: "New yearly notes will be placed here",
        placeholder: "Vault root",
      },
      {
        key: "yearlyNoteTemplate",
        name: "Yearly note template",
        description: "Path to the template for new yearly notes",
        placeholder: "Templates/Yearly",
      },
    ] as const;
    fields.forEach(({ key, name, description, placeholder }) => {
      new Setting(this.containerEl)
        .setName(name)
        .setDesc(description)
        .addText((textfield) => {
          textfield.setValue(this.plugin.options[key]);
          textfield.setPlaceholder(placeholder);
          textfield.onChange(async (value) => {
            await this.plugin.writeOptions(() => ({ [key]: value }));
          });
        });
    });
  }

  addWeekStartSetting(): void {
    const { moment } = window;

    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(this.containerEl)
      .setName("Start week on:")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });
  }

  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowWeeklyNoteSetting(): void {
    new Setting(this.containerEl)
      .setName("Show week number")
      .setDesc("Enable this to add a column with the week number")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showWeeklyNote);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
          this.display(); // show/hide weekly settings
        });
      });
  }

  addWeeklyNoteFormatSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note format")
      .setDesc("For more syntax help, refer to format reference")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFormat);
        textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
        });
      });
  }

  addWeeklyNoteTemplateSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note template")
      .setDesc(
        "Choose the file you want to use as the template for your weekly notes"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteTemplate);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
        });
      });
  }

  addWeeklyNoteFolderSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note folder")
      .setDesc("New weekly notes will be placed here")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFolder);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
        });
      });
  }

  addLocaleOverrideSetting(): void {
    const { moment } = window;

    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            localeOverride: value as ILocaleOverride,
          }));
        });
      });
  }
}
