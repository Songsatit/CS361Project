# Known issues and accounting rules

## GPAX and repeated attempts

The grading functions now use `calcGPAX()` for every counted attempt. A 3-credit course taken three times contributes 9 credits to the GPAX denominator. F contributes zero points but remains in the denominator; S/U/W do not enter GPAX.

`calcCoreAverageCondition()` selects only attempts that meet the configured minimum grade for each course. Its default `first_pass` policy is configurable per curriculum and still has a TODO for registrar confirmation. If more than one attempt passes, the result includes a review flag instead of silently guessing.

`latestAttempts()` remains in use for latest-attempt views and rules that explicitly require the latest result, such as the per-course minimum-grade rule and accumulated-credit summary. It is no longer used by GPAX or the core-average calculation.

## Grade accounting reference for the later grading task

- F does not earn graduation credits, but is included in GPAX.
- S earns graduation credits and is excluded from GPAX.
- U and W do not earn graduation credits and are excluded from GPAX.

The existing grading implementation is intentionally unchanged in the category migration task.
