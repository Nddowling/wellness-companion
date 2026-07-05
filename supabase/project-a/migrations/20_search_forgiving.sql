-- Forgiving free-text directory search. The old q logic required EVERY typed word
-- to be a substring of name+city+state+levels+specialties+populations, so natural
-- phrases ("detox that takes medicaid") and insurance terms ("medicaid") returned
-- zero. Now: strip filler/stopwords, and search payers + carriers too. Remaining
-- meaningful tokens must all appear (stays precise). Applied to prod 2026-07-05.

create or replace function public.facility_matches_q(p_facility_id uuid, p_q text)
returns boolean language sql stable as $function$
  select coalesce(bool_and(corpus like '%' || tok || '%'), true)
  from (
    select lower(
      f.name || ' ' || coalesce(f.city,'') || ' ' || coalesce(f.state,'') || ' ' ||
      array_to_string(f.levels_of_care, ' ') || ' ' ||
      array_to_string(coalesce(f.specialties, '{}'::text[]), ' ') || ' ' ||
      array_to_string(coalesce(f.populations_served, '{}'::text[]), ' ') || ' ' ||
      array_to_string(coalesce(f.carriers_named, '{}'::text[]), ' ') || ' ' ||
      coalesce((select string_agg(fp.payer_type, ' ') from facility_payers fp where fp.facility_id = f.id), '')
    ) as corpus
    from facilities f where f.id = p_facility_id
  ) c
  cross join unnest(string_to_array(lower(trim(p_q)), ' ')) as tok
  where length(tok) > 2
    and tok <> all(array[
      'the','and','that','this','these','those','for','with','who','you','your','are','was','has','have','had',
      'need','needs','want','wants','looking','look','help','please','can','get','from','not','but','all','any',
      'near','around','close','their','they','offer','offers','accept','accepts','take','takes','taking','someone',
      'somebody','person','people','treatment','treatments','rehab','rehabs','center','centers','centre','program',
      'programs','facility','facilities','place','places','care','friendly','options','option','best','good','find'
    ]);
$function$;

-- Re-point the three directory RPCs at the forgiving matcher. Bodies are otherwise
-- unchanged from 17/19; only the p_q predicate now calls facility_matches_q.
-- (Full CREATE OR REPLACE bodies were applied via MCP migration
-- "use_forgiving_q_in_search_rpcs" on 2026-07-05 — facilities_search,
-- facilities_search_count, and facilities_facet_counts each swap their inline
-- bool_and(...) q block for:  and (p_q is null or public.facility_matches_q(f.id, p_q))
-- See migrations 17 and 19 for the surrounding function bodies.)
