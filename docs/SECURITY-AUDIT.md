# Phase 5 security audit

| Boundary | Repository finding and work | Remaining verification |
| --- | --- | --- |
| Browser config | Existing Vite validation checked key type and credential pairing. Phase 5 validates the marketplace flag, project origin and browser key format, and adds a disconnected Pages build guard. | Verify hosted environment targets before release. |
| Auth and membership | Supabase Auth plus SQL ownership and membership checks. Foundation, sourcing, journey and other CI suites include role and actor boundaries. | Verify independent buyer, owner, manager, unrelated seller and operator sessions in staging, including email confirmation and resets. |
| Attachments | Journey Storage is private. New uploads require a participant-owned UUID path and an approved extension. RFQ and messaging now both check supported MIME, size and file header in the browser. Legacy read policy stays compatible. | Browser header validation is bypassable by direct clients. Verify hosted bucket limits, signed reads and object cleanup, and resolve server-side scanning and upload abuse controls before external uploads. |
| Secrets | Pages builds clear browser backend variables. Disposable CI masks its local privileged key and removes it before browser checks. | Verify hosted secret inventory, rotation ownership, incident notification and artifact review. |
| Error handling and recovery | Test failures can have Playwright artifacts. Connected workflows depend on Supabase Auth, database and Storage. | Private observability, log retention, backup restoration and escalation drill are open. |

Production approval requires evidence from staging and recorded disposition of any remaining launch-blocking finding. [Launch checklist](LAUNCH-CHECKLIST.md)
