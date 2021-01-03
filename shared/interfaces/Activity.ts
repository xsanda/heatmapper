export interface ActivityMap {
  id: number;
  map: string;
}

export default interface Activity extends ActivityMap {
  name: string;
  date: number;
  type: string;
  dateString: string[];
}
