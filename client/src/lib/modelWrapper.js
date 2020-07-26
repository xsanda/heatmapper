import { computed } from 'vue';

export function useModelWrapper(props, emit, name) {
  return computed({
    get: () => props[name],
    set: (value) => emit(`update:${name}`, value),
  });
}

export function useWatchedModelWrapper(props, emit, watch, name, onChange) {
  let cached = props[name];
  const model = computed({
    get: () => props[name],
    set: (value) => {
      cached = value;
      emit(`update:${name}`, value);
    },
  });
  watch(model, (value, oldValue) => {
    if (value !== cached) onChange(value, oldValue, cached);
  });
  return model;
}
