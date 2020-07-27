<template>
  <aside>
    <div class="table">
      <label>
        <span>Start date</span>
        <div><date-input v-model="start" name="start" /></div>
      </label>
      <label>
        <span>End date</span>
        <div><date-input v-model="end" name="end" /></div>
      </label>
      <label>
        <span>Activity type</span>
        <div>
          <select v-model="activityType">
            <option selected value="">All activities</option>
            <option v-for="[x, y] of activityTypes" :key="x" :value="x">{{ y }}</option>
          </select>
        </div>
      </label>
    </div>
    <div class="buttons">
      <button @click="sockets">
        Load
      </button>
      <button @click="clearCache">
        Clear cache
      </button>
      <button @click="$emit('toggle:improved-hillshade')">
        Toggle hillshade
      </button>
    </div>
    <p :class="[error && 'error']">
      {{ statusMessage }}
    </p>
  </aside>
</template>

<script lang="ts">
import { Component, Vue, PropSync, Prop, Watch, Ref } from 'vue-property-decorator';

import { Activity, RequestMessage, ResponseMessage, TimeRange } from '../../../shared/interfaces';
import DateInput from './DateInput.vue';
import activityTypes from '../activityTypes';

interface ActivityStore {
  covered: TimeRange[];
  activities: Activity[];
}

function count(n: number, singular: string, plural?: string): string {
  switch (n) {
    case 0:
      return `no ${plural || `${singular}s`}`;
    case 1:
      return `1 ${singular}`;
    default:
      return `${n} ${plural || `${singular}s`}`;
  }
}

const countActivities = (n: number) => count(n, 'activity', 'activities');

function findingString({ finished = false, length = 0 } = {}, inCache = false) {
  if (finished && inCache) return `found ${countActivities(length)} in cache`;
  if (finished) return `found ${countActivities(length)}`;
  if (length) return `found ${countActivities(length)} so far`;
  return '';
}

function mapString(requested = 0, length = 0, uncached = 0) {
  if (uncached && requested === 0) return `but no maps cached`;
  if (uncached) return `loaded ${length} maps, ${uncached} maps not cached`;
  if (requested && requested === length) return `loaded all maps`;
  if (length) return `loaded ${length} of ${count(requested, 'map')} so far`;
  if (requested) return `requested ${count(requested, 'map')}`;
  return '';
}

function saveCachedMap(id: number | string, map: string) {
  localStorage.setItem(`map:summary:${id}`, map);
}

function saveCachedMaps(mappings: Record<string, string>) {
  Object.entries(mappings).map(([id, map]) => saveCachedMap(id, map));
}

function getCachedMap(id: number | string) {
  return localStorage.getItem(`map:summary:${id}`);
}

function getActivityStore(): ActivityStore {
  const cache = localStorage.getItem('activities');
  return cache ? JSON.parse(cache) : { covered: [], activities: [] };
}

function getCachedActivities(): Activity[] {
  return getActivityStore().activities;
}

function appendCachedActivities(activities: Activity[], end: number, start?: number) {
  const existingStore = getActivityStore();
  const newStore: ActivityStore = {
    covered: TimeRange.merge((existingStore.covered || []).concat({ start, end })),
    activities: (existingStore.activities || []).concat(activities),
  };
  localStorage.setItem('activities', JSON.stringify(newStore));
}

function clearCachedActivities() {
  localStorage.removeItem('activities');
}

function getCachedMaps(ids: number[]) {
  const notCached: number[] = [];

  const cached: Record<string, string> = {};
  ids.flatMap((id) => {
    const fromCache = getCachedMap(id);
    if (fromCache) cached[id] = fromCache;
    else notCached.push(id);
  });
  return { cached, notCached };
}

function queryString(params: Record<string, string>) {
  const qs = new URLSearchParams();
  Object.keys(params).forEach((key) => qs.append(key, params[key]));
  return qs.toString();
}

const nonEmpties = (...args: string[]) => args.filter(Boolean);
const capitalise = (string: string) => string.slice(0, 1).toUpperCase() + string.slice(1);

function filterActivities(
  activities: Activity[],
  type?: string,
  start?: Date | null,
  end?: Date | null,
): Activity[] {
  const startString = start && new Date(start).toISOString();
  const endString = end && new Date(end).toISOString();
  console.log({ startString, endString });
  return activities.filter((activity) =>
    [
      !type || type.split(',').includes(activity.type),
      !startString || startString.localeCompare(activity.date) <= 0,
      !endString || endString.localeCompare(activity.date) >= 0,
    ].every(Boolean),
  );
}

@Component({
  components: { DateInput },
})
export default class Form extends Vue {
  start: Date | null = null;

  end: Date | null = null;

  activityType = '';

