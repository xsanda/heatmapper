<template>
  <div class="sidebar">
    <h1>Heatmapper</h1>
    <Form
      @clear-activities="$emit('clear-activities')"
      @add-activities="$emit('add-activities', $event)"
      @add-activity-maps="$emit('add-activity-maps', $event)"
      @toggle:improved-hillshade="$emit('toggle:improved-hillshade')"
    />
    <ul>
      <ActivityItem
        v-for="activity of activities"
        :key="activity.id"
        :activity="activity"
        :selected="selected.includes(activity.id)"
        @click="select(activity.id, $event)"
        @dblclick="forceSelect(activity.id, $event)"
      />
    </ul>
  </div>
</template>

<script>
import Form from './Form.vue';
import ActivityItem from './ActivityItem.vue';

function getRange(activities, from, to) {
  const selected = [];
  if (from === undefined) return [];
  if (to === undefined) return [from];
  if (from === to) return [from];
  let inRange = false;
  // eslint-disable-next-line no-restricted-syntax
  for (const activity of activities) {
    const found = activity.id === from || activity.id === to;
    if (inRange || found) selected.push(activity.id);
    if (found && inRange) return selected;
    if (found) inRange = !inRange;
  }
  return [from, to];
}

function cancelTextSelection() {
  window.getSelection?.().removeAllRanges();
}

export default {
  name: 'Sidebar',
  components: { Form, ActivityItem },
  props: {
    activities: { type: Array, default: () => [] },
    selected: { type: Array, default: () => [] },
  },
  methods: {
    getSelection(id, e) {
      if (e.metaKey || e.ctrlKey) return [...this.selected, id];
      if (e.shiftKey) return getRange(this.activities, this.selected[0], id);
      return [id];
    },
    select(id, e) {
      if (e.detail > 1) return;
      if (e.shiftKey) cancelTextSelection();
      const newSelected = this.getSelection(id, e);
      this.localSelected = newSelected;
      this.$emit('update:selected', newSelected);
    },
    forceSelect(id, e) {
      cancelTextSelection();
      const newSelected = this.getSelection(id, e);
      this.localSelected = newSelected;
      this.$emit('zoom-to-selected', newSelected);
    },
  },
  watch: {
    selected(selected) {
      if (selected !== this.localSelected) {
        this.localSelected = selected;
        const el = this.$el.querySelector('.selected');
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
  },
};
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
