// Canonical Partner-type picklist — the single source of truth for "what kind of
// partner is this?" Partners self-select one of these at signup; the value is
// stored in bd_users.partner_type (plain text, no DB check constraint), so this
// list can grow freely without a migration.
//
// "Partners" = people who refer Recovery Friends into help. Keep this list wide:
// anyone who might send someone toward treatment belongs here. To add a role,
// append an { value, label } to the right group — that's the only change needed.

export type PartnerTypeOption = { value: string; label: string };
export type PartnerTypeGroup = { group: string; options: PartnerTypeOption[] };

export const PARTNER_TYPE_GROUPS: PartnerTypeGroup[] = [
  {
    group: "Hospitals & medical",
    options: [
      { value: "hospital_discharge", label: "Hospital / health system (discharge planning)" },
      { value: "er_social_worker", label: "Emergency dept / ER social worker" },
      { value: "primary_care", label: "General practitioner / primary care" },
      { value: "psychiatrist", label: "Psychiatrist / behavioral health physician" },
      { value: "therapist", label: "Therapist / counselor (LPC, LCSW, etc.)" },
      { value: "nurse_case_manager", label: "Nurse / case manager" },
      { value: "crisis_detox", label: "Crisis / detox / stabilization staff" },
    ],
  },
  {
    group: "Treatment & recovery",
    options: [
      { value: "facility_bd", label: "Treatment facility / business developer" },
      { value: "sober_living", label: "Sober living / recovery residence" },
      { value: "interventionist", label: "Interventionist" },
      { value: "peer_support", label: "Peer support specialist / recovery coach" },
      { value: "harm_reduction", label: "Harm reduction / syringe services" },
    ],
  },
  {
    group: "Legal & justice",
    options: [
      { value: "judge", label: "Judge" },
      { value: "drug_court", label: "Drug / treatment court coordinator" },
      { value: "probation_parole", label: "Probation / parole officer" },
      { value: "attorney", label: "Attorney / public defender" },
      { value: "law_enforcement", label: "Law enforcement / police diversion" },
      { value: "reentry", label: "Jail / prison reentry program" },
    ],
  },
  {
    group: "Faith & community",
    options: [
      { value: "clergy", label: "Church / clergy / faith-based ministry" },
      { value: "nonprofit", label: "Nonprofit / community organization" },
      { value: "municipality", label: "Municipality / local government" },
      { value: "veterans", label: "Veterans / VA services" },
      { value: "homeless_services", label: "Homeless services / shelter" },
    ],
  },
  {
    group: "Workplace & education",
    options: [
      { value: "eap", label: "EAP (employee assistance program)" },
      { value: "employer_hr", label: "Employer / HR" },
      { value: "school", label: "School / university (counselor, dean)" },
      { value: "coach", label: "Wellness / life coach" },
    ],
  },
  {
    group: "Social services & family",
    options: [
      { value: "social_worker", label: "Social worker (general)" },
      { value: "child_welfare", label: "Child welfare / DSS / DCF caseworker" },
      { value: "care_management", label: "Insurance / care management" },
      { value: "family_friend", label: "Family member or friend referring someone" },
      { value: "other", label: "Other" },
    ],
  },
];

// Flat list of every option, in group order.
export const PARTNER_TYPES: PartnerTypeOption[] = PARTNER_TYPE_GROUPS.flatMap((g) => g.options);

const PARTNER_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PARTNER_TYPES.map((o) => [o.value, o.label]),
);

/** True if `value` is a known partner_type. */
export function isPartnerType(value: string | null | undefined): boolean {
  return !!value && value in PARTNER_TYPE_LABELS;
}

/** Human label for a stored partner_type value (falls back to the raw value). */
export function partnerTypeLabel(value: string | null | undefined): string {
  if (!value) return "Partner";
  return PARTNER_TYPE_LABELS[value] ?? value;
}
