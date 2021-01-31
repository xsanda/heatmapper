<template>
  <aside>
    <div class="controls">
      <label>
        <span>Start date</span>
        <date-input v-model="start" name="start" />
      </label>
      <label>
        <span>End date</span>
        <date-input v-model="end" name="end" />
      </label>
      <label>
        <span>Activity type</span>
        <Dropdown
          v-model="activityType"
          :options="activityTypes"
          blank-value=""
          blank-label="All activities"
        />
      </label>
    </div>
    <div class="buttons">
      <button @click="loadPartial">Load</button>
      <button @click="loadRoutes">Routes</button>
      <button @click="clearCache">Clear cache</button>
    </div>
    <div v-if="continueLogin" class="not-logged-in-container">
      <div class="not-logged-in">
        <p>You are not logged in. Click to continue to log in with Strava.</p>
        <p class="centered">
          <button @click="continueLogin && continueLogin()">Log in</button>
        </p>
        <p class="small">
          This will use a cookie to remember who you are logged in as, which you can clear at any
          time by clicking "Clear Cache". You may
          <a href="#no-cookies" @click.prevent="continueLogin && continueLogin(false)"
            >proceed without cookies</a
          >
          if you wish to log in every time.
        </p>
      </div>
    </div>
    <p v-else :class="[error && 'error']" v-text="statusMessage" />
  </aside>
</template>

<script lang="ts">
import type { Activity, ResponseMessage, Route } from '@strava-heatmapper/shared/interfaces';
import { TimeRange } from '@strava-heatmapper/shared/interfaces';
import { Component, Emit, Vue, Watch } from 'vue-property-decorator';

import activityTypes from '../activityTypes';
import Socket from '../socket';
import DateInput from './DateInput.vue';
import Dropdown from './Dropdown.vue';

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

function findingString(
  // eslint-disable-next-line no-use-before-define
  { started = false, finished = false, length = 0 }: Form['stats']['finding'] = {},
  inCache = false,
) {
  if (finished && inCache) return `found ${countActivities(length)} in cache`;
  if (finished) return `found ${countActivities(length)}`;
  if (length) return `found ${countActivities(length)} so far`;
  if (started) return 'finding activities';
  return '';
}

function mapString(requested = 0, length = 0, uncached = 0) {
  if (uncached && requested === 0) return 'but no maps cached';
  if (uncached) return `loaded ${length} maps, ${uncached} maps not cached`;
  if (requested && requested === length) return 'loaded all maps';
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
  const ids = new Set(activities.map((activity) => activity.id));
  const newStore: ActivityStore = {
    covered: TimeRange.merge((existingStore.covered || []).concat({ start, end })),
    activities: (existingStore.activities || [])
      .filter((existingActivity) => !ids.has(existingActivity.id))
      .concat(activities)
      .sort((a, b) => b.id - a.id),
  };
  localStorage.setItem('activities', JSON.stringify(newStore));
}

function getCachedMaps(ids: (string | number)[]) {
  const notCached: string[] = [];

  const cached: Record<string, string> = {};
  for (const id of ids) {
    const fromCache = getCachedMap(id);
    if (fromCache) cached[id] = fromCache;
    else notCached.push(id.toString());
  }
  return { cached, notCached };
}

const nonEmpties = (...args: string[]) => args.filter(Boolean);
const capitalise = (string: string) => string.slice(0, 1).toUpperCase() + string.slice(1);

function filterActivities(
  activities: Activity[],
  type?: string,
  start?: Date | null,
  end?: Date | null,
): Activity[] {
  return activities.filter((activity) =>
    [
      !type || type.split(',').includes(activity.type),
      !start || activity.date >= +start,
      !end || activity.date <= +end,
    ].every(Boolean),
  );
}

function filterRoutes(
  routes: Route[],
  type?: string,
  start?: Date | null,
  end?: Date | null,
): Route[] {
  return routes.filter((route) => [!type || type.split(',').includes(route.type)].every(Boolean));
}

@Component({
  components: { DateInput, Dropdown },
})
export default class Form extends Vue {
  start: Date | null = null;

  end: Date | null = null;

  continueLogin: null | (() => void) = null;

  activityType = '';

  activityTypes = Object.entries(activityTypes)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  stats: {
    status?: string;
    finding?: { started?: boolean; finished?: boolean; length?: number };
    cleared?: boolean;
  } = {};

  clientStats = {
    mapsRequested: 0,
    mapsLoaded: 0,
    mapsNotCached: 0,
    inCache: true,
  };

  error: string | null = null;

  starting = false;

  get statusMessage(): string {
    return this.error || this.statsMessage();
  }

