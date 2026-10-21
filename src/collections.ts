export interface CPlace {
  name: string; lat: number; lon: number; zoom: number; note?: string;
  /** Before/after dates (YYYY-MM-DD, or "latest") for a swipe comparison. */
  before?: string; after?: string;
}
export interface Collection { id: string; emoji: string; title: string; blurb: string; places: CPlace[] }

const GENERAL: Collection[] = [
  { id: "landmarks", emoji: "🗽", title: "Famous landmarks", blurb: "Icons you can recognise from above (best with Esri).", places: [
    { name: "Empire State Building", lat: 40.7484, lon: -73.9857, zoom: 18 },
    { name: "Giza pyramids", lat: 29.9792, lon: 31.1342, zoom: 17 },
    { name: "Statue of Liberty", lat: 40.6892, lon: -74.0445, zoom: 18 },
    { name: "Eiffel Tower", lat: 48.8584, lon: 2.2945, zoom: 18 },
    { name: "Taj Mahal", lat: 27.1751, lon: 78.0421, zoom: 17 },
    { name: "Sydney Opera House", lat: -33.8568, lon: 151.2153, zoom: 18 },
    { name: "Burj Khalifa", lat: 25.1972, lon: 55.2744, zoom: 17 },
    { name: "Colosseum", lat: 41.8902, lon: 12.4922, zoom: 17 },
    { name: "Big Ben & Parliament", lat: 51.5007, lon: -0.1246, zoom: 18 },
    { name: "Golden Gate Bridge", lat: 37.8199, lon: -122.4783, zoom: 17 },
  ]},
  { id: "wildlife", emoji: "🦁", title: "Wildlife & safaris", blurb: "Parks and plains where animals gather.", places: [
    { name: "Nairobi National Park", lat: -1.3733, lon: 36.8586, zoom: 11 },
    { name: "Maasai Mara", lat: -1.4061, lon: 35.0078, zoom: 10 },
    { name: "Serengeti", lat: -2.3333, lon: 34.8333, zoom: 9 },
    { name: "Ngorongoro Crater", lat: -3.1667, lon: 35.5833, zoom: 11 },
    { name: "Etosha Pan", lat: -18.8556, lon: 16.33, zoom: 9 },
    { name: "Okavango Delta", lat: -19.2833, lon: 22.9, zoom: 9 },
    { name: "Chobe River", lat: -17.8, lon: 25.15, zoom: 10 },
    { name: "Kruger National Park", lat: -23.9884, lon: 31.5547, zoom: 9 },
    { name: "Yellowstone", lat: 44.428, lon: -110.5885, zoom: 9 },
  ]},
  { id: "volcano", emoji: "🌋", title: "Volcanoes", blurb: "Craters, lava fields and ash plains.", places: [
    { name: "Mount Fuji", lat: 35.3606, lon: 138.7274, zoom: 11 },
    { name: "Mount Etna", lat: 37.751, lon: 14.9934, zoom: 11 },
    { name: "Kīlauea", lat: 19.4069, lon: -155.2834, zoom: 12 },
    { name: "Mount Vesuvius", lat: 40.8224, lon: 14.4289, zoom: 13 },
    { name: "Mount St. Helens", lat: 46.1912, lon: -122.1944, zoom: 12 },
    { name: "Mount Bromo", lat: -7.9425, lon: 112.953, zoom: 13 },
    { name: "Popocatépetl", lat: 19.0225, lon: -98.6278, zoom: 12 },
    { name: "Eyjafjallajökull", lat: 63.6314, lon: -19.6083, zoom: 11 },
  ]},
  { id: "desert", emoji: "🏜️", title: "Deserts & salt flats", blurb: "Dunes, craters and mirror-flat plains.", places: [
    { name: "Eye of the Sahara (Richat)", lat: 21.124, lon: -11.4013, zoom: 10 },
    { name: "Sossusvlei dunes", lat: -24.7275, lon: 15.29, zoom: 12 },
    { name: "Salar de Uyuni", lat: -20.1338, lon: -67.4891, zoom: 9 },
    { name: "Wadi Rum", lat: 29.576, lon: 35.42, zoom: 11 },
    { name: "Danakil Depression", lat: 14.2417, lon: 40.3, zoom: 10 },
    { name: "Death Valley", lat: 36.5054, lon: -117.0794, zoom: 10 },
    { name: "Badain Jaran dunes", lat: 39.75, lon: 102.4, zoom: 9 },
  ]},
  { id: "water", emoji: "🌊", title: "Lakes, falls & reefs", blurb: "Water in every colour.", places: [
    { name: "Lake Natron", lat: -2.4167, lon: 36.0, zoom: 10 },
    { name: "Victoria Falls", lat: -17.9243, lon: 25.8572, zoom: 13 },
    { name: "Dead Sea", lat: 31.559, lon: 35.4732, zoom: 10 },
    { name: "Lake Titicaca", lat: -15.9254, lon: -69.3354, zoom: 8 },
    { name: "Bora Bora", lat: -16.5004, lon: -151.7415, zoom: 12 },
    { name: "Heron Island reef", lat: -23.4423, lon: 151.9148, zoom: 11 },
    { name: "Ha Long Bay", lat: 20.9101, lon: 107.1839, zoom: 11 },
    { name: "Maldives (Malé atoll)", lat: 4.1755, lon: 73.5093, zoom: 10 },
  ]},
  { id: "cities", emoji: "🏙️", title: "Big cities", blurb: "Megacities from above.", places: [
    { name: "Tokyo", lat: 35.6762, lon: 139.6503, zoom: 10 },
    { name: "New York", lat: 40.7128, lon: -74.006, zoom: 11 },
    { name: "Dubai", lat: 25.2048, lon: 55.2708, zoom: 10 },
    { name: "Singapore", lat: 1.3521, lon: 103.8198, zoom: 11 },
    { name: "London", lat: 51.5074, lon: -0.1278, zoom: 11 },
    { name: "Lagos", lat: 6.5244, lon: 3.3792, zoom: 10 },
    { name: "Mumbai", lat: 19.076, lon: 72.8777, zoom: 11 },
    { name: "São Paulo", lat: -23.5505, lon: -46.6333, zoom: 10 },
    { name: "Cairo", lat: 30.0444, lon: 31.2357, zoom: 11 },
  ]},
  { id: "ancient", emoji: "🏛️", title: "Ancient world", blurb: "Pyramids, temples and lost cities.", places: [
    { name: "Giza pyramids", lat: 29.9792, lon: 31.1342, zoom: 15 },
    { name: "Petra", lat: 30.3285, lon: 35.4444, zoom: 15 },
    { name: "Machu Picchu", lat: -13.1631, lon: -72.545, zoom: 15 },
    { name: "Angkor Wat", lat: 13.4125, lon: 103.867, zoom: 15 },
    { name: "Stonehenge", lat: 51.1789, lon: -1.8262, zoom: 17 },
    { name: "Chichén Itzá", lat: 20.6843, lon: -88.5678, zoom: 16 },
    { name: "Teotihuacan", lat: 19.6925, lon: -98.8438, zoom: 15 },
    { name: "Colosseum", lat: 41.8902, lon: 12.4922, zoom: 17 },
  ]},
  { id: "mega", emoji: "🏗️", title: "Megaprojects", blurb: "Dams, canals, artificial islands.", places: [
    { name: "Palm Jumeirah", lat: 25.1124, lon: 55.139, zoom: 13 },
    { name: "Three Gorges Dam", lat: 30.8231, lon: 111.0037, zoom: 13 },
    { name: "Panama Canal locks", lat: 9.2650, lon: -79.92, zoom: 13 },
    { name: "Hoover Dam", lat: 36.016, lon: -114.7377, zoom: 14 },
    { name: "Hong Kong airport island", lat: 22.308, lon: 113.9185, zoom: 13 },
    { name: "Kansai airport", lat: 34.432, lon: 135.2304, zoom: 13 },
    { name: "Port of Rotterdam", lat: 51.95, lon: 4.14, zoom: 11 },
    { name: "Burj Khalifa", lat: 25.1972, lon: 55.2744, zoom: 17 },
  ]},
  { id: "change", emoji: "🌍", title: "Our changing planet", blurb: "Places that look different year to year.", places: [
    { name: "Aral Sea", lat: 45.0, lon: 59.5, zoom: 7, note: "Shrunk dramatically since the 1960s" },
    { name: "Lake Mead", lat: 36.1, lon: -114.4, zoom: 9, note: "Water level swings" },
    { name: "Rondônia deforestation", lat: -10.8, lon: -62.8, zoom: 8 },
    { name: "Lake Chad", lat: 13.0, lon: 14.0, zoom: 7 },
    { name: "Kilimanjaro summit", lat: -3.0758, lon: 37.3533, zoom: 12, note: "Shrinking ice cap" },
    { name: "Athabasca oil sands", lat: 57.0, lon: -111.5, zoom: 9 },
    { name: "Almería greenhouses", lat: 36.78, lon: -2.75, zoom: 11, note: "A sea of plastic" },
  ]},
  { id: "air", emoji: "✈️", title: "Airports & ports", blurb: "Runways, terminals and container yards.", places: [
    { name: "London Heathrow", lat: 51.47, lon: -0.4543, zoom: 13 },
    { name: "Singapore Changi", lat: 1.3644, lon: 103.9915, zoom: 13 },
    { name: "Dubai International", lat: 25.2532, lon: 55.3657, zoom: 13 },
    { name: "Atlanta Hartsfield", lat: 33.6407, lon: -84.4277, zoom: 13 },
    { name: "Yangshan Port, Shanghai", lat: 30.62, lon: 122.07, zoom: 12 },
  ]},
  { id: "farms", emoji: "🌾", title: "Farms & green patterns", blurb: "Fields, terraces and circles.", places: [
    { name: "Kansas irrigation circles", lat: 37.9, lon: -100.8, zoom: 11 },
    { name: "Yuanyang rice terraces", lat: 23.1, lon: 102.75, zoom: 12 },
    { name: "Nile Delta", lat: 31.0, lon: 31.0, zoom: 8 },
    { name: "Keukenhof tulip fields", lat: 52.2697, lon: 4.5463, zoom: 14 },
    { name: "Tuscany hills", lat: 43.4, lon: 11.2, zoom: 11 },
  ]},
];

