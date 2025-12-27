# Mokuro Library: Shared Multi-User System
## Feature Documentation

---

## Overview

Mokuro Library is transitioning from isolated per-user libraries to a collaborative shared library where users contribute and improve manga together while maintaining individual reading progress.

**Core Principles:**
- All content shared and visible to all users
- Community ownership (library owns content, not individuals)
- Transparent attribution and version history
- Quality maintained through review processes
- Private reading data per user

---

## User Roles & Permissions

Permissions are **library-wide** and only admins can change user roles.

### Viewer
- Read all approved manga
- Track personal reading progress/bookmarks
- View version history
- Submit and upvote manga requests
- **Submit Mokuro text edits (visible locally, needs Editor/Admin approval)**

### Uploader
- Everything Viewer can do
- Upload new manga
- Mark uploads as higher quality replacements
- Request anonymous attribution

### Editor
- Everything Uploader can do
- Edit Mokuro OCR text (immediately public)
- Review and approve/reject uploads
- **Approve/reject user-submitted text edits**
- Approve quality comparisons
- Rollback Mokuro text changes

### Admin
- Everything Editor can do
- Delete manga
- Manage users and permissions
- View all user statistics
- Generate invite codes
- Handle migration conflicts

---

## User Management

### Account Creation (3 methods, can all be active)

**1. Public Registration**
- Anyone can register
- No invitation needed
- New users start as Viewer
- Can be enabled/disabled by admins

**2. Invite Codes**
- Admin-generated codes
- Limited use (X registrations) or unlimited
- Optional expiry date
- Tracks who used which code

**3. Admin-Created Accounts**
- Admin creates account with username/email
- Password reset link generated (expires in 7 days)
- User sets own password
- Admin can assign initial role

### Account Deletion
- Users cannot delete their own accounts
- Only admins can delete accounts
- Attribution remains (or changes to "Anonymous" per admin choice)
- Reading progress deleted

### Anonymous Attribution
- Auto-approved for uploads
- Public sees "Anonymous", admins see real username
- Mokuro text edits always show real username (prevents vandalism)

---

## Shared Library Model

### Content Visibility
- All approved manga immediately visible to all users
- No personal/private libraries
- No user-specific visibility controls

### Ownership & Attribution
- Library owns manga, not individuals
- Tracks: original uploader, text editors, quality upgraders
- Attribution permanent unless admin removes it
- Uploaders cannot restrict access or delete content

### What Stays Private
- Reading progress and bookmarks
- Reading history and statistics
- **Note:** Admins can view all user data in user/library panels

---

## Upload Workflow

### Standard Process

**1. Upload**
- Select files
- System scrapes metadata
- Enters pending review (uploader can see it, others cannot)

**2. Duplicate Detection**
If similar manga exists, uploader chooses:
- **Same content** → Auto-rejected
- **Different version** → Normal review queue
- **Higher quality** → Quality comparison queue

**3. Review**
- Editors/Admins review quality, duplicates, Mokuro text
- **Approve** → Publicly visible to all
- **Reject** → Deleted with reason sent to uploader
- No appeals, no time limit

### Quality Comparison

When "higher quality version" is uploaded:
- Original uploader notified
- Editor/Admin reviews side-by-side
- **Approve**: Replaces old version, adds attribution, maintains reading progress
- **Reject**: Keeps current, deletes new

---

## Mokuro Text Editing & Version Control

### Editing

**Two-Tier System:**

**Viewers/Uploaders:**
- Can submit text edits
- Edits visible only to them (local preview)
- Must be approved by Editor/Admin to become public
- While pending: see their edits, others see original text
- After approval: becomes part of version history

**Editors/Admins:**
- Edits are immediately public
- No approval needed
- Instantly committed to version history

**Process:**
1. Edit any text box (creates pending change)
2. Click "Save Changes" when done
3. Each text box edit = one commit
4. **Viewer/Uploader**: Commits sent to approval queue
5. **Editor/Admin**: All commits pushed immediately
6. No commit messages (auto-timestamped)

**Unsaved Changes:**
- Until "Save" clicked, edits are unsaved
- Warning if leaving without saving

**Approval Queue (for Editor/Admin):**
- View pending edits from Viewers/Uploaders
- See before/after comparison
- Approve (becomes public) or Reject (stays local to submitter)
- Bulk approve/reject available

### Live Updates

**Viewing Edits:**
- Viewers/Uploaders see their own pending (unapproved) edits
- Everyone sees approved edits from Editors/Admins immediately
- No one sees others' pending edits

