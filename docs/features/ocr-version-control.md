# Feature Specification: OCR Version Control

## 1. Overview

This document specifies the **Shared Multi-User OCR System** for Mokuro Library, implementing a database-master hybrid model with per-user caching.

### Core Principles

* **Database as Master:** PostgreSQL/SQLite is the single source of truth for all history and state.
* **Per-User Snapshot Caching:** Each user maintains a private snapshot file for read performance.
* **Copy-on-Write Branching:** Users view Admin's "Official" branch by default; edits fork into a private branch.
* **Cascade Cleanup:** Deleting a branch root automatically removes all descendant patches.

---

## 2. Database Schema

### 2.1 OcrBranch

Tracks the current state of a volume for a specific user.

```prisma
model OcrBranch {
  id              String   @id @default(ulid())
  volumeId        String
  userId          String

  headPatchId     String              // Current HEAD (latest state)
  headPatch       Patch    @relation("BranchHead", fields: [headPatchId], references: [id])

  rootPatchId     String?             // First private patch (NULL = clean/synced)
  rootPatch       Patch?   @relation("BranchRoot", fields: [rootPatchId], references: [id])

  snapshotPatchId String?             // Patch ID of cached snapshot
  version         Int      @default(0) // Optimistic lock counter

  reviewHeadPatchId String?            // Frozen submitted HEAD; NULL = no pending review
  reviewHeadPatch   Patch? @relation("BranchReviewHead", fields: [reviewHeadPatchId], references: [id])
  reviewRequestedAt DateTime?          // Request time, independent of branch updatedAt
  submissionNote    String?
  rejectionReason   String?            // Also retains automatic cancellation explanations

  @@unique([volumeId, userId])
}
```

### 2.2 Patch

Doubly-linked list for admin, singly-linked for users. Cascade delete enables cleanup.

```prisma
model Patch {
  id          String   @id @default(ulid())
  parentId    String?
  parent      Patch?   @relation("HistoryTree", fields: [parentId], references: [id], onDelete: Cascade)
  children    Patch[]  @relation("HistoryTree")

  nextPatchId String?  @unique        // Forward pointer (admin only)
  nextPatch   Patch?   @relation("AdminChain", fields: [nextPatchId], references: [id])

  volumeId    String
  userId      String
  operation   String                  // JSON: PatchOperation
  createdAt   DateTime @default(now())
  pendingReviews OcrBranch[] @relation("BranchReviewHead")
}
```

**Genesis Patch:** `parentId = NULL`, `operation = { op: 'genesis', path: mokuroPath }`

### 2.3 Snapshot Strategy

#### 2.3.1 Snapshot Validity and Failure Modes

A snapshot represents the fully materialized document state at a specific patch.
Snapshots are **binary-valid**: they are either fully valid or fully stale.

**Invariant (Snapshot Validity):**
A snapshot is valid if and only if `snapshotPatchId === headPatchId` and the ancestry
of `headPatchId` has not been rewritten.

Snapshots may become unusable in two distinct ways:

- **Stale snapshot**
  The snapshot exists and its internal patch identifier matches `snapshotPatchId`,
  but `snapshotPatchId ≠ headPatchId`.
  In this case, the snapshot MUST be synchronized by replaying patches
  **forward or backward** until it reaches `headPatchId`.

- **Corrupt or missing snapshot**
  The snapshot file is missing, or its internal patch identifier does not match
  `snapshotPatchId`.
  In this case, the snapshot MUST be regenerated from genesis.

Snapshots are never partially valid.

---

#### 2.3.2 Snapshot Synchronization

When a snapshot is stale, it MUST be synchronized to the current branch HEAD by
replaying patches.

Synchronization MAY require replaying patches **forward or backward**, depending
on whether the snapshot patch precedes or follows the current HEAD.

Backward synchronization may occur after undo operations.

---

#### 2.3.3 Snapshot Invalidation Semantics

A snapshot MUST be treated as invalid whenever the branch’s effective state changes.

In particular, snapshot invalidation occurs when:

- The branch HEAD changes (patch, undo, redo, rebase completion, reset, officialize)
- The branch root changes in a way that changes effective document state or ancestry
- A rebase aborts or completes
- Patch compression rewrites the branch history

Moving only the private-range boundary during fast-forward officialization does
not invalidate the user's snapshot when its HEAD and document ancestry remain
unchanged. Implicit officialization leaves the user branch and its snapshot
unchanged. Advancing the admin HEAD makes the admin snapshot stale; it must be
synchronized before serving the new state. Snapshot filesystem work occurs after
the database transaction succeeds.

### 2.4 Lazy Genesis

Branches and genesis patches are created on-demand when a volume is first accessed.

### 2.5 Steady-State Invariants

The system maintains the following invariants at all times:

- `rootPatchId = null` if and only if the branch has no private edits.
- Unaccepted private patches never participate in the admin forward chain;
  fast-forward officialization adopts contributor-authored patches into that chain.
- `reviewHeadPatchId = null` means no review is pending; there is no separate
  `isPendingReview` flag in the persisted model.
- A pending review head is reachable from the private root and is an ancestor of,
  or equal to, the live user HEAD. Ordinary edits cannot rewrite this submitted prefix.
- Redo requires a unique forward continuation; ambiguity is an invalid system state.
- Snapshots are valid only at the branch HEAD.

---

## 3. Data Types

### 3.1 PatchOperation

```typescript
export type PatchOperation =
  | { op: 'genesis'; path: string }
  | { op: 'replace'; path: string; value: PatchValue; old_value: PatchValue }
  | { op: 'add'; path: string; value: PatchValue }
  | { op: 'remove'; path: string; old_value: PatchValue }
  | { op: 'reorder'; path: string; new_order: number[] };
```

### 3.2 Value Types

