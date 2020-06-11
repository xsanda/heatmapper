<template>
  <div class="sidebar">
    <Form
      @addActivities="$emit('addActivities', $event)"
      @addActivityMaps="$emit('addActivityMaps', $event)"
    />
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
  data() {
    return { localSelected: null };
  },
  props: {
    activities: { type: Array, default: () => [] },
    selected: { type: Number, default: undefined },
  },
  methods: {
    date(string) {
      moment.locale(window.navigator.userLanguage || window.navigator.language);
      return moment(string).format('ll');
    },
    select(id) {
      this.localSelected = id;
      this.$emit('update:selected', id);
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
    flex:1;
    overflow: auto;
    margin: 0;
    padding: 1em 0;

    > li {
      cursor: pointer;
      list-style: none;
      padding-left:2em;

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
