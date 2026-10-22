# Khatwateen

Khatwateen is a multi-tenant hiring-pipeline tool (a small ATS). A company posts jobs, collects applications through a public form, and moves candidates through a pipeline of stages until they are hired or rejected.

## Hiring

**Company**:
A tenant — an organization that posts jobs and whose members review candidates. All data belongs to exactly one company.
_Avoid_: Organization, tenant, account

**Member**:
A person with access to a company's workspace, holding a role (owner, admin, recruiter, or interviewer).
_Avoid_: User (a User is the person's login; a Member is that person within one company), employee

**Job**:
A single open position a company is hiring for, with its own application form and pipeline.
_Avoid_: Posting, vacancy, role (role is a member's permission level, not a job)

**Applicant**:
A person filling in a Job's public application form. Once they submit it, they are a Candidate with an Application.
_Avoid_: Candidate (until they submit)

**Candidate**:
A person who has applied to a company, identified by their email. One Candidate per company.
_Avoid_: Applicant (an Applicant hasn't submitted yet), lead, contact

**Application**:
One Candidate's submission to one Job — the answers to that job's form at the moment they applied. A Candidate has at most one Application per Job. The UI labels a job's list of Applications "Candidates", but each row is an Application.
_Avoid_: Submission, entry, candidate (a Candidate is the person; an Application is their submission to a job)

**CV**:
The document an applicant submits with an Application through the form's dedicated CV slot. An Application has at most one CV, and a job's form decides whether it is off, optional, or required.
_Avoid_: Resume

**Attachment**:
A file an applicant uploads to answer a file question on the form. It belongs to that question and is distinct from the CV.
_Avoid_: Upload, document

## Pipeline

**Pipeline**:
A Job's ordered list of Stages, from first contact to a final outcome.
_Avoid_: Workflow, funnel, board (the board is the UI that shows a pipeline)

**Stage**:
One step in a Job's pipeline (e.g. Applied, Screening, Interview, Offer, Hired, Rejected). Each Stage is of kind normal, hired, or rejected; the kind an Application lands in sets its outcome.
_Avoid_: Step, column, status (status is the Application's outcome, derived from its Stage's kind)

**Move**:
Changing which Stage an Application sits in. Every move is recorded in the Application's history.
_Avoid_: Transition, drag

**Note**:
A free-text comment a Member leaves on an Application. Append-only — notes are never edited or deleted.
_Avoid_: Comment, remark

**Application Event**:
An entry in an Application's append-only history: applied, auto-rejected, moved, hired, rejected, or note added. Together these form the audit trail of everything that has happened to an Application.
_Avoid_: Log, activity, audit record

**Auto-reject rule**:
A rule on a form question that sends an Application straight to the Rejected stage when the answer matches.
_Avoid_: Knockout (the internal code term; say "auto-reject" in anything user-facing), filter

## Accounts

**Identity**:
A sign-in from an outside provider (such as Google) linked to one User, named by the provider and the provider's own id for that person (its subject), never by email. A User can have several Identities; an Identity belongs to exactly one User.
_Avoid_: Social login, connection, OAuth account

**Account linking**:
Attaching an Identity to an existing User, either by a signed-in User connecting the provider, or on a first provider sign-in whose email matches a User when both the provider and Khatwateen have verified that address.
_Avoid_: Merging, connecting (as a noun)

**Account pre-hijacking**:
An attack where someone registers with another person's email before they do, then gains access once the real owner signs in with a provider and the two are linked by email. Account linking refuses to link to an unverified address to prevent it.
_Avoid_: Account takeover (that is gaining access to an account the victim already uses)