```typescript
export type Quad = [[number, number], [number, number], [number, number], [number, number]];
export type Rect = [number, number, number, number];

export interface UnifiedLine { text: string; coords: Quad; }
export interface UnifiedBlock { box: Rect; vertical: boolean; font_size?: number; lines: UnifiedLine[]; }

export type PatchValue = string | boolean | number | Rect | Quad | UnifiedBlock | UnifiedLine;
```

---

## 4. Workflows

### 4.1 Editing (Fork-on-Write)

1. User edits trigger patch creation.
2. If `rootPatchId === null` (clean), set `rootPatchId = newPatch.id` (fork).
3. Update `headPatchId = newPatch.id`.

4. **Prune future history**
   If the branch HEAD is not at the tip of its private timeline (i.e., redo history
   exists), applying a new patch deletes all forward patches from the current HEAD
   to preserve a single forward path.

While a review is pending, new edits and future-history pruning are permitted only
after `reviewHeadPatchId`. Appending or replacing this unsubmitted tail does not
change the review boundary or invalidate the pending review.

### 4.2 Undo / Redo (User: Pointer Navigation)

User undo and redo navigate a user branch’s history by moving the branch HEAD pointer backward or forward through the patch timeline. These operations do not rewrite history; they only change which patch is currently active.

Undo and redo are defined only for user branches. Admin redo is not supported.

---

#### 4.2.1 User Undo

User undo reverts the most recently applied patch.

Conceptually, undo performs a **backward crawl**:

- If the current HEAD has a parent, the HEAD moves to that parent.
- If the current HEAD has no parent, the branch is at the start of its history and undo is not possible.
- If the current HEAD equals a non-null `reviewHeadPatchId`, undo is rejected:
  it would cross the submitted boundary. Undoing tail patches until HEAD reaches
  that boundary is allowed. Undo moves pointers; it does not delete the reviewed patch.

The server returns the inverse of the undone patch so the client can immediately revert local state.

---

#### 4.2.2 User Redo (Forward Navigation Priority)

Redo advances the branch HEAD by exactly one patch, following a unique forward
continuation determined by the following priority order:

1. **Re-enter private history**
   If the branch has a private root and the current HEAD is positioned at the fork
   point, redo advances into the branch’s private root.

2. **Follow authoritative forward edge**
   If the current patch defines a forward continuation via an authoritative forward
   edge, redo advances along that edge.

3. **Follow unique child**
   Otherwise, if the current patch has exactly one child, redo advances to that
   child.

4. **Invalid state**
   If multiple forward paths exist, redo is undefined and treated as an invalid
   system state.

Redo always advances the HEAD by exactly one patch.

---

#### 4.2.3 Invalid States

Redo assumes the forward direction from the current HEAD is unambiguous.

If the patch graph provides multiple competing forward paths, or if branch pointers violate expected ordering, redo is undefined and treated as an invalid system state rather than user error.

---

#### 4.2.4 Guarantees

- Undo moves the branch HEAD backward by one patch.
- Redo moves the branch HEAD forward by one patch.
- Neither operation rewrites or deletes patches.
- User branches always observe a consistent and continuous history during undo/redo navigation.

---

#### 4.2.5 Backward Snapshot Synchronization

After undo operations, it is possible for a snapshot to represent a patch that is
chronologically ahead of the current HEAD.

In such cases, the snapshot MUST be synchronized **backward** to the current HEAD
before any new edits are applied.

### 4.3 Admin Undo With Branch Drag

Admin undo reverts the current admin HEAD by one patch. Because this operation rewrites shared history, it is only permitted when its effects on user branches are unambiguous.

The defining behavior of admin undo is **branch drag**: when a user branch depends on the undone admin patch, the branch’s **root pointer is dragged backward** together with the admin HEAD so that the branch’s history remains continuous after the rewrite.

---

#### 4.3.1 Dependency Types

A user branch is considered dependent on the current admin HEAD if either:

1. **HEAD-dependent branch**
   The branch has no private edits (`rootPatchId = null`) and its `headPatchId` equals the admin head.

2. **ROOT-dependent branch**
   The branch has private edits whose root patch descends directly from the admin head.

In both cases, removing the admin patch without adjustment would leave the branch with a broken ancestry.

---

#### 4.3.2 Undo Rules

Let `P` be the current admin head and `P.parent` the new admin head after undo.

- If **no user branch depends on `P`**:
  The admin head pointer moves backward to `P.parent`. No user branches are affected.

- If **exactly one user branch depends on `P`**:
  The admin head pointer moves backward to `P.parent`, and the dependent user branch’s **root pointer is dragged backward** so that the undone patch remains part of the branch’s private history.

- If **more than one user branch depends on `P`**:
  Undo is rejected. Admin history is considered solidified.

---

#### 4.3.3 Branch Drag Semantics

When branch drag occurs:

- The user branch’s `rootPatchId` is updated to point to the undone patch.
- If the branch previously had no private history, its `headPatchId` is also updated to this patch.
- If the branch already had private edits, the existing root is reattached beneath the dragged root.

Conceptually, the branch’s root **moves backward together with the admin undo**, preserving the branch’s visible history while allowing the admin branch to rewind.

Any patch duplication required to support this behavior is an implementation detail and does not affect the logical history model.

---

#### 4.3.4 Guarantees

- Admin undo never leaves a user branch with a dangling or discontinuous history.
- Admin redo is not supported.
- User branches always observe a consistent ancestry, even when admin history is rewritten.

---

#### 4.3.5 Admin Forward-History Pruning

After admin undo, the suffix beyond the new HEAD is abandoned, not active admin
history. The new HEAD MAY retain a `nextPatchId` link to that suffix solely for
later cleanup; the link does not make the suffix active. Before advancing HEAD
along a replacement path, an admin write MUST delete the abandoned suffix and its
descendants, not merely replace the forward link. Snapshot synchronization MAY
prune the suffix earlier. Every pruning path MUST apply the session-cancellation
rule in §4.3.6 before deleting a rebase target; foreign-key cascade alone does
not provide the required warning.

