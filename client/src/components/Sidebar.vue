<template>
  <div class="sidebar">
    <h1>Strava Heatmapper</h1>
    <FormComponent
      ref="form"
      @clear-activities="$emit('clear-activities')"
      @add-activities="$emit('add-activities', $event)"
      @add-activity-maps="$emit('add-activity-maps', $event)"
    />
    <ul>
      <ActivityItem
        v-for="activity of activities"
        :key="activity.id"
        :activity="activity"
        :selected="selected.includes(activity.id)"
        @click="select(activity.id, $event)"
        @dblclick="forceSelect"
      />
    </ul>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch, Ref, Emit } from 'vue-property-decorator';

import Activity from '../../../shared/interfaces/Activity';
import FormComponent from './Form.vue';
import ActivityItem from './ActivityItem.vue';

function findLastIndex<T>(xs: T[], p: (x: T) => boolean): number {
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    if (p(xs[i])) return i;
  }
  return -1;
}

function getRange(activities: Activity[], to: number, from?: number | number[]): number[] {
  if (to === undefined) return [];
  if (from === undefined) return [to];
  const fromArray: number[] = [from].flat();
  if (fromArray.includes(to)) return fromArray;

  const start = activities.findIndex(({ id }) => to === id || fromArray.includes(id));
  if (start === -1) return [to, ...fromArray];
  const end = findLastIndex(activities, ({ id }) => to === id || fromArray.includes(id));
  return activities.slice(start, end + 1).map(({ id }) => id);
}

function cancelTextSelection() {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }
}

@Component({
  components: { FormComponent, ActivityItem },
})
export default class Sidebar extends Vue {
  @Prop({ default: () => [] }) activities!: Activity[];

  @Prop({ default: () => [] }) selected!: number[];

  @Ref() form!: Vue & { loadFromCache(): void };

  localSelected?: number[] = undefined;

  selectionBase?: number[] = undefined;

  getSelection(id: number, e: MouseEvent): number[] {
    if (e.metaKey || e.ctrlKey) return [...this.selected, id];
    if (e.shiftKey) return getRange(this.activities, id, this.selectionBase);
    return [id];
  }

  select(id: number, e: MouseEvent): void {
    if (e.detail > 1) return;
    if (e.shiftKey) cancelTextSelection();
    const newSelected = this.getSelection(id, e);
    if (newSelected.length === 1) this.selectionBase = newSelected;
    this.localSelected = newSelected;
    this.$emit('update:selected', newSelected);
  }

  @Emit('zoom-to-selected')
  forceSelect(): number[] {
    cancelTextSelection();
    return this.selected;
  }

  @Watch('selected') async onSelected(selected: number[]): Promise<void> {
    if (selected !== this.localSelected) {
      this.localSelected = selected;
      this.selectionBase = selected;
      await this.$nextTick();
      const el = this.$el.querySelector('.selected');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  mounted(): void {
    if (!this.activities || this.activities.length === 0) {
      this.form.loadFromCache();
    }
  }
}
</script>

<style lang="scss">
.sidebar {
  flex: 0 20em;
  display: flex;
  flex-direction: column;
  color: var(--color);
  background-color: var(--background);

  h1 {
    padding: 0 1em;
    text-align: center;
  }

  > ul {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 0 0 1em;
  }
}
</style>
