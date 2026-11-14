import { hash01 } from './rng.ts';
const FIRST = ['Daniel','Priya','Marcus','Ingrid','Tomasz','Amara','Hiro','Lucía','Oluwaseun','Brigitte','Rafael','Mei','Cormac','Zainab','Ibrahim','Noor','Pavel','Camille','Dmitri','Sunita','Kofi','Elena','Jun','Fatima','Mateo','Greta','Anselm','Yara','Linus','Odette','Ravi','Sofia','Théo','Wanjiru','Bartek','Imogen','Santiago','Leila','Gustav','Nia','Emeka','Astrid','Carlos','Hannah','Jamal','Petra','Viktor','Aiko','Rosalind','Dev'];
const LAST = ['Okafor-Reyes','Lindqvist','Castellano','Nakamura','Whitcombe','Adeyemi','Kowalczyk','Fernández','Bhattacharya','Haddad','Moreau','Oyelaran','Petrov','Sandoval','Tanaka','Yilmaz','Brennan','Duarte','Eriksson','Gallagher','Hoffmann','Iyer','Jovanović','Kaplan','Lombardi','Mbeki','Nwosu','Ortega','Pemberley','Quinn','Rasmussen','Silva','Thackeray','Underhill','Vasquez','Wójcik','Xu','Yamada','Zielinski','Abernathy','Baptiste','Chaudhry','Dubois','Endicott','Fitzgerald','Grünwald','Hargreaves','Ibarra','Jankowski','Kimura'];
export const ROLES: string[][] = [
  ['Senior Builder','Platform Wrangler','Staff Plumber (Software)','Release Whisperer','Backlog Gardener'],
  ['Relationship Owner','Regional Synergy Coordinator','Pipeline Evangelist','Key Account Hugger','Deal Choreographer'],
  ['Care Partner','Empathy Operations Lead','Escalation Listener','Queue Shepherd','Apology Specialist'],
  ['Facilities Concierge','Workplace Experience Lead','Desk Allocation Analyst','Logistics Optimist','Supply Closet Steward'],
  ['People Partner','Culture Architect','Belonging Programme Lead','Onboarding Storyteller','Wellness Convener'],
  ['Compliance Counsel','Contracts Analyst','Policy Librarian','Risk Reader','Fine-Print Author'],
  ['Controller','Accounts Payable Lead','Reconciliation Analyst','Budget Archaeologist','Forecast Curator'],
  ['Alignment Manager','Director of Cadence','Head of Sync','Programme Convener','Stakeholder Navigator'],
  ['Innovation Fellow','Futures Explorer','Ideation Facilitator','Head of Wonder','Prototype Sommelier'],
];
const QUIRKS = [
  'Left behind a desk plant named Kevin.','Their out-of-office was, for once, accurate.','Their last commit message was just "thanks, all".','Took the good stapler. Nobody objected.','Organised the last three team lunches.','Knew where the spare keys were. Nobody does now.','Mentored four people, one of whom is still here.','Their coffee mug will be returned by post.','Once fixed the printer by being kind to it.','Leaves behind a spotless shared drive.','Remembered everyone\'s birthday. This will not be automated.','Brought the cake to every farewell, including this one.','Wrote the only documentation that was ever read.','Cycled in daily, through all weather.','Could explain the old pricing sheet. Now no one can.','Taught the new hires where lunch is.','Leaves a handwritten note in the supply closet.','Always replied-all politely.','Raised a concern in March. It is still in the queue.','Is already getting messages from recruiters.'];
export const ROLE_COUNT = 5;
export function nameOf(seed: number, i: number): string {
  return FIRST[Math.floor(hash01(seed, i * 3 + 1) * FIRST.length)] + ' ' + LAST[Math.floor(hash01(seed, i * 3 + 2) * LAST.length)];
}
export function roleOf(seed: number, i: number, dept: number): string {
  return ROLES[dept][Math.floor(hash01(seed, i * 5 + 3) * ROLE_COUNT)];
}
export function tenureOf(seed: number, i: number): number {
  return 1 + Math.floor(hash01(seed, i * 7 + 5) ** 1.5 * 19);
}
export function quirkIndex(seed: number, i: number): number {
  return Math.floor(hash01(seed, i * 11 + 9) * QUIRKS.length);
}
export function quirkOf(seed: number, i: number): string { return QUIRKS[quirkIndex(seed, i)]; }

const TNAME_A = ['Brightline','Hartwell','Pelican','Granite','Oakhaven','Meridian','Lumen','Caldwell','Farrow','Tidewater','Ashgrove','Penrose','Halcyon','Redwood','Northgate','Kestrel','Marlow','Sable','Ironbridge','Fenwick','Corbel','Larkspur','Winterbourne','Quillon','Dunmore'];
const TNAME_B = ['Logistics','Greeting Cards','Compliance Solutions','Payments','Textiles','Analytics','Staffing','Facilities Group','Freight','Insurance Brokers','Print & Packaging','Mutual','Hospitality','Software','Learning','Foods','Marine Supply','Data Services','Outsourcing','Holdings','Dental Partners','Furniture','Waste Management','Media','Agri-Tech'];
export function targetName(r1: number, r2: number): string {
  return TNAME_A[Math.floor(r1 * TNAME_A.length)] + ' ' + TNAME_B[Math.floor(r2 * TNAME_B.length)];
}
