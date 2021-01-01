export interface ActivityMap {
  id: number;
  map: string;
}

export default interface Activity extends ActivityMap {
  name: string;
  date: string;
  type: string;
  dateString: string[];
}
