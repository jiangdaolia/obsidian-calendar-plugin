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
  import { getYearlyNote } from "src/io/yearlyNotes";
  import { getMonthlyNote } from "src/io/monthlyNotes";
  import {
    activeFile,
    dailyNotes,
    monthlyNotes,
    yearlyNotes,
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
  export let onClickYear: (date: Moment, isMetaPressed: boolean) => Promise<void>;
  export let onClickMonth: (date: Moment, isMetaPressed: boolean) => Promise<void>;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean;

  $: monthlyNote = getMonthlyNote(displayedMonth, $monthlyNotes, $settings);
  $: monthlyLabel = `${monthlyNote ? "Open" : "Create"} monthly note: ${displayedMonth.format("YYYY-MM")}`;

  $: yearlyNote = getYearlyNote(displayedMonth, $yearlyNotes, $settings);
  $: yearlyLabel = `${yearlyNote ? "Open" : "Create"} yearly note: ${displayedMonth.format("YYYY")}`;

  // Calendar UI 0.3.12 has no navigation slot. Place our accessible title
  // beside its hidden original so title clicks no longer reset the month.
  function mountTitle(heading: HTMLHeadingElement) {
    const original = heading.parentElement.querySelector<HTMLElement>(".nav .title");
    const display = original.style.display;
    original.style.display = "none";
    original.insertAdjacentElement("afterend", heading);
    return { destroy: () => {
      original.style.display = display;
      heading.remove();
    } };
  }

  export function tick() {
    today = window.moment();
  }

  function getToday(settings: ISettings) {
    configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
    dailyNotes.reindex();
    weeklyNotes.reindex();
    monthlyNotes.reindex();
    yearlyNotes.reindex();
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
  <h3 use:mountTitle class="calendar-note-title">
    {#if $settings.showMonthlyNote}
      <button
        class="month calendar-month-link"
        class:has-note={!!monthlyNote}
        title={monthlyLabel}
        aria-label={monthlyLabel}
        on:click={(event) => onClickMonth(displayedMonth.clone(), event.metaKey || event.ctrlKey)}
      >{displayedMonth.format("MMM")}</button>
    {:else}
      <span class="month">{displayedMonth.format("MMM")}</span>
    {/if}
    {#if $settings.showYearlyNote}
      <button
        class="year calendar-year-link"
        class:has-note={!!yearlyNote}
        title={yearlyLabel}
        aria-label={yearlyLabel}
        on:click={(event) => onClickYear(displayedMonth.clone(), event.metaKey || event.ctrlKey)}
      >{displayedMonth.format("YYYY")}</button>
    {:else}
      <span class="year">{displayedMonth.format("YYYY")}</span>
    {/if}
  </h3>
</div>
