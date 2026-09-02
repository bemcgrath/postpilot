export const SURVEY_REASON_IDS = [
  "not_sure_what_id_get",
  "too_expensive",
  "not_used_enough",
  "just_browsing",
  "other",
] as const
export type SurveyReasonId = (typeof SURVEY_REASON_IDS)[number]
