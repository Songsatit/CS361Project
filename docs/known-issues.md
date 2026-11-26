# Known issues and accounting rules

## GPAX and repeated attempts

The current `summarize()`/`latestAttempts()` implementation selects one latest attempt per course for both the GPAX summary and the configured course-average rules. This is deliberately unchanged pending registrar confirmation and a separate approved task.

- Example: a 3-credit course taken three times currently contributes 3 credits to GPAX; the intended rule under review is 9 credits.
- Example: if an earlier attempt passed but the latest attempt is F, the current summary uses F. The correct registrar rule is not yet confirmed.

Do not silently change these functions while implementing category checks.

## Grade accounting reference for the later grading task

- F does not earn graduation credits, but is included in GPAX.
- S earns graduation credits and is excluded from GPAX.
- U and W do not earn graduation credits and are excluded from GPAX.

The existing grading implementation is intentionally unchanged in the category migration task.
