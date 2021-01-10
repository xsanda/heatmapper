<template>
  <div class="dropdown">
    <select v-model="model">
      <option v-if="blankLabel" :value="blankValue">
        {{ blankLabel }}
      </option>
      <option v-if="blankLabel" disabled />
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
      <slot />
    </select>
    <Icon v-if="clearButton && model !== blankValue" inline large @click="model = blankValue">
      close
    </Icon>
    <Icon v-else class="down-arrow" inline large> expand_more </Icon>
  </div>
</template>

<script lang="ts">
import { Component, ModelSync, Prop, Vue } from 'vue-property-decorator';

import Icon from './Icon.vue';

@Component({ components: { Icon } })
export default class Dropdown extends Vue {
  @ModelSync('value', 'input') model!: string;

  @Prop({ default: null }) blankValue!: string | null;

  @Prop({ default: null }) blankLabel!: string | null;

  @Prop(Boolean) clearButton!: boolean;

  @Prop({ type: Array, required: true }) options!: {
    value: string;
    label: string;
  }[];

  get selectedLabel(): string {
    return (
      this.options.find((option) => option.value === this.model)?.label ?? this.blankLabel ?? ''
    );
  }
}
</script>

<style lang="scss">
.dropdown {
  display: flex;
  margin: 1ex;

  border-radius: 0.3em;
  border: 1px solid gray;
  background-color: var(--background-slight);

  max-width: min-content;
  min-width: 3em;

  // Hack to prevent zooming on iOS when entering dropdown
  @media (hover: none) {
    font-size: 18px;
  }

  select {
    flex-shrink: 1;
    min-width: 0;
    padding-inline-start: 1ex;
    margin-inline-end: -1.5em;
    padding-inline-end: 1.5em;
    border: none;
    appearance: none;
    background-color: transparent;
    font: inherit;
    color: inherit;
    font-size: 0.9em;
    text-overflow: ellipsis;

    &:focus {
      outline: none;
    }
  }

  .down-arrow {
    pointer-events: none;
  }
}
</style>
