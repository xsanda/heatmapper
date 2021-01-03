export default interface Route {
  route: true;
  id: number;
  name: string;
  date: number;
  map: string;
  type: 'Ride' | 'Run';
  subType: 'Road' | 'MountainBike' | 'Cross' | 'Trail' | 'Mixed';
  dateString: string[];
}
