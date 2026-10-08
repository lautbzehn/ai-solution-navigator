import type { Person } from '@/domain/types'

/** Fictional demo cast (The Office). */
export const PEOPLE: Person[] = [
  { id: 'p_michael', name: 'Michael Scott', title: 'Regional Manager', department: 'Executive', hue: 222 },
  { id: 'p_jim', name: 'Jim Halpert', title: 'Lead Product Manager', department: 'Product', hue: 252 },
  { id: 'p_pam', name: 'Pam Beesly', title: 'UX Research Lead', department: 'Design', hue: 330 },
  { id: 'p_dwight', name: 'Dwight Schrute', title: 'Security & Risk Lead', department: 'Security', hue: 38 },
  { id: 'p_angela', name: 'Angela Martin', title: 'Senior Accountant', department: 'Finance', hue: 300 },
  { id: 'p_oscar', name: 'Oscar Martinez', title: 'Data & Analytics Lead', department: 'Data', hue: 168 },
  { id: 'p_stanley', name: 'Stanley Hudson', title: 'Senior Sales Representative', department: 'Sales', hue: 18 },
  { id: 'p_kelly', name: 'Kelly Kapoor', title: 'Change Management Lead', department: 'Customer Experience', hue: 350 },
  { id: 'p_ryan', name: 'Ryan Howard', title: 'Engineering Lead', department: 'Engineering', hue: 200 },
  { id: 'p_darryl', name: 'Darryl Philbin', title: 'Operations Manager', department: 'Operations', hue: 142 },
  { id: 'p_creed', name: 'Creed Bratton', title: 'Quality Assurance (allegedly)', department: 'Other / Unknown', hue: 60 },
  { id: 'p_toby', name: 'Toby Flenderson', title: 'Compliance & Governance', department: 'Governance', hue: 90 },
  { id: 'p_gabe', name: 'Gabe Lewis', title: 'AI Solution Architect', department: 'Architecture', hue: 270 },
  { id: 'p_jan', name: 'Jan Levinson', title: 'Privacy & Legal Counsel', department: 'Legal', hue: 0 },
  { id: 'p_erin', name: 'Erin Hannon', title: 'Customer Support Lead', department: 'Customer Support', hue: 48 },
  { id: 'p_holly', name: 'Holly Flax', title: 'QA & Evaluation Lead', department: 'Quality', hue: 185 },
  { id: 'p_andy', name: 'Andy Bernard', title: 'Regional Director of Sales', department: 'Sales', hue: 120 },
  { id: 'p_phyllis', name: 'Phyllis Vance', title: 'Sales Operations', department: 'Sales', hue: 280 },
  { id: 'p_kevin', name: 'Kevin Malone', title: 'Accounts Payable', department: 'Finance', hue: 30 },
]

/** The signed-in demo user. */
export const CURRENT_USER_ID = 'p_jim'
