# m8m data dictionary

Generated from SQLite schema metadata; no row contents or secret values are included.

Times are Unix milliseconds unless noted. IDs are opaque strings. JSON columns store structured application data. owner_id scopes records to users; child records inherit ownership through their parent workflow/agent. Credential encrypted and users.gemini_key are AES-GCM ciphertext. Passwords are scrypt hashes; sessions/API keys store hashes. Back up APP_SECRET separately from the database.

## agent_versions

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| agent_id | TEXT | NOT NULL |  |
| version | INTEGER | NOT NULL |  |
| snapshot | TEXT | NOT NULL |  |
| created_at | INTEGER | NOT NULL |  |

Foreign key: agent_id → agents.id; delete: CASCADE.

## agents

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| name | TEXT | NOT NULL |  |
| description | TEXT | NOT NULL | '' |
| status | TEXT | NOT NULL | 'draft' |
| schema_version | INTEGER | NOT NULL | 1 |
| config | TEXT | NOT NULL | '{}' |
| custom_tool | TEXT | nullable |  |
| external_apis | TEXT | NOT NULL | '[]' |
| api_key_hash | TEXT | nullable |  |
| runs_count | INTEGER | NOT NULL | 0 |
| created_at | INTEGER | NOT NULL |  |
| updated_at | INTEGER | NOT NULL |  |
| owner_id | TEXT | NOT NULL | 'legacy' |

## app_migrations

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| version | INTEGER | PK |  |

## auth_limits

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| key | TEXT | PK |  |
| count | INTEGER | NOT NULL |  |
| reset_at | INTEGER | NOT NULL |  |

## resources

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| agent_id | TEXT | NOT NULL |  |
| name | TEXT | NOT NULL |  |
| mime_type | TEXT | NOT NULL |  |
| size | INTEGER | NOT NULL |  |
| content | TEXT | NOT NULL |  |
| created_at | INTEGER | NOT NULL |  |

Foreign key: agent_id → agents.id; delete: CASCADE.

## runs

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| agent_id | TEXT | NOT NULL |  |
| source | TEXT | NOT NULL | 'playground' |
| input | TEXT | NOT NULL |  |
| output | TEXT | nullable |  |
| valid | INTEGER | nullable |  |
| trace | TEXT | nullable |  |
| usage | TEXT | nullable |  |
| llm_request_count | INTEGER | NOT NULL | 0 |
| duration_ms | INTEGER | nullable |  |
| error | TEXT | nullable |  |
| created_at | INTEGER | NOT NULL |  |

Foreign key: agent_id → agents.id; delete: CASCADE.

## user_sessions

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| token_hash | TEXT | PK |  |
| user_id | TEXT | NOT NULL |  |
| expires_at | INTEGER | NOT NULL |  |

Foreign key: user_id → users.id; delete: CASCADE.

## users

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| email | TEXT | NOT NULL |  |
| name | TEXT | NOT NULL |  |
| password_hash | TEXT | nullable |  |
| gemini_key | TEXT | nullable |  |
| created_at | INTEGER | NOT NULL |  |

## worker_locks

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| name | TEXT | PK |  |
| holder | TEXT | NOT NULL |  |
| expires_at | INTEGER | NOT NULL |  |

## workflow_credentials

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| name | TEXT | NOT NULL |  |
| kind | TEXT | NOT NULL |  |
| encrypted | TEXT | NOT NULL |  |
| created_at | INTEGER | NOT NULL |  |
| owner_id | TEXT | NOT NULL | 'legacy' |

## workflow_migrations

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| version | INTEGER | PK |  |
| applied_at | INTEGER | NOT NULL |  |

## workflow_runs

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| workflow_id | TEXT | NOT NULL |  |
| revision | INTEGER | NOT NULL |  |
| graph | TEXT | NOT NULL |  |
| status | TEXT | NOT NULL |  |
| source | TEXT | NOT NULL |  |
| input | TEXT | NOT NULL |  |
| steps | TEXT | NOT NULL |  |
| output | TEXT | nullable |  |
| error | TEXT | nullable |  |
| retry_of | TEXT | nullable |  |
| cancel_requested | INTEGER | NOT NULL | 0 |
| created_at | INTEGER | NOT NULL |  |
| started_at | INTEGER | nullable |  |
| finished_at | INTEGER | nullable |  |
| lease_until | INTEGER | nullable |  |
| worker_id | TEXT | nullable |  |
| event_key | TEXT | nullable |  |

Foreign key: workflow_id → workflows.id; delete: CASCADE.

## workflow_trigger_state

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| workflow_id | TEXT | PK |  |
| state | TEXT | NOT NULL |  |

Foreign key: workflow_id → workflows.id; delete: CASCADE.

## workflow_versions

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| workflow_id | TEXT | NOT NULL |  |
| revision | INTEGER | NOT NULL |  |
| graph | TEXT | NOT NULL |  |
| created_at | INTEGER | NOT NULL |  |

Foreign key: workflow_id → workflows.id; delete: CASCADE.

## workflow_worker_health

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| heartbeat | INTEGER | NOT NULL |  |

## workflows

| Column | SQLite type | Required / key | Default |
|---|---|---|---|
| id | TEXT | PK |  |
| name | TEXT | NOT NULL |  |
| description | TEXT | NOT NULL |  |
| graph | TEXT | NOT NULL |  |
| revision | INTEGER | NOT NULL |  |
| active_revision | INTEGER | nullable |  |
| webhook_hash | TEXT | nullable |  |
| created_at | INTEGER | NOT NULL |  |
| updated_at | INTEGER | NOT NULL |  |
| owner_id | TEXT | NOT NULL | 'legacy' |
