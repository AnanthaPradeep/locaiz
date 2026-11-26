# Phase 5 production readiness

| Milestone | Current scope |
| --- | --- |
| 5.1 Security | Repository audit and initial environment and attachment hardening. Hosted verification remains open. |
| 5.2 Separation | Local and disposable CI are supported. Pages is explicitly disconnected. Staging and production remain to be provisioned separately. |
| 5.3 Supabase | Migrations and role tests are versioned. Collect hosted Auth, Storage and database evidence in staging. |
| 5.4 Hosting | Keep Pages for the demo. Evaluate a separate HTTPS frontend for staging and production against the criteria in the deployment runbook. |
| 5.5 Operations | Set alert ownership and verify backup, restore, retention and error redaction in staging. |
| 5.6 End-to-end | Disposable CI covers connected workflows. Complete the hosted independent-account scenario before asking for launch approval. |

Follow the [staging setup](STAGING-SETUP.md), [production deployment](PRODUCTION-DEPLOYMENT.md), [disaster recovery](DISASTER-RECOVERY.md) and [launch checklist](LAUNCH-CHECKLIST.md).