  statsMessage(): string {
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

  clearCache(): void {
    localStorage.clear();
    document.cookie = `token=;expires=${new Date(0).toUTCString()}`;
    this.stats = { cleared: true };
    this.$emit('clear-activities');
  }

  setError(message: string): void {
    this.error = message;
  }

  @Emit('add-activity-maps')
  receiveMaps(maps: Record<string, string>): Record<string, string> {
    this.clientStats.mapsLoaded += Object.keys(maps).length;
    return maps;
  }

  @Watch('activityType')
  onActivityType(): void {
    this.$emit('clear-activities', this);
    this.loadFromCache();
  }

  requestMaps(ids: (number | string)[], socket?: Socket): void {
    this.clientStats.mapsRequested += ids.length;
    const { cached, notCached } = getCachedMaps(ids);
    if (socket && notCached.length) {
      socket.sendRequest({
        maps: notCached,
      });
    }
    this.receiveMaps(cached);
    this.checkFinished(socket);
  }

  receiveActivities(activities: Activity[], socket?: Socket): void {
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

  receiveRoutes(routes: Route[], socket?: Socket): void {
    const filteredRoutes = filterRoutes(routes, this.activityType);
    this.$emit('add-activities', filteredRoutes);
    this.requestMaps(
      filteredRoutes.map(({ id }) => id),
      socket,
    );
  }

  checkFinished(socket?: Socket): void {
    if (
      socket &&
      !this.starting &&
      this.clientStats.mapsRequested === this.clientStats.mapsLoaded &&
      this.stats.finding?.finished
    ) {
      socket.close();
    }
  }

  loadFromCache(partial = false): void {
    const activities = getCachedActivities();
    if (activities && activities.length) {
      if (!partial) this.stats = { finding: { finished: true, length: activities.length } };
      const cachedActivities = activities.filter(({ id }) => getCachedMap(id));
      this.clientStats.mapsNotCached = activities.length - cachedActivities.length;
      this.receiveActivities(cachedActivities);
    }
  }

  startLoading(socket: Socket, ranges: TimeRange[]): void {
    socket.sendRequest({
      activities: ranges,
    });
  }

  startLoadingRoutes(socket: Socket): void {
    socket.sendRequest({
      routes: true,
    });
  }

  async load(): Promise<void> {
    await this.sockets();
  }

  async loadPartial(): Promise<void> {
    await this.sockets({ partial: true });
  }

  async loadRoutes(): Promise<void> {
    await this.sockets({ routes: true });
  }

  async sockets({ partial = false, routes = false } = {}): Promise<void> {
    this.$emit('clear-activities', this);
    if (partial) this.loadFromCache(partial);
    this.clientStats = {
      mapsRequested: 0,
      mapsLoaded: 0,
      mapsNotCached: 0,
      inCache: false,
    };
    this.error = null;

    const start = this.start ? this.start.getTime() / 1000 : 0;
    const end = (this.end ? this.end.getTime() : Date.now()) / 1000;

    let latestActivityDate = start;

    const protocol = window.location.protocol.includes('https') ? 'wss' : 'ws';
    const socket = new Socket(
      `${protocol}://${window.location.host}/api/activities`,
      (message) => {
        const data: ResponseMessage = JSON.parse(message.data);
        switch (data.type) {
          case 'stats': {
            const oldStats = this.stats;
            this.stats = data;
            if (!oldStats?.finding?.finished && data.finding.finished) {
              appendCachedActivities([], latestActivityDate, start);
            }
            break;
          }
          case 'activities': {
            const activityCount = data.activities.length;
            if (activityCount === 0) break;
            this.receiveActivities(data.activities, socket);

            // API returns in descending order
            const latestDate = new Date(data.activities[0].date).getTime() / 1000;
            const earliestDate = new Date(data.activities[activityCount - 1].date).getTime() / 1000;
            latestActivityDate = Math.max(latestActivityDate, latestDate);
            appendCachedActivities(data.activities, latestDate, earliestDate);
            break;
          }
          case 'routes': {
            const routeCount = data.routes.length;
            if (routeCount === 0) break;
            this.receiveRoutes(data.routes, socket);
            break;
          }
          case 'maps': {
            saveCachedMaps(data.chunk);
            this.receiveMaps(data.chunk);
            break;
          }
          case 'login': {
            this.continueLogin = (cookies = true) => {
              if (cookies) document.cookie = `token=${data.cookie};max-age=31536000`;
              this.continueLogin = null;
              window.open(data.url, 'menubar=false,toolbar=false,width=300, height=300');
            };
            break;
          }
          default:
            // eslint-disable-next-line no-console
            console.warn(`Unknown message ${data}`);
        }
        this.checkFinished(socket);
      },
      (errored) => {
        if (errored) {
          this.setError('Error fetching activities');
        } else {
          this.stats = { status: 'disconnected' };
        }
      },
    );

    if (routes) {
      this.startLoadingRoutes(socket);
    } else {
      this.starting = true;

      let ranges: TimeRange[];
      if (partial) {
        const { covered, activities } = getActivityStore();
        ranges = TimeRange.cap(TimeRange.invert(covered), start ?? 0, end);
        this.receiveActivities(activities, socket);
      } else {
        ranges = [{ start, end }];
      }

      this.startLoading(socket, ranges);
      this.starting = false;
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.controls {
  padding: 1em;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;

  label {
    display: flex;
    align-items: center;
    min-width: 0;
  }
}

aside > .buttons {
  margin: 5px auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly;
}

.error {
  color: red;
}

.not-logged-in-container {
  background-color: var(--background);
  padding: 1em;
  position: sticky;
  bottom: 1em;

  .not-logged-in {
    background-color: var(--background-strong);
    border-radius: 1em;
    padding: 1em;
  }

  p {
    margin-top: 0;
  }

  .centered {
    text-align: center;
  }
}

p.small {
  font-size: 0.8em;
}
</style>
