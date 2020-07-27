import Activity from './Activity';

interface ActivitiesMessage {
  type: 'activities';
  activities: Activity[];
}
interface MapsMessage {
  type: 'maps';
  chunk: Record<string, string>;
}

export interface StatsMessage {
  type: 'stats';
  finding: { started: boolean; finished: boolean; length: number };
}

type ResponseMessage = ActivitiesMessage | MapsMessage | StatsMessage;

export default ResponseMessage;
