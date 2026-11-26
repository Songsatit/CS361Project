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

## Curriculum structure reference update

- The CS core-average group is CS100, CS101, CS102, CS111, CS232, CS240, CS251, and CS261; every course uses C as the passing threshold.
- The CNC core-average group is represented in the system as CNC101, CNC102, CNC211, CNC222, CNC231, CNC235, and CNC332; every course uses C as the passing threshold. The CNC prefix mapping follows the course codes already present in the repository; live database confirmation was unavailable to the agent.
- CS graduation minimum-C courses are CS101, CS102, and CS111. CNC graduation minimum-C courses are CNC101, CNC102, CNC222, CNC231, and CNC235.
- Category excess-credit policy is `no_carry_over` for CS and CNC. Excess credits do not satisfy another category; this remains subject to registrar confirmation.