const WAR_BLURB = "Public satellite imagery of conflict-affected areas.";
const GAZA0 = "2023-09-25";

export const CONFLICTS: Collection[] = [
  { id: "ukraine", emoji: "🇺🇦", title: "Ukraine war — before & after", blurb: `${WAR_BLURB} Tap ⇄ places to swipe between dates.`, places: [
    { name: "Mariupol", lat: 47.0971, lon: 37.5434, zoom: 12, before: "2022-02-10", after: "2022-06-05", note: "Besieged spring 2022" },
    { name: "Bakhmut", lat: 48.5956, lon: 38.0017, zoom: 13, before: "2022-07-20", after: "2023-06-15", note: "Battle Aug 2022 – May 2023" },
    { name: "Avdiivka", lat: 48.1394, lon: 37.7497, zoom: 13, before: "2023-08-15", after: "2024-04-15", note: "Fighting through Feb 2024" },
    { name: "Chasiv Yar", lat: 48.5947, lon: 37.8344, zoom: 13, before: "2023-08-15", after: "2024-09-15", note: "Heavy fighting 2024" },
    { name: "Pokrovsk", lat: 48.2822, lon: 37.1759, zoom: 12, before: "2023-08-15", after: "latest", note: "Front-line city 2024–25" },
    { name: "Nova Kakhovka dam", lat: 46.7783, lon: 33.3697, zoom: 12, before: "2023-05-25", after: "2023-06-20", note: "Dam destroyed 6 June 2023" },
    { name: "Kerch Strait Bridge", lat: 45.3086, lon: 36.5122, zoom: 13, before: "2022-09-25", after: "2022-10-20", note: "Bridge damaged Oct 2022" },
    { name: "Kharkiv", lat: 49.9935, lon: 36.2304, zoom: 11, before: "2022-01-20", after: "latest" },
  ]},
  { id: "gaza", emoji: "🕊️", title: "Gaza — before & after", blurb: `${WAR_BLURB} Compared with September 2023.`, places: [
    { name: "Gaza City", lat: 31.5017, lon: 34.4668, zoom: 12, before: GAZA0, after: "latest" },
    { name: "Jabalia", lat: 31.5272, lon: 34.4833, zoom: 13, before: GAZA0, after: "latest" },
    { name: "Beit Hanoun", lat: 31.5361, lon: 34.5392, zoom: 13, before: GAZA0, after: "latest" },
    { name: "Khan Younis", lat: 31.3462, lon: 34.303, zoom: 12, before: GAZA0, after: "latest" },
    { name: "Rafah", lat: 31.2969, lon: 34.2436, zoom: 12, before: GAZA0, after: "latest" },
    { name: "Gaza Strip overview", lat: 31.4, lon: 34.38, zoom: 10, before: GAZA0, after: "latest" },
  ]},
  { id: "iran", emoji: "🛰️", title: "Iran & Israel — June 2025", blurb: `${WAR_BLURB} Sites in public reports of the June 2025 strikes.`, places: [
    { name: "Fordow", lat: 34.8842, lon: 50.9959, zoom: 14, before: "2025-06-01", after: "2025-07-01", note: "Reported struck June 2025" },
    { name: "Natanz", lat: 33.7243, lon: 51.727, zoom: 14, before: "2025-06-01", after: "2025-07-01", note: "Reported struck June 2025" },
    { name: "Shahid Rajaee Port, Bandar Abbas", lat: 27.105, lon: 56.07, zoom: 14, before: "2025-04-15", after: "2025-05-12", note: "Explosion April 2025" },
  ]},
  { id: "mideast", emoji: "🌐", title: "Middle East conflicts", blurb: `${WAR_BLURB} Lebanon, Yemen and past battles.`, places: [
    { name: "Beirut southern suburbs", lat: 33.853, lon: 35.518, zoom: 13, before: "2024-08-01", after: "2024-12-15", note: "Strikes autumn 2024" },
    { name: "Khiam, southern Lebanon", lat: 33.3194, lon: 35.6122, zoom: 13, before: "2024-08-01", after: "2025-01-15" },
    { name: "Hodeidah port, Yemen", lat: 14.82, lon: 42.93, zoom: 13, before: "2024-07-10", after: "2024-08-05", note: "Port struck July 2024" },
    { name: "Mosul Old City, Iraq", lat: 36.343, lon: 43.13, zoom: 14, before: "2016-09-15", after: "2018-01-15", note: "Battle Oct 2016 – Jul 2017" },
    { name: "Raqqa, Syria", lat: 35.9528, lon: 39.0079, zoom: 13, before: "2017-04-15", after: "2018-03-15", note: "Battle 2017" },
  ]},
  { id: "africa", emoji: "🌍", title: "African conflicts", blurb: `${WAR_BLURB} Sudan, DR Congo, Ethiopia.`, places: [
    { name: "El Fasher, Sudan", lat: 13.6289, lon: 25.3493, zoom: 12, before: "2023-03-15", after: "latest" },
    { name: "Khartoum airport, Sudan", lat: 15.5895, lon: 32.5532, zoom: 13, before: "2023-03-20", after: "latest", note: "Fighting from April 2023" },
    { name: "Omdurman, Sudan", lat: 15.6445, lon: 32.4777, zoom: 12, before: "2023-03-20", after: "latest" },
    { name: "Goma, DR Congo", lat: -1.6792, lon: 29.2228, zoom: 12, before: "2024-12-15", after: "2025-02-15", note: "Fighting Jan 2025" },
    { name: "Mekelle, Ethiopia", lat: 13.4967, lon: 39.4753, zoom: 12, before: "2020-09-15", after: "2021-07-15", note: "Tigray war 2020–22" },
  ]},
  { id: "battlefields", emoji: "⚔️", title: "Historic battlefields", blurb: "Where history was decided, as it looks now.", places: [
    { name: "Omaha Beach, Normandy", lat: 49.3697, lon: -0.8686, zoom: 14, note: "D-Day, 1944" },
    { name: "Verdun", lat: 49.206, lon: 5.43, zoom: 12, note: "Shell-cratered forest, 1916" },
    { name: "Pearl Harbor", lat: 21.3649, lon: -157.95, zoom: 13 },
    { name: "Hiroshima", lat: 34.3955, lon: 132.4536, zoom: 13 },
    { name: "Mamayev Kurgan, Volgograd", lat: 48.7424, lon: 44.537, zoom: 14, note: "Stalingrad, 1942–43" },
    { name: "Waterloo", lat: 50.68, lon: 4.412, zoom: 14 },
    { name: "Gettysburg", lat: 39.8115, lon: -77.225, zoom: 13 },
    { name: "Iwo Jima", lat: 24.787, lon: 141.322, zoom: 13 },
    { name: "Dien Bien Phu", lat: 21.386, lon: 103.016, zoom: 13 },
  ]},
];

export const COLLECTIONS: Collection[] = [...CONFLICTS, ...GENERAL];
