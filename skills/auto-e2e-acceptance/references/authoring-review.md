# Spec authoring and consistency review

Use this review whenever creating, updating, or regenerating an auto-e2e spec. It is a pre-delivery gate, not a claim that the application passed acceptance.

## 1. Establish sources before reading the old spec as truth

Inventory the sources independently of the existing spec. Select their authority order using project instructions and explicit declarations. Unless the project says otherwise, prefer:

1. the user's current explicit requirement;
2. project-declared authoritative contracts and current requirement documents;
3. approved product decisions and current design documents;
4. current test plans for scenarios and evidence expectations;
5. implementation observations, which describe what exists but do not redefine the requirement;
6. existing specs and support files, which are candidates for preservation only after review.

Record unresolved conflicts instead of silently choosing a convenient statement. Do not encode an expected value from an older spec, prototype, screenshot, implementation, or test fixture when a higher-authority source says otherwise.

## 2. Audit every expected result

Before writing the final JSON, build a working trace for every proposed result containing:

- the exact authoritative source and section that supports the expectation;
- the business action or state that makes it observable;
- the required profile, environment, fixture, date, account mapping, or comparison data;
- the proof that can demonstrate the result independently;
- the step that produces or exposes that proof.

Reject or revise a result when its wording reverses the source, compares the wrong measures, relies only on the current implementation, or cannot identify its evidence. Re-check polarity words such as only, all, include, exclude, enabled, disabled, unchanged, and default; these are common sources of inverted assertions.

Existing results are not grandfathered in. Preserve one only when its expectation is still source-backed and its prerequisites remain executable.

## 3. Keep scenarios executable

Split scenarios when they require different authentication profiles, permission scopes, prepared failure modes, mutable setup, target environments, independent navigation flows, or evidence sources. One run cannot prove several permission roles merely because the instruction names them.

A large bundle is a review signal, not automatically an error. Split it when one blocker would obscure unrelated findings, when proofs cannot be attributed clearly, or when the executor would need to change external prerequisites mid-run.

Do not claim a bundle is self-contained merely because it includes a reference file. Verify that the file contains the non-sensitive fixtures, mappings, dates, or expected values needed for its assertions. A checklist that only says data must be prepared is a prerequisite list, not test evidence.

## 4. Make results atomic and deterministic

Each result should identify one independently diagnosable business claim. Split assertions that combine several countries, fields, account classes, screens, or calculations when a failure would not reveal which part was wrong.

Prefer runner-evaluated values:

- use `numeric` for a concrete amount with an explicit tolerance;
- use `table` or `file` with an expected resource for multi-row reconciliation;
- use `equals` or `contains` for a directly observable scalar or label;
- use a boolean only for a genuinely binary UI or business condition, not as a substitute for returning the values used in a complex reconciliation.

Page-to-page agreement is not independent proof when both views use the same backend calculation. For reconciliation claims, provide a separate expected resource or an authorized independent read-only source.

## 5. Check runtime feasibility

For every step and result, classify prerequisites as available, intentionally supplied at run time, or unavailable. Do not hide missing profiles, fixtures, mappings, service-level access, or failure scenarios inside prose and then present the spec as immediately runnable.

Browser-visible evidence cannot by itself prove database state, transaction rollback, direct API rejection, background collection, or historical calculation inputs. Put such checks in a separate scenario with an authorized observable interface, or report them as outside the current runner's verification boundary.

`blocked` is a valid execution result for an unexpected unavailable prerequisite; it is not a substitute for knowingly shipping a spec whose mandatory evidence was never supplied.

## 6. Pre-delivery gate

Do not call the authored spec ready until all answers below are yes:

- Does every expectation agree with the selected authoritative source?
- Are source conflicts resolved or explicitly reported outside the spec?
- Can each result name its action, evidence, and prerequisite?
- Are different profiles, environments, and prepared failure modes separated appropriately?
- Are complex reconciliations expressed with concrete values or expected resources instead of unsupported booleans?
- Can a failed result identify the specific behavior that failed?
- Are intentionally unavailable service-level or mutation checks excluded or separated?
- Does the spec satisfy the current schema and resource-boundary rules?

When updating an existing spec, summarize corrected contradictions, removed stale assertions, scenario splits, and unresolved runtime prerequisites for the user.
