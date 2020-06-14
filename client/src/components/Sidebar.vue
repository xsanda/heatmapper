<template>
  <div class="sidebar">
    <Form
      @clearActivities="$emit('clearActivities')"
      @addActivities="$emit('addActivities', $event)"
      @addActivityMaps="$emit('addActivityMaps', $event)"
    />
    <ul>
      <li
        v-for="activity of activities"
        :key="activity.id"
        :class="[selected.includes(activity.id) && 'selected']"
        @click="select(activity.id, $event)"
        @dblclick="forceSelect(activity.id, $event)"
      >
        <div class="activity-name">
          {{ activity.name }}
        </div>
        <div v-if="!activity.map" class="spinner">
          <Spinner size="tiny" line-fg-color="#888" />
        </div>
        <div class="date">
          {{ activity.dateString.join('\n') }}
        </div>
        <a
          :href="'https://www.strava.com/activities/' + activity.id"
          target="_blank"
          @click="$event.stopPropagation()"
          class="strava-link"
          ><img src="@/assets/strava_symbol_gray.png"/><img src="@/assets/strava_symbol_orange.png"
        /></a>
      </li>
    </ul>
  </div>
</template>

<script>
import Spinner from 'vue-simple-spinner';

import Form from './Form.vue';

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
  components: { Form, Spinner },
  data() {
    return { localSelected: null };
  },
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
      this.$emit('zoomToSelected', newSelected);
    },
  },
  updated() {
    this.$nextTick(() => {
      if (this.selected !== this.localSelected) {
        this.localSelected = this.selected;
        const el = this.$el.querySelector('.selected');
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.sidebar {
  flex: 0 20em;
  display: flex;
  flex-direction: column;

  > ul {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 1em 0;

    > li {
      cursor: pointer;
      list-style: none;
      padding: 2px 8px;
      font-size: 14px;
      display: flex;
      align-items: center;

      &:hover {
        background: #eee;
      }

      &.selected {
        background: #ccc;
      }

      .activity-name {
        flex: 1;
      }

      .spinner {
        padding: 0.5em;
      }

      .strava-link {
        $size: 1.5em;
        height: $size;
        width: $size;
        display: inline-block;
        overflow: hidden;

        > img {
          width: 100%;
        }

        &:hover > img:first-child {
          display: none;
        }
      }

      .date {
        display: inline-block;
        white-space: pre-line;
        font-size: 0.75em;
        text-align: right;
      }
    }
  }
}
</style>
