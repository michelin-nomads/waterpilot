# R23 Community details

Date: 2026-10-16

Community detail is organized into Overview, Shared reports and Members tabs.
The overview keeps joined/leave/archive controls and role-sensitive access. The
shared report tab shows only the sanitized goal/date summary and explains which
private fields/files remain hidden. The members tab uses the existing bounded
member query and shows roles, never fabricated names; the API exposes no member
display identity. Archived communities remain read-only and preserve linked
history. Existing sole-coordinator/archive messaging and optimistic rollback
remain in place.

Automated service and authorization coverage is inherited from existing
community tests. New desktop UI behavior was typechecked and linted; browser
visual and click inspection remains pending in this checkout. No live services
were called.
