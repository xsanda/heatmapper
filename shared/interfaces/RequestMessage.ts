import TimeRange from './TimeRange';

export default interface RequestMessage {
  activities?: TimeRange[];
  routes?: true;
  maps?: string[];
}
