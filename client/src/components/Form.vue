<template>
  <aside>
    <div class="table">
      <label>
        <span>Start date</span>
        <div><input v-model="start" name="start" type="date" /></div>
      </label>
      <label>
        <span>End date</span>
        <div><input v-model="end" name="end" type="date" /></div>
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
      <button @click="clearMapCache">
        Clear map cache
      </button>
    </div>
    <p :class="[error && 'error']">
      {{ statusMessage }}
    </p>
  </aside>
</template>

<script>
import activityTypes from '../activityTypes';

const count = (n, singular, plural = undefined) => {
  switch (n) {
    case 0:
      return `no ${plural || `${singular}s`}`;
    case 1:
      return `1 ${singular}`;
    default:
      return `${n} ${plural || `${singular}s`}`;
  }
};

const countActivities = (n) => count(n, 'activity', 'activities');

const findingString = ({ finished = false, length = 0 } = {}) => {
  if (finished) return `found ${countActivities(length)}`;
  if (length) return `found ${countActivities(length)} so far`;
  return '';
};
const mapString = (requested = 0, length = 0) => {
  if (requested && requested === length) return 'loaded all maps';
  if (length) return `loaded ${length} of ${count(requested, 'map')} so far`;
  if (requested) return `requested ${count(requested, 'map')}`;
  return '';
};

const saveCachedMap = (id, map) => {
  localStorage.setItem(`map:summary:${id}`, map);
};

const saveCachedMaps = (mappings) => {
  return Object.entries(mappings).map(([id, map]) => saveCachedMap(id, map));
};

const getCachedMap = (id) => {
  return localStorage.getItem(`map:summary:${id}`);
};

const getCachedActivities = () => {
  return JSON.parse(localStorage.getItem('activities'));
};

const saveCachedActivities = (activities) => {
  return localStorage.setItem('activities', JSON.stringify(activities));
};

const clearMapCache = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('map:')) {
      localStorage.removeItem(key);
    }
  });
};

/**
 * @param {number[]} ids
 */
const getCachedMaps = (ids) => {
  /** @type {number[]} */
  const notCached = [];

  /** @type {Object<string, string>} */
  const cached = {};
  ids.flatMap((id) => {
    const fromCache = getCachedMap(id);
    if (fromCache) cached[id] = fromCache;
    else notCached.push(id);
  });
  return { cached, notCached };
};

const nonEmpties = (...args) => args.filter(Boolean);
const capitalise = (string) => string.slice(0, 1).toUpperCase() + string.slice(1);

/**
 * @typedef {object} Activity
 * @property {number} id
 * @property {string} name
 * @property {string} date
 * @property {string} map
 * @property {string} type
 * @property {string[]} dateString
 */

/**
 * @param {Activity[]} activities
 * @param {string=} type
 * @return {Activity[]}
 */
function filterActivities(activities, type = undefined) {
  return activities.filter((activity) => !type || type.split(',').includes(activity.type));
}

export default {
  name: 'Form',
  data() {
    return {
      start: undefined,
      end: null,
      activityType: '',
      activityTypes: Object.entries(activityTypes).sort((a, b) => a[1].localeCompare(b[1])),
      stats: {},
      clientStats: {
        mapsRequested: 0,
        mapsLoaded: 0,
      },
      error: null,
    };
  },
  computed: {
    statusMessage() {
      const statsMessage = () => {
        // TODO: lift finding up
        const { finding = {} } = this.stats;
        return capitalise(
          nonEmpties(
            findingString(finding),
            mapString(this.clientStats.mapsRequested, this.clientStats.mapsLoaded),
          ).join(', '),
        );
      };
      return this.error || statsMessage();
    },
  },
  methods: {
    clearMapCache() {
      clearMapCache();
    },
    queryString(params) {
      const qs = new URLSearchParams();
      Object.keys(params).forEach((key) => qs.append(key, params[key]));
      return qs.toString();
    },
    setError(message) {
      this.error = message;
    },
    receiveMaps(maps) {
      this.clientStats.mapsLoaded += Object.keys(maps).length;
      this.$emit('addActivityMaps', maps);
    },
    async sockets() {
      this.$emit('clearActivities');
      this.clientStats.mapsLoaded = 0;
      this.clientStats.mapsRequested = 0;

      // TODO: don’t open if not needed
      const socket = new WebSocket(
        `ws://${window.location.host}/api/activities?${this.queryString({})}`,
      );
      let errored = false;

      const checkFinished = () => {
        if (
          this.clientStats.mapsRequested === this.clientStats.mapsLoaded &&
          this.stats.finding.finished
        ) {
          socket.close();
        }
      };

      const requestMaps = (ids) => {
        this.clientStats.mapsRequested += ids.length;
        const { cached, notCached } = getCachedMaps(ids);
        if (notCached.length) {
          socket.send(
            JSON.stringify({
              maps: notCached,
            }),
          );
        }
        this.receiveMaps(cached);
        checkFinished();
      };

      const receiveActivities = (activities) => {
        const filteredActivities = filterActivities(activities, this.activityType);
        this.$emit('addActivities', filteredActivities);
        requestMaps(filteredActivities.map(({ id }) => id));
      };

      socket.onerror = () => {
        errored = true;
        this.setError('Error fetching activities');
      };
      socket.onopen = () => {
        const activities = getCachedActivities();
        if (activities) {
          this.stats = { finding: { finished: true, length: activities.length } };
          receiveActivities(activities);
        } else {
          socket.send(
            JSON.stringify({
              // load a single range covering all time
              load: [{}],
            }),
          );
        }
      };
      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'stats') {
          this.stats = data;
        } else if (data.type === 'activities') {
          saveCachedActivities(data.activities);
          receiveActivities(data.activities);
        } else if (data.type === 'maps') {
          saveCachedMaps(data.chunk);
          this.receiveMaps(data.chunk);
        }
        checkFinished();
      };
      socket.onclose = () => {
        if (!errored) {
          this.stats = { status: 'disconnected' };
        }
      };
    },
  },
};
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