Admin history may be rewritten only while the dependent user branch can be uniquely identified and dragged backward.

The active admin history is the single parent chain ending at admin HEAD.

#### 4.3.6 Rebase Sessions Affected by Admin Undo

Each active rebase session records the admin patch at the end of the segment it
has already simulated (`targetHeadPatchId`). Before undoing admin HEAD `P`, find
sessions targeting `P`: moving HEAD to `P.parent` would remove their target from
the active admin chain. A session targeting an earlier ancestor remains valid.

If any sessions would be invalidated, undo MUST first return a confirmation-required
response identifying the affected sessions; the admin UI warns that proceeding
cancels those contributors' rebases. Confirmation does not bypass the admin branch
version check or the branch-drag dependency rules. The confirmed request must
identify the sessions the admin agreed to cancel. If that set changes before undo,
require a fresh confirmation rather than silently cancelling a new session.

On confirmation, cancel the affected sessions before attempting undo. Database
session deletion precedes eviction of each in-memory session; a failed deletion
must not evict a usable cache entry. Recheck for newly created affected sessions
before moving HEAD. Cancellation and undo are intentionally separate operations:
if undo subsequently fails, the already cancelled sessions are not restored. The
warning must say so. Admin edits that delete an undone forward chain apply the
same warning and cancellation rule to any sessions targeting patches to be pruned;
foreign-key cascade is not a substitute for explicit cancellation.


### 4.4 Rebase (Effect Propagation Model)

Rebase synchronizes a user branch with the current admin branch by **replaying user edits on top of admin changes**. This is implemented as an *effect propagation algorithm*: each admin patch is converted into an abstract effect, which is then pushed forward through the user’s patch sequence.

Rebase never mutates existing patches. Instead, it computes a transformed user patch list and later replays it on top of the admin head.

---

#### 4.4.1 Patch Sequences

Let:

- `A = [A₁, A₂, …, Aₙ]` be admin patches since the fork point (oldest → newest)
- `U = [U₁, U₂, …, Uₘ]` be user patches since the fork point (oldest → newest)

Simulation accepts an explicit inclusive range, from a supplied first user patch
through a supplied final user patch. It verifies that the range is connected and
ordered by ancestry. Ordinary rebase uses the private root through the live HEAD;
implicit officialization uses the private root through `reviewHeadPatchId` and
excludes every later patch. Simulation computes operations without mutating history.

Starting an explicit user rebase while review is pending requires a warning and
confirmation that the review will be cancelled. The access strategy clears the
matching review boundary and timestamp and increments the branch version before
invoking the engine. A failed start or later abort does not restore the review.
The engine guards rebase with that resulting version, independently of review policy.

Rebase processes admin patches one at a time, updating the user patch list after each step.

An ordinary rebase captures a finite admin segment from the fork point through
its target patch, not a requirement that the target remain the live admin HEAD.
At commit, require the session and its target patch to still exist, and require
`adminHead.sequence >= targetPatch.sequence`. These conditions establish target
validity under the admin-write invariant in §4.3.5: undo below the target lowers
the live HEAD sequence, while any later write that reaches the target's sequence on a
different path first deletes the abandoned suffix and its target (which also
deletes the session). Admin appends beyond the intact target preserve it and may
increase the live HEAD sequence without invalidating the rebase. Therefore do not
compare the admin version or demand that live HEAD still equal the target. Keep
the existence and sequence checks inside the commit transaction, before creating
replacement patches; the contributor branch version remains guarded because its
private history is being replaced. Every admin writer MUST preserve the pruning
invariant; otherwise sequence comparison cannot establish target validity.

When admin has advanced beyond the captured target, the transformed user patches
are committed on that target. The user branch may then be behind the live admin
HEAD and can rebase again over the later admin segment. Snapshot inheritance must
materialize the captured target's document state, not copy the later live admin
snapshot; clean-branch fast-forward must likewise validate the target it adopts.

---

#### 4.4.2 Core Loop

For each admin patch `Aᵢ`:

1. Convert `Aᵢ.operation` into an **Effect** `E`
   (see Appendix B.2 for effect types).

2. Initialize an empty list `U'`.

3. Iterate through the current user patch list `U` from left to right:

   - **Root-peek deduplication:** before transforming the first remaining user
     patch, compare its operation with `Aᵢ.operation` using deep strict equality.
     If identical, discard that user patch and replace the effect with identity.
     Otherwise perform the normal transformation. This is an exact operation
     comparison, not a general semantic-equivalence detector.
   - Unless the deduplication rule matched, apply `transform(Uⱼ, E)`.
   - If a conflict requiring user choice is detected, rebase pauses.
   - If the transformed user patch is not discarded, append it to `U'`.
   - Update `E` to the returned effect.

4. Replace `U ← U'` and continue with the next admin patch.

After all admin patches are processed, the final `U` represents the rebased user edits.

This deduplication supports a user branch left unchanged by implicit officialization:
on a later explicit rebase, matching accepted copies can be removed from the private
prefix while the remaining tail is transformed. Conflicts may still require user
resolution; reset to official state remains an available recovery option.

---

#### 4.4.3 Effects

An **Effect** represents the semantic impact of an admin patch on later operations:

- Structural effects (`shift_up`, `shift_down`, `permute`) describe how array indices change.
- Content effects describe value replacement at an exact path.
- Effects may evolve as they pass through user patches, or be absorbed entirely.

Serialized reorder patches use a **source-map** representation:
`new_order[newIndex] = oldIndex`. Rebase equations instead use semantic
**destination-map** permutations, where each old index maps to its new index.
Therefore, the admin effect permutation `π` and user reorder permutation `ρ` are
the inverses of their serialized arrays:

```text
π = inverse(adminPatch.new_order)
ρ = inverse(userPatch.new_order)
```

---

#### 4.4.4 Transform Semantics

Each `(user patch, effect)` pair is classified by their path relationship
(e.g. no overlap, structural interaction, direct conflict).

