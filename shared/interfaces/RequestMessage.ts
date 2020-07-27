import TimeRange from './TimeRange';

export default interface RequestMessage {
  load?: TimeRange[];
  maps?: number[];
}
