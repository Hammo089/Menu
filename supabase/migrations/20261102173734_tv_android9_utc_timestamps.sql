-- Android 8/9 uses the Java 8 ISO_INSTANT parser, which requires a literal Z.
-- Keep timestamps as timestamptz in storage; serialize device-wire dates as UTC Z.
-- Preserve the existing function's authorization, search_path and grants.
do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef('blanco_private.tv_api(text,jsonb)'::regprocedure);
  if strpos(definition, '''serverNow'',now()') = 0
     or strpos(definition, '''expiresAt'',c.expires_at') = 0
     or strpos(definition, '''expiresAt'',d.pair_expires_at') = 0 then
    raise exception 'Unexpected TV API definition; timestamp compatibility patch not applied.';
  end if;
  definition := replace(definition,
    '''serverNow'',now()',
    $patch$'serverNow',pg_catalog.to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')$patch$);
  definition := replace(definition,
    '''expiresAt'',c.expires_at',
    $patch$'expiresAt',pg_catalog.to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')$patch$);
  definition := replace(definition,
    '''expiresAt'',d.pair_expires_at',
    $patch$'expiresAt',pg_catalog.to_char(d.pair_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')$patch$);
  execute definition;
end
$migration$;