- Non-conflicting interactions deterministically rewrite paths or permutations.
- Conflicting interactions may either auto-resolve or require user choice.
- In many resolutions, the effect is absorbed and becomes identity.

Exact behaviors are defined in Appendix B.

---

#### 4.4.5 Termination and Complexity (Effect-Based Rebase)

This section analyzes the termination and time complexity of the effect
propagation rebase model described in Appendix B.

##### Termination

Effect-based rebase always terminates.

- Each user patch is transported through a finite sequence of upstream effects.
- Structural effects (index shifts, permutations) monotonically simplify as they
  are absorbed, rewritten, or eliminated.
- Conflict resolution rules either:
  - drop a patch,
  - rewrite it to be compatible with the effect, or
  - absorb the effect into the patch (effect → identity).

No rule introduces new effects or increases effect complexity.
Therefore, the process strictly progresses and must terminate.

##### Complexity Model

Let:
- `|A|` be the number of upstream (admin) patches,
- `|U|` be the number of user patches,
- `D` be the maximum patch path depth (number of identity-bearing container levels),
- `L` be the average container size affected by structural operations.

Rebase proceeds by transporting each user patch through each upstream effect,
yielding `|A| × |U|` patch–effect interactions.

For each interaction:

- **Intersection classification** requires comparing patch paths and effect paths,
  which is `O(D)`.
- **Structural transport** (index shifting or permutation application) is `O(L)`
  in the worst case.
- **Payload rewriting** (when required) is proportional to the payload size,
  which is also `O(L)` on average.

Thus, each interaction costs `O(D + L)`.

##### Total Time Complexity

The total time complexity is therefore: `O(|A| × |U| × (D + L))`

##### Space Complexity

The algorithm retains:
- the upstream effects `A`,
- the user patch sequence `U`,
- and the rewritten user patch sequence `U′`.

Because each patch stores a path of depth `D` and a payload whose average size is
`O(L)`, the space required to store a patch is `O(D + L)`.

Therefore, space complexity is: `O((|A| + |U|) × (D + L))`

If effects are streamed and not retained, this reduces to: `O(|U| × (D + L))`

---

**Invariant:**
Rebase transforms user patches relative to admin effects. Fast-forward
officialization is separate: it adopts an already-compatible submitted prefix
without transforming its operations.

**Conflict Resolution:** See Appendix B for detailed conflict tables.

### 4.5 Reset

Reset discards a user’s private edits and realigns the branch with the admin state.

Reset is performed in two phases:

1. Branch state is updated atomically in the database.
2. The branch snapshot is rebuilt from the admin state if required.

If review is pending, the frontend warns that reset cancels the review and discards
private edits, and requires confirmation. The backend clears `reviewHeadPatchId`
and `reviewRequestedAt` in the same transaction as reset, before deleting private
history. A cancelled confirmation must leave both review and branch unchanged.

### 4.6 OCR Review and Officialize

OCR review accepts patches on admin-owned volumes. It is distinct from private
volume submission, which transfers files and ownership (see `shared-library.md`).

#### 4.6.1 Request and Review Boundary

1. Creating a review request sets `reviewHeadPatchId = headPatchId`, records
   `reviewRequestedAt` and the optional submission note, and clears an old rejection
   reason. A branch has at most one pending review; creating another must not silently
   move an existing boundary. Review submission is rejected while a rebase session
   exists for the branch; the contributor must finish or abort it first.
2. The submitted range is `rootPatchId..reviewHeadPatchId`, inclusive. A request
   requires an active private range containing the submitted head.
3. The user may continue editing the tail. The review queue and admin preview use
   the frozen review head, not the current live HEAD; the request timestamp does not
   change with subsequent edits.
4. Cancellation or rejection clears the review head and request timestamp. Rejection
   retains an explanation in `rejectionReason`. Reset and explicit rebase cancel the
   review after warning and confirmation, as specified above.

#### 4.6.2 Acceptance and Concurrency

1. The admin submits the expected `reviewHeadPatchId` with the source user ID.
   The server checks it against the stored pending review. A cancelled or replaced
   review returns `409`; the server must not accept a different review instead.
2. Capture the admin HEAD and optimistic version before evaluating or simulating
   acceptance. Conditionally verify both inside the committing transaction.
3. Acceptance does not require the live user branch version from the client.
   Appending unsubmitted patches must not invalidate the frozen review.
4. Review-state checks, patch linking/materialization, and branch updates are
   transactional. Fast-forward bookkeeping must use the current live tail without
   overwriting concurrent user edits. A failed admin guard rolls back acceptance
   and returns a retryable `409`, without cancelling an otherwise unchanged review.

#### 4.6.3 Fast-Forward

When the submitted root's parent is the current admin HEAD:

1. Adopt only the submitted prefix and set its admin `nextPatchId` links.
2. Move the admin HEAD to `reviewHeadPatchId`, not to the live user HEAD.
3. Leave the live user HEAD unchanged. Move the user's private root to the first
   patch after the accepted boundary, if a private continuation exists; otherwise
   set it to `null`. Preserve any unsubmitted redo continuation as well as active tail.
4. Clear the review head, request timestamp, and rejection reason.

#### 4.6.4 Implicit Rebase

When fast-forward is not possible:

1. Simulate only `rootPatchId..reviewHeadPatchId` against the captured admin HEAD.
2. If successful, append the resulting operations as new admin-history patches,
   preserving contributor attribution, and advance the admin HEAD.
3. Leave the user HEAD, private root, and original patch history unchanged. Do not
   rebase or delete the unsubmitted tail during acceptance.
4. Clear the review head, request timestamp, and rejection reason. A later explicit
   user rebase uses root-peek deduplication to remove matching accepted copies.
5. An empty resulting operation list is successful acceptance: clear the review,
   leave both histories unchanged, and do not advance the admin HEAD.

#### 4.6.5 Conflict Cancels Review

