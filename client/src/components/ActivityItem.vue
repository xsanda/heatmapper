<template>
  <li
    :class="['activity-item', { selected }]"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick', $event)"
  >
    <div class="activity-name" v-text="activity.name" />
    <div v-if="!activity.map" class="spinner">
      <Spinner size="tiny" line-fg-color="#888" />
    </div>
    <div class="date" v-text="activity.dateString.join('\n')" />
    <a :href="url" target="_blank" @click="$event.stopPropagation()" class="strava-link">
      <img src="@/assets/strava_symbol_gray.png" />
      <img src="@/assets/strava_symbol_orange.png" />
    </a>
  </li>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import Spinner from 'vue-simple-spinner';
import { Route, Activity } from '../../../shared/interfaces';

@Component({
  components: { Spinner },
})
export default class ActivityItem extends Vue {
  @Prop({ required: true }) activity!: Activity | Route;

  @Prop({ default: false }) selected!: boolean;

  get url(): string {
    if ((this.activity as Route).route) return `https://www.strava.com/routes/${this.activity.id}`;
    return `https://www.strava.com/activities/${this.activity.id}`;
  }
}
</script>

<style lang="scss">
.activity-item {
  cursor: pointer;
  list-style: none;
  font-size: 14px;
  display: flex;
  align-items: center;

  &:hover {
    background: var(--background-slight);
  }

  &.selected {
    background: var(--background-strong);
  }

  > * {
    padding: 2px 0;
  }

  .activity-name {
    flex: 1;
    padding-left: 8px;
  }

  .spinner {
    padding: 0.5em;
  }

  .strava-link {
    $size: 1.5em;
    align-self: stretch;
    width: $size;
    display: flex;
    overflow: hidden;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding-right: 8px;

    > img {
      flex: 0 0 $size;
      height: $size;
    }

    &:hover > img:first-child {
      display: none;
    }

    &:not(:hover) > img:last-child {
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
</style>
