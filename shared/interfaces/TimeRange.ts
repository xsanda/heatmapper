interface TimeRange {
  start?: number;
  end?: number;
}

function sort(ranges: TimeRange[]): TimeRange[] {
  return ranges
    .slice()
    .sort((a, b) => (a.start ?? -Infinity) - (b.start ?? +Infinity));
}
function* pairs(ranges: TimeRange[]): Generator<[TimeRange?, TimeRange?]> {
  for (let i = 0; i <= ranges.length; i++) {
    yield [ranges[i - 1], ranges[i]];
  }
}

namespace TimeRange {
  export function merge(ranges: TimeRange[]): TimeRange[] {
    const merged: TimeRange[] = [];
    let previous: TimeRange | undefined = undefined;

    for (const range of sort(ranges)) {
      if (previous === undefined) previous = { ...range };
      else if (previous.end === undefined) break;
      else if (range.start !== undefined && previous.end < range.start) {
        merged.push(previous);
        previous = { ...range };
      } else if (range.end === undefined || previous.end < range.end) {
        previous.end = range.end;
      }
    }
    if (previous !== undefined) merged.push(previous);
    return merged;
  }

  export function invert(ranges: TimeRange[]): TimeRange[] {
    const merged: TimeRange[] = [];
    for (const [pre, post] of pairs(merge(ranges))) {
      if (pre && pre.end === undefined) continue;
      if (post && post.start === undefined) continue;
      merged.push({ start: pre?.end, end: post?.start });
    }
    return merged;
  }

  export function cap(
    ranges: TimeRange[],
    start: number = 0,
    end?: number
  ): TimeRange[] {
    return invert(
      invert(ranges).concat([{ end: start }, { start: end ?? Date.now() }])
    );
  }
}

export default TimeRange;
