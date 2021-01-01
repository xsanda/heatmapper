import Activity from './Activity';
import Route from './Route';

interface ActivitiesMessage {
  type: 'activities';
  activities: Activity[];
}
interface RoutesMessage {
  type: 'routes';
  routes: Route[];
}
interface MapsMessage {
  type: 'maps';
  chunk: Record<string, string>;
}

export interface StatsMessage {
  type: 'stats';
  finding: { started: boolean; finished: boolean; length: number };
}

type ResponseMessage =
  | ActivitiesMessage
  | MapsMessage
  | StatsMessage
  | RoutesMessage;

export default ResponseMessage;
