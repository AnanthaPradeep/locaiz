# Matching engine

Shop and universal search share their catalogue filter function with the alert checker. Global Atlas uses the same offer query for results and alerts. Retail facet groups use OR within a group and AND across groups. All supplier constraints for a sourced match must hold on one offer. Retail bounds apply to catalogue INR prices. Supplier offer currency remains attached to the offer, and pickup eligibility does not confirm stock.

Saving or changing criteria snapshots existing matches as a silent baseline. Renaming does not change the criteria revision. Paused searches are skipped. Resuming adds current matches to the baseline while retaining previously seen IDs. Match identity is a product route or supplier offer ID. Alert identity combines saved search, criteria revision and match ID. The checker preserves previously seen IDs when entries leave the catalogue.

## Future authenticated mode

Extend the shared criteria and match types with an authenticated storage adapter. An owner-scoped saved-search table should carry criteria revision and preferences. A server-owned match table should enforce a unique search, revision, entity tuple. A notification table should link to the match, identify the owner and support a read timestamp. Use a trusted job to evaluate published products and offers when publication or match-relevant attributes change. Write match and alert rows transactionally with duplicate protection. RLS should authorize owner reads and saved-search mutations, limit notification edits to read state, and disallow browser clients from creating match rows or alerts. Verify owner isolation, anonymous access and spoofing before enabling the adapter. Offer an explicit opt-in before importing browser-local searches.

Phase 1 runs on the demonstration catalogue in the browser. It has no cloud persistence, background job or account isolation.

See the [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) for grants and owner policies when building the authenticated adapter.