When someone else edits while you're editing:
- Text boxes you haven't touched → update automatically (if approved)
- Text boxes you're editing → stay unchanged (preserves your work)
- Toast: "🔄 Another user just updated this manga"

**Conflict Resolution:** Last write wins (both preserved in history)

### Version History

**Full History:**
- Every text box edit tracked forever
- Shows: commit #, timestamp, user, before/after text
- Public and visible to all users

**Blame View:**
- See who last edited each text box
- View per-text-box history

**Storage:** Text diffs only (efficient)

### Rollback

**Who Can:**
- Editors and Admins only

**Scope:**
- Single text box, entire page, or entire manga

**Process:**
- Rollback creates new commit (doesn't delete history)
- Example: "Rollback to #245 by EditorA"

---

## Reading Experience

### Private Data (per user)
- Current page, completion status
- Bookmarks with notes
- Reading history and statistics
- Only visible to user and admins

### Active Reader Protection

When admin/editor deletes manga with active readers:
- Warning shows who's reading (name + page)
- Must confirm to proceed
- Active readers see: "This manga was deleted" overlay
- Reading progress preserved

### Live Text Updates

When someone edits Mokuro text you're reading:
- Different page → Updates when you navigate there
- Current page → Text updates automatically
- Toast: "Text on this page was just updated by UserC"
- No page refresh, seamless update

---

## Manga Request System

### How It Works

**Creating Request:**
1. Enter title/series info
2. System scrapes metadata (MAL, AniList)
3. Auto-fills title, author, description, cover
4. Submit request

**Public Display:**
- All users see all requests
- Shows: title, author, requester, upvotes, status
- Sorted by upvotes
- Users do NOT see files or internal notes

**Upvote System:**
- One upvote per user per request
- Helps prioritize community wants

**Status States:**
1. **Requested** - Submitted, unclaimed
2. **Being Sourced** - Someone working on it
3. **Uploaded** - Linked to manga in library

**Marking as Uploaded:**
- Automatic (system detects match)
- Manual (uploader links to request)
- Requester notified

**Duplicate Prevention:**
- System checks existing requests
- Suggests upvoting instead of creating duplicate

---

## Migration Strategy

### From Isolated to Shared

**Process:**
1. Scan all user libraries
2. Detect duplicates by metadata
3. Keep highest quality version for each unique manga
4. Present merge conflicts to admin

**Merge Conflicts:**
Admin sees conflicts requiring resolution:
- **Different content**: Choose Version A, B, keep both, or merge
- Shows quality metrics for comparison

**Preservation:**
- All user reading progress preserved
- Page mapping (best-effort if page numbers differ)
- All attributions maintained

**Attribution:**
- Shows all original uploaders
- Notes merged versions

**User Notification:**
Users notified of:
- How many manga migrated
- Duplicates merged
- Reading progress preserved
- New collaboration features

---

## Key Workflows

### User Flow: Uploading Manga
1. Select files → System scrapes metadata
2. Duplicate check → Choose same/different/better
3. Pending review → Wait for editor approval
4. Approved → Visible to all users

### Editor Flow: Reviewing Upload
1. View pending queue
2. Check quality, duplicates, processing
3. Approve or reject with reason
4. Uploader notified

### User Flow: Editing Mokuro Text (Viewer/Uploader)
1. Open editor → Edit text boxes
2. Save changes → Each box = one commit
3. Commits sent to approval queue
4. User sees edits locally (others see original)
5. Wait for Editor/Admin approval
6. Approved → Version history updated and public

### User Flow: Editing Mokuro Text (Editor/Admin)
1. Open editor → Edit text boxes
2. Save changes → Each box = one commit
3. All commits immediately public
4. Version history updated instantly

### Editor Flow: Approving Text Edits
1. View pending edit queue
2. See before/after comparisons
3. Approve (becomes public) or Reject
4. Submitter notified

### Admin Flow: Managing Users
1. Create accounts (or generate invite codes)
2. Assign roles
3. View user statistics
4. Handle deletions

---

## Summary

**What's Shared:**
- All manga content and files
- Mokuro text and version history
- Attribution and quality reviews

**What's Private:**
- Reading progress and bookmarks
- Reading history and stats
- (Admins can view user data)

**Key Features:**
- Two-tier editing system (immediate for Editors/Admins, approval for Viewers/Uploaders)
- Collaborative editing with version control
- Quality review process
- Active reader protection
- Community requests system
- Flexible account creation
- Complete migration from isolated libraries