A semantic conflict during implicit simulation cancels the matching pending review
instead of opening an admin conflict-resolution session or leaving it pending.

1. Clear `reviewHeadPatchId` and `reviewRequestedAt` and persist an explanation in
   `rejectionReason`, for example: “Official edits conflict with this submission.
   Rebase your branch and submit again.”
2. Return the cancellation status and explanation to the admin; expose the retained
   explanation to the contributor even though the entry is no longer pending.
3. Do not change either branch's HEAD/root or materialize any accepted patches.
4. Apply cancellation only if the stored review still matches the attempted review;
   a stale attempt must not cancel a newer request. Validate the captured admin
   state before recording a semantic-conflict cancellation; if it changed, return
   a retryable stale-state response instead.

This differs from an optimistic-lock failure: changed admin state requires retry,
whereas a semantic conflict cancels the review with an explanation.

### 4.7 Patch Compression

Patch compression reduces a patch sequence by eliminating edits that do not contribute to the final document state. Compression does not introduce a new reconciliation or transformation mechanism. Instead, it **reuses the rebase machinery directly**, applying it to a counterfactual change in history.

Where rebase introduces a new patch into the past and rewrites future patches to compensate, compression removes an existing patch from the past and rewrites future patches in the same manner.

---

#### 4.7.1 Conceptual Model

At any point during compression, the patch sequence is partitioned as:

C · P · T

where:
- `C` is the compressed prefix (patches already accepted as part of history),
- `P` is the patch under consideration,
- `T` is the remaining suffix.

Compression asks the following counterfactual question:

> *If patch `P` had never occurred, could the remaining patches be rewritten—using the same rules as rebase—to produce the same final document state?*

This question is evaluated by treating the **removal of `P` as a change to the past** and forcing the future patches to reinterpret themselves accordingly.

---

#### 4.7.2 Elimination Test (Rebase Reuse)

To test whether `P` can be eliminated, compression performs a rebase-style propagation:

1. Compute the inverse of `P` and convert it into an effect `E`.

2. Propagate `E` forward through the suffix `T` using the **same effect transformation logic used during rebase**.

3. During propagation, conflicts are resolved using **keep_mine semantics**, exactly as in rebase.

4. As in rebase, propagation may rewrite, transform, or discard patches in `T`, producing a rewritten suffix `T'`.

5. If propagation terminates with the **identity effect**, then the disappearance of `P` has been fully absorbed by rewriting the future.

   - `P` is eliminated.
   - The patch sequence becomes `C · T'`.

6. If propagation terminates with a non-identity effect, then the disappearance of `P` cannot be hidden from the future.

   - `P` is subsumed into the compressed prefix.
   - The patch sequence becomes `C' · T`, where `C' = C · P`.

Compression then continues with the updated `(C, T)`.

---

#### 4.7.3 Resolution Semantics (keep_mine)

All propagation during compression uses the **same resolution semantics as rebase**.

Specifically, conflicts are resolved using **keep_mine**, which rewrites future patches to behave as if the modified history had always been the case. Resolution does not select between alternatives; it **retroactively adjusts assumptions about the past while preserving the intent of the future**.

Resolution never halts and may freely rewrite, transform, or discard patches in the suffix, exactly as during rebase.

---

#### 4.7.4 Properties

- Patch compression is implemented by reusing the rebase effect-propagation machinery.
- Compression treats patch removal as a change to history, not as a local edit.
- No canonical patch representation is required.
- Structural and content patches are handled uniformly.
- Compression preserves the final document state.
- Time complexity is quadratic in the number of patches.

---

**Invariant:**
A patch `P` is eliminated if and only if rebase-style propagation of its inverse through the remaining patches—under keep_mine semantics—fully absorbs the effect of its removal.

---

## 5. API Specification

### 5.1 API Tree

```
/api/library/volume/:id
├── /patch                            POST    - Apply edit patch
├── /undo                             POST    - Undo last patch
├── /redo                             POST    - Redo undone patch
├── /reset                            POST    - Reset to admin state (user only)
├── /officialize                      POST    - Accept frozen review prefix (admin only)
├── /rebase
│   ├── /start                        POST    - Start rebase session
│   ├── /continue                     POST    - Continue with resolution
│   └── /abort                        POST    - Abort rebase session
├── /status                           GET     - Get sync status
├── /history                          GET     - Get patch history
└── /snapshot                         POST    - Force snapshot rebuild
```

### 5.2 Patching & Editing

**POST** `/api/library/volume/:id/patch`

* **Body:** `{ operation: PatchOperation, branchVersion: number }`
* **Response:** `{ success, newHeadId, newVersion, patch }`
* **Errors:** `400` (validation), `404` (not found), `409` (version mismatch)

**POST** `/api/library/volume/:id/undo`

* **Body:** `{ branchVersion: number, forced?: boolean, cancellingRebaseIds?: string[] }`
* **Response:** `{ success, newHeadId, newVersion, patch }` (patch is inverse)
* **Errors:** `400` (at genesis), `404`, `409` (version mismatch, pending review
  boundary, or admin rebase-cancellation confirmation required)

For admin undo, `forced` confirms cancellation only of the affected session IDs
returned by the confirmation-required response. A changed affected set requires
another warning. Contributor undo ignores these admin-only fields. Cancellation
may remain in effect if the subsequent admin undo fails (§4.3.6).

**POST** `/api/library/volume/:id/redo`

* **Body:** `{ branchVersion: number }`
* **Response:** `{ success, newHeadId, newVersion, patch }`
* **Errors:** `400` (nothing to redo), `404`, `405` (admin), `409`

### 5.3 Synchronization

**POST** `/api/library/volume/:id/rebase/start`

* **Body:** `{ branchVersion: number, forced?: boolean }` (`forced` defaults to false).
* **Response:** `{ status: 'complete', newHeadId }` or `{ status: 'paused', rebaseId, conflict }`
* **Errors:** `400` (invalid body), `404` (missing or inaccessible volume),
  `405` (admin cannot rebase), `409` (stale branch state or review cancellation needs confirmation).

