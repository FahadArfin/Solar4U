alter table scraper_source_settings
  add column if not exists integration_kind text,
  add column if not exists authorized_source_url text,
  add column if not exists authorization_reference text;

alter table scraper_source_settings
  drop constraint if exists scraper_source_settings_policy_override_check;

alter table scraper_source_settings
  add constraint scraper_source_settings_policy_override_check
  check (policy_override in ('follow_policy', 'authorized_integration', 'disabled'));
