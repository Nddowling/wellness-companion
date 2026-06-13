-- ClearBedRecovery import verification

select
  count(*) as total_facilities,
  count(*) filter (where samhsa_imported_at is not null) as imported_rows,
  count(*) filter (where samhsa_source_unique_key is not null) as rows_with_samhsa_key,
  count(*) filter (where samhsa_raw is not null) as rows_with_raw_excel_json,
  count(*) filter (where website is not null and website <> '') as rows_with_website,
  count(*) filter (where cardinality(carriers_named) > 0) as rows_with_named_carriers,
  count(*) filter (where samhsa_accepts_private_insurance = 'Yes') as rows_accepting_private_insurance_category
from public.facilities;

-- Recent sample rows touched by import
select
  name,
  city,
  state,
  samhsa_source_unique_key,
  samhsa_imported_at,
  left(coalesce(payers_detail, ''), 120) as payer_detail_preview,
  cardinality(carriers_named) as named_carrier_count
from public.facilities
where samhsa_imported_at is not null
order by samhsa_imported_at desc
limit 20;