Single and bulk entry points show the shared confirmation dialog before any request,
warning that pending reviews will be cancelled and abort will not restore them.
Confirmed requests send `forced: true` with each target's captured `branchVersion`.
Without `forced`, a pending review returns `409` with
`REVIEW_CANCELLATION_CONFIRMATION_REQUIRED` without changing review/history state.
The access strategy checks the displayed version and commits review cancellation
before invoking the engine. Cancellation remains effective if rebase start fails.
The engine checks the resulting branch version when starting, creates the session
and rechecks the version in one transaction, then enforces it transactionally at
commit. A version change invalidates
the rebase even if HEAD is unchanged. A stale version is rejected even
when forced. Existing sessions can be opened without starting again. Sessions from
before version tracking must be aborted and restarted because their start version
cannot be established safely.

**POST** `/api/library/volume/:id/rebase/continue`

* **Body:** `{ rebaseId, resolution: 'keep_admin' | 'keep_mine' }`
* **Response:** Same as start

**POST** `/api/library/volume/:id/rebase/abort`

* **Body:** `{ rebaseId }`
* **Response:** `{ status: 'aborted' }`

**POST** `/api/library/volume/:id/reset`

* **Body:** `{ branchVersion: number, forced?: boolean }` (`forced` defaults to false).
* **Response:** `{ success: true }`
* **Errors:** `400` (invalid body), `404`, `405` (admin cannot reset), `409`
  (stale branch/admin state or review cancellation needs confirmation).

If review is pending and `forced` is false, return `409` with
`code: 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'` and change nothing. The client
warns that private edits will be discarded and the review cancelled, then retries
with `forced: true` and the same observed `branchVersion` only after confirmation.
Force bypasses only confirmation, never authorization or optimistic locking.
If state changes while confirming, refresh rather than automatically retrying
with a newer version. On success, reload branch state before editing.

Reset atomically clears the review boundary/timestamp, records a cancellation
explanation when applicable, moves HEAD to the captured admin head, clears the
private root/snapshot pointer, increments the version, and deletes private history.
Pointers move before cascade deletion. A failed database transaction rolls back
all these changes. Snapshot-file synchronization occurs separately after commit.

### 5.4 Officialize

**POST** `/api/library/volume/:id/officialize`

* **Body:** `{ sourceBranchUserId: string, reviewHeadPatchId: string }`
* **Response:** `{ success: true, newHeadId: string }` (current official HEAD, including an empty result)
* **Errors:** `400` (invalid request/range), `403` (non-admin), `404`, `409`
* **Stale-state `409`:** `{ code: 'STALE_REVIEW' | 'STALE_ADMIN', message: string }`;
  do not cancel a current review merely because a request is stale.
* **Semantic-conflict `409`:** `{ code: 'REVIEW_CANCELLED_CONFLICT', reviewCancelled: true, message: string }`;
  the matching review is cancelled and the explanation is persisted.

There is no `sourceBranchVersion` input. The review head identifies the submitted
prefix; the admin optimistic version is captured by the server.

#### Review Queue and Lifecycle API

**GET** `/api/contributions/reviews`

* Lists entries whose `reviewHeadPatchId` is non-null, scoped to the caller's role.
* Entries include source user/volume identifiers, `reviewHeadPatchId`,
  `reviewRequestedAt`, and `submissionNote`. Behind status and previews refer to
  the submitted range, not later live edits.

**GET** `/api/contributions/reviews/candidates`

* Lists eligible active private ranges with no pending review.
* Contributor-facing state must also expose retained cancellation/rejection
  explanations after removal from the pending queue.

**POST** `/api/contributions/reviews/set`

* **Body:** `{ volumeId: string, status: boolean, reason?: string, targetUserId?: string }`
* User `status: true` creates a frozen review; user `status: false` cancels it.
* Admin `status: false` rejects the targeted user's review, retaining the reason.
* **Response:** `{ volumeId, status, action, newVersion }`, where `newVersion` belongs
  to the affected contributor branch, including for admin rejection.
* The branch version tracks edits and review-state changes. Submission, cancellation,
  rejection, and acceptance increment it atomically with their state changes. A repeated
  cancellation with no pending review is a no-op and returns the unchanged version.
  Clients retain the returned version or reload branch state before subsequent edits.
* Undo checks the captured version in its conditional write; a concurrent submission
  invalidates the undo without a separate review-boundary concurrency token. The
  semantic check preventing undo of the submitted head still applies.
* This does not change officialize's frozen-head identity: later user edits do not
  invalidate a pending review merely by advancing the user's branch version.
* Creating a request while one is already pending must not advance its boundary.
* This endpoint does not accept patches; acceptance uses `/officialize`.

### 5.5 Status & History

**GET** `/api/library/volume/:id/status`

* **Response:** `{ hasAhead, hasBehind, version, headPatchId }`

**GET** `/api/library/volume/:id/history`

* **Query:** `limit`, `offset`
* **Response:** `{ patches: [...], total }`

### 5.6 Strategy Pattern

| Endpoint | User | Admin |
|----------|------|-------|
| `patch` | Fork-on-write | Direct edit |
| `undo` | HEAD crawl | Branch drag or blocked |
| `redo` | Follow child | Not available (405) |
| `reset` | Discard edits | Not applicable (405) |
| `rebase` | Sync with admin | Not applicable (405) |
| `officialize` | Not applicable (403) | Frozen-prefix fast-forward or implicit rebase |

---

## 6. Security & Migration

### 6.1 Security Considerations

* **Ownership checks:** Users can only modify their own branches
* **Admin-only:** Officialize requires admin authentication
* **Optimistic locking:** Prevents concurrent edit conflicts
* **Frozen reviews:** Officialize checks the expected review head and captured
  admin version transactionally; ordinary user tail edits do not invalidate review.

### 6.2 Migration

