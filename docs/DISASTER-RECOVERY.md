# Disaster recovery

- Assign an incident lead and database and frontend owners. Record recovery point and recovery time objectives, backup retention, access permissions and alert destinations before launch.
- Document database backup coverage and back up private Storage objects separately. Inventory service configuration needed to restore Auth redirects, SMTP, buckets and security policies. Store recovery material under restricted access.
- Restore to an isolated project and validate migration history, representative private records, object references and actor permissions. Time the drill and record actual recovery point and duration.
- For a regression, stop affected writes as appropriate. Roll back the frontend to the previous approved artifact only if compatible with the active schema. For schema or data changes, decide between a reviewed forward repair and recovery from the approved recovery point. Recheck session isolation, data integrity and workflow paths before reactivation.
