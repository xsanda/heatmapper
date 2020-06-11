<template>
  <div class="sidebar">
    <Form @loaded="loadedActivities" />
    <ul>
      <li
        v-for="activity of activities"
        :key="activity.id"
        :class="[selected === activity.id && 'selected']"
        @click="select(activity.id)"
      >
        {{ activity.name }}
        (<a
          :href="'https://www.strava.com/activities/'+activity.id"
          target="_blank"
        >{{ date(activity.date) }}</a>)
      </li>
    </ul>
  </div>
</template>

<script>
import moment from 'moment';
import Form from './Form.vue';

export default {
  name: 'Sidebar',
  components: { Form },
  props: {
    activities: { type: Array, default: () => [] },
    selected: { type: Number, default: undefined },
  },
  methods: {
    loadedActivities(activities) {
      this.$emit('update:activities', activities);
    },
    date(string) {
      moment.locale(window.navigator.userLanguage || window.navigator.language);
      return moment(string).format('ll');
    },
    select(id) {
      this.$emit('update:selected', id);
    },
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
    flex:1;
    overflow: auto;

    > li {
      cursor: pointer;

      &:hover {
        background: #eee;
      }

      &.selected {
        background: #ccc;
      }
    }
  }
}
</style>