Existing `.mokuro` files work without migration. Genesis patches are created lazily on first access.

### 6.3 Review Acceptance Tests

Required coverage for the frozen-review workflow:

1. Request creation freezes the current HEAD and timestamp; later appends do not move either.
2. Undo reaches but cannot cross the review boundary; replacing/pruning the tail preserves it.
3. Reset and explicit rebase require confirmation in the UI and cancel review in the backend.
4. Queue entries and previews use the frozen head and exclude later patches.
5. Cancelled/replaced review IDs are rejected; stale attempts cannot accept or cancel newer reviews.
6. Fast-forward accepts only the prefix, preserves the live head and redo tail, and moves the root correctly.
7. Inclusive range simulation excludes all patches after the review head.
8. Implicit acceptance leaves user head/root/history unchanged and preserves contributor attribution.
9. Later explicit rebase deduplicates matching accepted copies and preserves/transforms the unsubmitted tail.
10. Semantic conflicts cancel the matching review, persist and return an explanation, and change no history.
11. Empty simulation results clear review without advancing admin or rewriting user history.
12. Concurrent admin mutation produces a retryable rollback, not semantic-conflict cancellation.
13. Concurrent user tail edits are not lost or accidentally included in acceptance.
14. Snapshot behavior matches §2.3.3, and rejection/cancellation explanations remain visible to the contributor.

---

## Appendix A: Path Specification

This appendix defines the **user-facing** patch operation paths. Paths use JSON-pointer–like segments with arrays addressed by numeric indices. Array appends use index `array.length`.

### A.1 Block Operations

| Operation | Path | Value Type |
|-----------|------|------------|
| Add Block | `/pages/{p}/blocks/{b}` | `UnifiedBlock` |
| Remove Block | `/pages/{p}/blocks/{b}` | N/A (`old_value` required) |
| Reorder Blocks | `/pages/{p}/blocks` | N/A (`new_order` required) |
| Resize Box | `/pages/{p}/blocks/{b}/box` | `Rect` |
| Set Vertical | `/pages/{p}/blocks/{b}/vertical` | `boolean` |
| Set Font Size | `/pages/{p}/blocks/{b}/font_size` | `number` |

### A.2 Line Operations

| Operation | Path | Value Type |
|-----------|------|------------|
| Add Line | `/pages/{p}/blocks/{b}/lines/{l}` | `UnifiedLine` |
| Remove Line | `/pages/{p}/blocks/{b}/lines/{l}` | N/A (`old_value` required) |
| Reorder Lines | `/pages/{p}/blocks/{b}/lines` | N/A (`new_order` required) |
| Edit Text | `/pages/{p}/blocks/{b}/lines/{l}/text` | `string` |
| Edit Coords | `/pages/{p}/blocks/{b}/lines/{l}/coords` | `Quad` |

**Notes**
- To append, use `{b}` or `{l}` equal to `array.length`.
- Direct modification of the `lines_coords` array is forbidden; use `/lines/{l}/coords`.

---

## Appendix B: Rebase Semantics

This appendix defines how a **user patch operation** is transported through an upstream **effect** (admin change) during rebase.

### B.0 Conventions

**Structural effects**
- `shift_up(A, k)`: an element was inserted into array at path `A` at index `k`.
- `shift_down(A, k, D)`: an element at `A/k` was removed; `D` is the deleted payload.
- `permute(A, π)`: array at `A` was reordered by permutation `π`.
- `content(P, vA)`: leaf at path `P` was replaced to value `vA`.

**Permutation convention**
- `π(i)` maps **old index → new index**.
- Composition is function composition where **inner happens first**:
  - \[(outer ∘ inner)(i) = outer(inner(i))\]
  - (matches `result[i] = outer[inner[i]]`)

**Internal implementation note (not user-facing):** reorder/permute are treated as acting “at the array node” for intersection checks (often represented by a sentinel like `/-1`). The semantics below remain the same.

---

### B.1 Intersection Classification

| Type | Meaning | What Transforms |
|------|--------|------------------|
| `no_hit` | No overlap between user patch and effect | None |
| `collateral_ancestor_hit` | Effect is structural on an array `A`, and the user patch targets a descendant inside `A` (but not at the same array level) | User patch path (index transport) |
| `collateral_descendant_hit` | User patch is structural on an array `A`, and the effect targets a descendant inside `A` | Effect path (index transport) |
| `sibling_hit` | Both are structural at the same array level | Both (mutual transport) |
| `direct_hit` | Exact target match at the same node | Conflict |
| `ancestor_hit` | User patch targets inside a subtree whose root node was affected | Conflict |
| `descendant_hit` | Effect targets inside a subtree whose root node was affected by the user patch | Conflict |

**Important nuance:** `shift_up` is treated as “inserting into a gap,” so it does not produce `direct_hit` / `ancestor_hit` with an element path; it interacts structurally (e.g., `sibling_hit` / `descendant_hit` cases).

---

### B.2 Deterministic Structural Transforms (No Conflict)

These cases rewrite indices/paths without invoking conflict resolution.

#### B.2.1 `collateral_ancestor_hit` (structural effect on array, user patch inside that array)

Let effect act on array `A` and user patch target `A/i/...` (so the first segment under `A` is an index `i`).

| effect.type | Index transport for user index `i` | Description |
|-------------|------------------------------------|-------------|
| `shift_up(A, k)` | `i' = i + 1` if `i ≥ k`, else `i' = i` | insertion pushes later indices right |
| `shift_down(A, k, D)` | `i' = i − 1` if `i > k`, else `i' = i` | deletion pulls strictly-later indices left |
| `permute(A, π)` | `i' = π(i)` | reorder maps old index to new index |

User path becomes `A/i'/...`. Effect itself is unchanged.

---

#### B.2.2 `collateral_descendant_hit` (user structural patch on array, effect inside that array)

Let user patch act on array `A` and effect target `A/i/...`.

