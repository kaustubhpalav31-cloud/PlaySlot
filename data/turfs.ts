export type Turf = {
  id: number;
  name: string;
  sport: string;
  location: string;
  priceInr: number;
  demoEth: string;
  accent: string;
  amenities: string[];
  tagline: string;
};

export const turfs: Turf[] = [
  {
    id: 1,
    name: "Neon Arena",
    sport: "Football • Box Cricket",
    location: "Central Mumbai",
    priceInr: 1200,
    demoEth: "0.001",
    accent: "violet",
    amenities: ["Floodlights", "Changing room", "Parking", "Drinking water"],
    tagline: "Late-night games, loud energy, zero boring.",
  },
  {
    id: 2,
    name: "SkyCourt",
    sport: "Football • Pickleball",
    location: "Eastern Mumbai",
    priceInr: 1450,
    demoEth: "0.0012",
    accent: "cyan",
    amenities: ["Rooftop", "Floodlights", "Locker room", "Cafe nearby"],
    tagline: "Open-sky sessions with a city-view backdrop.",
  },
  {
    id: 3,
    name: "StreetBox",
    sport: "Box Cricket • Football",
    location: "Western Mumbai",
    priceInr: 950,
    demoEth: "0.0008",
    accent: "lime",
    amenities: ["Cricket nets", "Football goals", "First-aid", "Seating"],
    tagline: "Fast games, student-friendly pricing, street vibe.",
  },
];

export const timeSlots = [
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
];
