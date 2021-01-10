<template>
  <i class="material-icons" :class="{ inline, large, placeholder, bottom }" v-on="$listeners"
    >{{ generated }}<slot v-if="!generated"
  /></i>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
@Component({
  head: {
    link: [
      {
        href: 'https://fonts.googleapis.com/icon?family=Material+Icons',
        rel: 'stylesheet',
        undo: false,
      },
    ],
  },
})
export default class Icon extends Vue {
  @Prop([Boolean]) inline!: boolean;
  @Prop([Boolean]) large!: boolean;
  @Prop([Boolean]) placeholder!: boolean;
  @Prop([Boolean]) bottom!: boolean;
  get generated(): string {
    if (this.placeholder) return 'crop_square';
    return '';
  }
}
</script>

<style lang="scss">
.material-icons {
  user-select: none;
  width: 1em;
  &.inline {
    vertical-align: middle;
    align-self: center;
    font-size: 1em;
  }
  &.large {
    font-size: 1.5em;
  }
  &.placeholder {
    visibility: hidden;
  }
  &.bottom {
    vertical-align: bottom;
  }
}
</style>
