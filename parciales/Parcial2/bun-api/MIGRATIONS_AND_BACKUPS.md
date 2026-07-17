# MongoDB migrations and backups

On API startup, pending migrations run sequentially and are registered in
`schema_migrations` with a SHA-256 checksum. Never edit an applied migration;
add the next numeric version instead.

Admin endpoints require `MCP_ADMIN_KEY` as a Bearer token:

- `GET /admin/migrations` and `POST /admin/migrations/run`
- `POST /admin/migrations/rollback` with `{ "confirmation": "ROLLBACK_LATEST" }`
- `GET|POST /admin/backups`
- `POST /admin/backups/:id/restore` with `{ "confirmation": "RESTORE:<id>" }`

Rollback only reverses the latest migration and is intended for an immediate
recovery before new writes depend on its schema. Create a backup first.
Restoration replaces each configured collection, so it deliberately requires
an exact confirmation and writes an audit event.

Backups are JSON snapshots stored in MongoDB for the free academic deployment.
Configure collections with `BACKUP_COLLECTIONS`, retention with
`BACKUP_RETENTION` (default 7), size with `BACKUP_MAX_BYTES` (default 12 MB),
and disable the hourly daily-backup check with `BACKUP_DAILY_ENABLED=false`.
Production systems should additionally copy snapshots to independent object
storage; the in-database strategy avoids paid infrastructure for this project.
