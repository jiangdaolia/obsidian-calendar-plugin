<svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import {
    Calendar as CalendarBase,
    configureGlobalMomentLocale,
  } from "obsidian-calendar-ui";
  import type { ICalendarSource } from "obsidian-calendar-ui";
  import { onDestroy } from "svelte";

  import type { ISettings } from "src/settings";
  import { getMonthlyNote } from "src/io/monthlyNotes";
  import {
    activeFile,
    dailyNotes,
    monthlyNotes,
    settings,
    weeklyNotes,
  } from "./stores";

  let today: Moment;

  $: today = getToday($settings);

  export let displayedMonth: Moment = window.moment();
  export let sources: ICalendarSource[];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => boolean;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => boolean;
  export let onClickDay: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onClickMonth: (date: Moment, isMetaPressed: boolean) => Promise<void>;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean;

  $: monthlyNote = getMonthlyNote(displayedMonth, $monthlyNotes, $settings);
  $: monthlyLabel = `${monthlyNote ? "Open" : "Create"} monthly note: ${displayedMonth.format("YYYY-MM")}`;

  // Calendar UI 0.3.12 has no navigation slot. Move our managed button next
  // to its title; Svelte still owns updates and removes it on teardown.
  function besideMonth(button: HTMLButtonElement) {
    button.parentElement
      .querySelector(".nav .title")
      .insertAdjacentElement("afterend", button);
    return { destroy: () => button.remove() };
  }

  export function tick() {
    today = window.moment();
  }

  function getToday(settings: ISettings) {
    configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
    dailyNotes.reindex();
    weeklyNotes.reindex();
    monthlyNotes.reindex();
    return window.moment();
  }

  // 1 minute heartbeat to keep `today` reflecting the current day
  let heartbeat = setInterval(() => {
    tick();

    const isViewingCurrentMonth = displayedMonth.isSame(today, "day");
    if (isViewingCurrentMonth) {
      // if it's midnight on the last day of the month, this will
      // update the display to show the new month.
      displayedMonth = today;
    }
  }, 1000 * 60);

  onDestroy(() => {
    clearInterval(heartbeat);
  });
</script>

<div>
  <CalendarBase
    {sources}
    {today}
    {onHoverDay}
    {onHoverWeek}
    {onContextMenuDay}
    {onContextMenuWeek}
    {onClickDay}
    {onClickWeek}
    bind:displayedMonth
    localeData={today.localeData()}
    selectedId={$activeFile}
    showWeekNums={$settings.showWeeklyNote}
  />
  {#if $settings.showMonthlyNote}
    <button
      use:besideMonth
      class="calendar-monthly-note"
      class:has-note={!!monthlyNote}
      title={monthlyLabel}
      aria-label={monthlyLabel}
      on:click={(event) => onClickMonth(displayedMonth.clone(), event.metaKey || event.ctrlKey)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h6" />
      </svg>
    </button>
  {/if}
</div>