| user.op | Index transport for effect index `i` | Description |
|---------|--------------------------------------|-------------|
| `add` at `A/k` | `i' = i + 1` if `i ≥ k`, else `i' = i` | insertion shifts later effect targets right |
| `remove` at `A/k` | `i' = i − 1` if `i > k`, else `i' = i` | deletion shifts strictly-later effect targets left |
| `reorder(A, ρ)` | `i' = ρ(i)` | reorder maps old index to new index |

Effect path becomes `A/i'/...`. User op is unchanged.

---

#### B.2.3 `sibling_hit` (both structural on the same array)

Here both sides are structural on the same array `A`. Rebase proceeds as **mutual transport**:
1) transport the **user index/permutation** through the effect, and
2) update the **effect index/permutation** to account for the user structural change.

##### (a) user `reorder(A, ρ)` vs effect `shift_up(A, k)` or `shift_down(A, k, D)`

| effect.type | Description |
|------------|-------------|
| `shift_up(A, k)` | Extend the user permutation to length+1 to include the inserted element at index `k` (preserving relative order of existing elements). Then map the inserted element’s index through the extended permutation to determine the effect’s new index. |
| `shift_down(A, k, D)` | First map the deleted element’s index through the user permutation to determine where that element would be after user reorder; then shrink the user permutation to length−1 by removing the deleted element’s slot. |

**Note:** user `reorder` vs effect `permute` is treated as `direct_hit` (`reorder_collision`), not a sibling transform.

##### (b) user `add/remove` vs effect `shift_up/shift_down`

Let user index be `u` (for `add` or `remove` at `A/u`) and effect index be `k`.

| effect.type | Transport user index `u` through effect | Then update effect index `k` through user structural change |
|------------|------------------------------------------|------------------------------------------------------------|
| `shift_up(A, k)` | `u' = u+1` if `u ≥ k`, else `u' = u` | if user inserts/removes at `u'` and `u' < k`, then `k` shifts by `+1` (insert) or `−1` (remove) |
| `shift_down(A, k, D)` | `u' = u−1` if `u > k`, else `u' = u` (the equality case is a `direct_hit` conflict) | if user inserts/removes at `u'` and `u' < k`, then `k` shifts by `+1` (insert) or `−1` (remove) |

##### (c) user `add/remove` vs effect `permute(A, π)`

| user.op | Description |
|---------|-------------|
| `add` at `A/u` | Expand effect permutation `π` to length+1 to account for the inserted element, then transport the user insertion index through the expanded permutation to get the rebased insertion index. The effect keeps the expanded permutation. |
| `remove` at `A/u` | Transport the user removal index through `π` to get the rebased removal index, then shrink effect permutation to length−1 by removing the removed slot. The effect keeps the shrunk permutation. |

---

### B.3 Conflict Resolution Matrix

Conflicts arise only for `direct_hit`, `ancestor_hit`, and specific `descendant_hit` cases.

| Intersection | effect.type | user.op | Conflict | Auto | keep_admin | keep_mine |
|---|---|---|---|---:|---|---|
| `direct_hit` | `shift_down` | `add` | `shift_down_into_add` | ✓ | keep patch; move delete index from `k` to `k+1` | — |
| `direct_hit` | `shift_down` | `remove` | `double_delete` | ✓ | drop patch; effect → identity | — |
| `direct_hit` | `permute` | `reorder` | `reorder_collision` | ✗ | drop user reorder; effect permutation becomes `π ∘ ρ⁻¹` | keep reorder; rewrite to `ρ ∘ π⁻¹`; effect → identity |
| `direct_hit` | `content` | `replace` | `content_conflict` | ✗ | drop user replace; keep effect | keep replace, but set `old_value := vA`; effect → identity |
| `ancestor_hit` | `shift_down` | any (inside deleted subtree) | `dead_zone` | ✗ | drop user op; but fold user change into deleted payload `D := Apply(D, r, user_op)` | resurrect: output `add` at deleted path with `D := Apply(D, r, user_op)`; effect → identity |
| `descendant_hit` | any | `remove` | `reverse_dead_zone` | ✗ | drop user remove; output `shift_up` reinserting the (updated) old payload | keep user remove but update `old_value` by folding admin change into it; effect → identity |
| `descendant_hit` | any | `add` | `effect_shift` | ✓ | keep patch; transport effect target path through the insertion (`i ≥ k ⇒ i+1`) | — |
| `descendant_hit` | any | `reorder` | `effect_shift` | ✓ | keep patch; transport effect target path through the reorder (`i → ρ(i)`) | — |

Where:
- In `dead_zone`, `r` is the relative path tail inside the deleted element: user targets `A/k/r`.
- In `reverse_dead_zone`, the “fold admin change into payload” applies the admin effect (converted to an op when possible) into the removed element’s payload at the appropriate relative tail.

**Invariant (operational):**
- `keep_mine` returns a concrete user op and absorbs the effect (`effect → identity`).
- `keep_admin` returns no user op (`op → null`) and preserves a residual effect, sometimes rewritten to account for the user’s original intent.

---

### B.4 Inversion Property (keep_admin from keep_mine)

For every conflict that supports both resolutions (`dead_zone`, `reverse_dead_zone`, `reorder_collision`, `content_conflict`), the `keep_admin` outcome can be derived as:

> **Do `keep_mine` first**, obtaining `(op_mine, identity)`,
> then **move the inverse of `op_mine` into the effect** and set `op := null`.

Formally:
\[
\texttt{keep\_admin}(u,e) \equiv (\,op := null,\; effect := \text{Effect}(op_{mine}^{-1})\,)
\quad\text{where}\quad (op_{mine}, id)=\texttt{keep\_mine}(u,e)
\]

**Why it matches exactly here:** in `content_conflict`, `keep_mine` first rewrites the user replace to have `old_value := vA` (the admin-set value). That makes its inverse effect precisely “set to `vA`,” which is exactly the `keep_admin` residual content effect.
