export default interface Route {
  id: number;
  name: string;
  date: string;
  map: string;
  type: 'Ride' | 'Run';
  subType: 'Road' | 'MountainBike' | 'Cross' | 'Trail' | 'Mixed';
  dateString: string[];
}
