# Data Model (Postgres)

## Devices
```
devices(
  id uuid pk,
  created_at timestamptz,
  last_seen timestamptz,
  metadata jsonb
)
```

## Sessions
```
sessions(
  id uuid pk,
  device_id uuid fk -> devices.id,
  status text,            -- recording|paused|ended
  started_at timestamptz,
  ended_at timestamptz,
  idle_paused_at timestamptz,
  metadata jsonb          -- env, window/screen, browser version
)
```

## Chunks
```
chunks(
  id uuid pk,
  session_id uuid fk -> sessions.id,
  idx int,
  start_ts timestamptz,
  end_ts timestamptz,
  gcs_uri text,
  status text,            -- uploading|ready|failed
  analysis_status text    -- pending|running|done|failed
)
```

## Events
```
events(
  id uuid pk,
  session_id uuid fk -> sessions.id,
  ts timestamptz,
  type text,              -- interaction|console|network|marker|annotation|env
  payload jsonb
)
```

## Analyses
```
analyses(
  id uuid pk,
  session_id uuid fk -> sessions.id,
  chunk_id uuid fk -> chunks.id,
  status text,            -- pending|running|done|failed
  report jsonb,
  created_at timestamptz
)
```
