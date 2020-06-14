<template>
  <aside>
    <div class="grid">
      <label>
        <span>Start date</span>
        <input v-model="start" name="start" type="date" />
      </label>
      <label>
        <span>End date</span>
        <input v-model="end" name="end" type="date" />
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
      <button @click="load">
        Load
      </button>
      <button @click="sockets">
        Sockets
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

const findingString = ({ started = false, finished = false, length = 0 } = {}) => {
  if (finished) return `found ${countActivities(length)}`;
  if (started && length) return `found ${countActivities(length)} so far`;
  if (started) return 'finding activities';
  return '';
};
const filteringString = ({ started = false, finished = false, length = 0 } = {}) => {
  if (finished) return `filtered to ${countActivities(length)}`;
  if (started && length) return `filtered to ${countActivities(length)} so far`;
  if (started) return 'Filtering activities';
  return '';
};
const mapString = ({ started = false, finished = false } = {}, length = 0) => {
  if (finished) return 'loaded all maps';
  if (started && length) return `loaded ${count(length, 'map')} so far`;
  if (started) return 'loading maps';
  return '';
};

const nonEmpties = (...args) => args.filter(Boolean);
const capitalise = (string) => string.slice(0, 1).toUpperCase() + string.slice(1);

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
        mapsLoaded: 0,
      },
      error: null,
      message: null,
    };
  },
  computed: {
    statusMessage() {
      const statsMessage = () => {
        const { finding = {}, filtering = {}, maps = {} } = this.stats;
        return capitalise(
          nonEmpties(
            findingString(finding),
            filteringString(filtering),
            mapString(maps, this.clientStats.mapsLoaded),
          ).join(', '),
        );
      };
      return this.error || this.message || statsMessage();
    },
  },
  methods: {
    queryString(params) {
      const qs = new URLSearchParams();
      Object.keys(params).forEach((key) => qs.append(key, params[key]));
      return qs.toString();
    },
    setError(message) {
      this.message = null;
      this.error = message;
    },
    setMessage(message) {
      this.message = message;
      this.error = null;
    },
    async load() {
      this.setMessage('Fetching activities');

      const qs = new URLSearchParams();
      const params = { type: this.activityType };
      Object.keys(params).forEach((key) => qs.append(key, params[key]));

      const res = await fetch(`/api/activities?${this.queryString({ type: this.activityType })}`);
      if (!res.ok) {
        this.setError('Server not responding');
        return;
      }
      const activities = await res.json();
      this.$emit('addActivities', activities);
      this.setMessage(null);
    },
    async sockets() {
      this.$emit('clearActivities');

      const socket = new WebSocket(
        `ws://${window.location.host}/api/activities?${this.queryString({
          type: this.activityType,
        })}`,
      );
      let activities = [];
      let errored = false;

      socket.onerror = () => {
        errored = true;
        this.setError('Error fetching activities');
      };
      socket.onopen = () => {
        this.status = { status: 'connected' };
      };
      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'stats') {
          this.stats = data;
          if (data.maps.finished) {
            // all done
          }
        } else if (data.type === 'activities') {
          activities = data.activities;
          this.$emit('addActivities', activities);
        } else if (data.type === 'maps') {
          this.clientStats.mapsLoaded += Object.keys(data.chunk).length;
          this.$emit('addActivityMaps', data.chunk);
        }
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
.grid {
  display: table;

  > * {
    display: table-row;

    > * {
      display: table-cell;
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