  activityTypes = Object.entries(activityTypes).sort((a, b) => a[1].localeCompare(b[1]));

  stats: {
    status?: string;
    finding?: { finished?: boolean; length?: number };
    cleared?: boolean;
  } = {};

  clientStats = {
    mapsRequested: 0,
    mapsLoaded: 0,
    mapsNotCached: 0,
    inCache: true,
  };

  error: string | null = null;

  get statusMessage() {
    return this.error || this.statsMessage();
  }

  statsMessage() {
    // TODO: lift finding up
    const { finding = {}, cleared = false } = this.stats;
    if (cleared) return 'Cleared cache';
    return capitalise(
      nonEmpties(
        findingString(finding, this.clientStats.inCache),
        mapString(
          this.clientStats.mapsRequested,
          this.clientStats.mapsLoaded,
          this.clientStats.mapsNotCached,
        ),
      ).join(', '),
    );
  }

  clearCache() {
    localStorage.clear();
    this.stats = { cleared: true };
    this.$emit('clear-activities');
  }

  setError(message: string) {
    this.error = message;
  }

  receiveMaps(maps: Record<string, string>) {
    this.clientStats.mapsLoaded += Object.keys(maps).length;
    this.$emit('add-activity-maps', maps);
  }

  requestMaps(ids: number[], socket?: WebSocket) {
    this.clientStats.mapsRequested += ids.length;
    const { cached, notCached } = getCachedMaps(ids);
    if (socket && notCached.length) {
      socket.send(
        JSON.stringify({
          maps: notCached,
        }),
      );
    }
    this.receiveMaps(cached);
    this.checkFinished(socket);
  }

  receiveActivities(activities: Activity[], socket?: WebSocket) {
    const filteredActivities = filterActivities(
      activities,
      this.activityType,
      this.start,
      this.end,
    );
    this.$emit('add-activities', filteredActivities);
    this.requestMaps(
      filteredActivities.map(({ id }) => id),
      socket,
    );
  }

  checkFinished(socket?: WebSocket) {
    if (
      socket &&
      this.clientStats.mapsRequested === this.clientStats.mapsLoaded &&
      this.stats.finding?.finished
    ) {
      socket.close();
    }
  }

  loadFromCache() {
    const activities = getCachedActivities();
    if (activities) {
      this.stats = { finding: { finished: true, length: activities.length } };
      const cachedActivities = activities.filter(({ id }) => getCachedMap(id));
      this.clientStats.mapsNotCached = activities.length - cachedActivities.length;
      this.receiveActivities(cachedActivities);
    }
  }

  startLoading(socket: WebSocket, start?: number, end?: number) {
    clearCachedActivities();
    this.clientStats.inCache = false;
    socket.send(
      JSON.stringify({
        // load a single range covering all time
        load: [{ start, end }],
      } as RequestMessage),
    );
  }

  async sockets() {
    this.$emit('clear-activities', this);
    this.clientStats.mapsLoaded = 0;
    this.clientStats.mapsRequested = 0;
    this.error = null;

    // TODO: don’t open if not needed
    const socket = new WebSocket(`ws://${window.location.host}/api/activities`);
    let errored = false;

    const start = this.start ? this.start.getTime() / 1000 : 0;
    const end = this.end ? this.end.getTime() / 1000 : Date.now();

    const checkFinished = () => {
      if (
        this.clientStats.mapsRequested === this.clientStats.mapsLoaded &&
        this.stats.finding?.finished
      ) {
        socket.close();
      }
    };

    socket.onerror = () => {
      errored = true;
      this.setError('Error fetching activities');
    };
    socket.onopen = () => {
      this.startLoading(socket /* , start, end */);
    };
    socket.onmessage = (message) => {
      const data: ResponseMessage = JSON.parse(message.data);
      switch (data.type) {
        case 'stats': {
          const oldStats = this.stats;
          this.stats = data;
          if (!oldStats?.finding?.finished && data.finding.finished) {
            appendCachedActivities([], end, start);
          }
          break;
        }
        case 'activities':
          this.receiveActivities(data.activities, socket);
          appendCachedActivities(data.activities, end);
          break;
        case 'maps':
          saveCachedMaps(data.chunk);
          this.receiveMaps(data.chunk);
          break;
        default:
          console.log(`Unknown message ${data}`);
      }
      checkFinished();
    };
    socket.onclose = () => {
      if (!errored) {
        this.stats = { status: 'disconnected' };
      }
    };
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.table {
  display: table;
  margin: auto;

  > * {
    display: table-row;

    > * {
      display: table-cell;
      padding: 0.2em 0.4em;
    }
  }
}

aside > .buttons {
  margin: 5px auto;
  display: flex;
  justify-content: space-evenly;
}

.error {
  color: red;
}
</style>
