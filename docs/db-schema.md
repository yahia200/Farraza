# Hiring Pipeline SaaS: Database Schema

Target: PostgreSQL 15 or newer. Table and column names are snake_case; map them to PascalCase models in Prisma with `@@map` / `@map`.

## 1. Conventions

- **Primary keys:** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` on every table.
- **Timestamps:** `timestamptz`, stored in UTC. `created_at` defaults to `now()`. `updated_at` defaults to `now()` and is maintained by the application (Prisma `@updatedAt`).
- **Emails and slugs:** `citext`, so uniqueness is case-insensitive.
- **Tenant column:** every company-owned table has `company_id`. The application copies it from the parent row on insert and filters by it on every query.
- **Blocking deletes:** where a delete must be refused, use `ON DELETE NO ACTION`, not `RESTRICT`. `NO ACTION` is checked at the end of the statement, so deleting a whole company still cascades cleanly. `RESTRICT` is checked immediately and can make that cascade fail.
- **Required extension:** `CREATE EXTENSION IF NOT EXISTS citext;`

## 2. Enums

| Enum | Values |
|---|---|
| `member_role` | `owner`, `admin`, `recruiter`, `interviewer` |
| `job_status` | `draft`, `open`, `closed` |
| `stage_kind` | `normal`, `hired`, `rejected` |
| `public_label` | `received`, `in_review`, `interview`, `offer`, `closed` |
| `application_status` | `active`, `rejected`, `hired`, `withdrawn` |
| `file_purpose` | `cv`, `answer` |
| `file_status` | `pending`, `uploaded` |
| `event_type` | `applied`, `stage_changed`, `auto_rejected`, `rejected`, `hired`, `withdrawn`, `note_added`, `score_added`, `email_sent` |

## 3. Tables

### 3.1 `users`
Company-side people (recruiters, admins). Candidates are not stored here.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `email` | `citext` | NOT NULL, UNIQUE |
| `password_hash` | `text` | NOT NULL |
| `name` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

### 3.2 `companies`
The tenant.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `text` | NOT NULL |
| `slug` | `citext` | NOT NULL, UNIQUE, CHECK `slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'` |
| `logo_url` | `text` | NULL |
| `brand_color` | `char(7)` | NULL, CHECK `brand_color ~ '^#[0-9a-fA-F]{6}$'` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

### 3.3 `memberships`
Links a user to a company with a role.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `role` | `member_role` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`user_id`, `company_id`)
- INDEX (`company_id`)

### 3.4 `jobs`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `title` | `text` | NOT NULL |
| `slug` | `text` | NOT NULL, CHECK `slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'` |
| `description` | `text` | NULL |
| `status` | `job_status` | NOT NULL, DEFAULT `'draft'` |
| `published_form_version_id` | `uuid` | NULL, FK → `form_versions.id` ON DELETE NO ACTION |
| `created_by` | `uuid` | NULL, FK → `users.id` ON DELETE SET NULL |
| `opened_at` | `timestamptz` | NULL |
| `closed_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`company_id`, `slug`). The public apply URL is `/{company.slug}/{job.slug}`.
- INDEX (`company_id`, `status`)
- CHECK `status <> 'open' OR published_form_version_id IS NOT NULL` (a job cannot be open without a published form)
- `published_form_version_id` and `form_versions.job_id` reference each other. Create `jobs` without this FK, create `form_versions`, then add the FK with `ALTER TABLE`.

### 3.5 `form_versions`
One row per version of a job's application form. A published version is never edited; changes go into a new draft.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE CASCADE |
| `version` | `integer` | NOT NULL, CHECK `version > 0` |
| `fields` | `jsonb` | NOT NULL, DEFAULT `'[]'`, CHECK `jsonb_typeof(fields) = 'array'` |
| `published_at` | `timestamptz` | NULL (NULL means draft) |
| `created_by` | `uuid` | NULL, FK → `users.id` ON DELETE SET NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`job_id`, `version`)
- UNIQUE (`job_id`) WHERE `published_at IS NULL` (at most one draft per job)
- Immutability after publishing is enforced in the application.

### 3.6 `stages`
Pipeline stages, owned by a job. Seeded from a default set when the job is created.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE CASCADE |
| `name` | `text` | NOT NULL (internal, never shown to candidates) |
| `position` | `integer` | NOT NULL, CHECK `position >= 0` |
| `kind` | `stage_kind` | NOT NULL, DEFAULT `'normal'` |
| `public_label` | `public_label` | NOT NULL, DEFAULT `'in_review'` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`job_id`, `position`) DEFERRABLE INITIALLY DEFERRED (lets you reorder stages inside one transaction)
- UNIQUE (`job_id`, `name`)
- UNIQUE (`job_id`, `kind`) WHERE `kind <> 'normal'` (exactly one hired and one rejected stage per job)

Default stages:

| Position | Name | Kind | Public label |
|---|---|---|---|
| 0 | Applied | `normal` | `received` |
| 1 | Screening | `normal` | `in_review` |
| 2 | Interview | `normal` | `interview` |
| 3 | Offer | `normal` | `offer` |
| 4 | Hired | `hired` | `closed` |
| 5 | Rejected | `rejected` | `closed` |

### 3.7 `candidate_accounts`
Platform-wide identity for a candidate. Created only when someone proves they own the email by using a login link. Only the verified candidate can edit it.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `email` | `citext` | NOT NULL, UNIQUE |
| `name` | `text` | NULL |
| `phone` | `text` | NULL |
| `verified_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `last_login_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

### 3.8 `login_tokens`
Magic-link tokens for candidates. Keyed by email, not account, because the account may not exist until the link is used.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `email` | `citext` | NOT NULL |
| `token_hash` | `text` | NOT NULL, UNIQUE (SHA-256 of the token; never store the raw token) |
| `expires_at` | `timestamptz` | NOT NULL |
| `used_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- INDEX (`email`)
- INDEX (`expires_at`) for the cleanup job

### 3.9 `candidates`
A company's own record of a person: what was submitted to that company. Written by the apply form and by that company's recruiters.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `account_id` | `uuid` | NULL, FK → `candidate_accounts.id` ON DELETE SET NULL |
| `email` | `citext` | NOT NULL |
| `name` | `text` | NOT NULL |
| `phone` | `text` | NOT NULL (validated as E.164 in the application) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`company_id`, `email`)
- INDEX (`account_id`)
- INDEX (`email`) (used to attach all matching rows when an account is verified)

### 3.10 `applications`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE NO ACTION |
| `candidate_id` | `uuid` | NOT NULL, FK → `candidates.id` ON DELETE CASCADE |
| `form_version_id` | `uuid` | NOT NULL, FK → `form_versions.id` ON DELETE NO ACTION |
| `stage_id` | `uuid` | NOT NULL, FK → `stages.id` ON DELETE NO ACTION |
| `status` | `application_status` | NOT NULL, DEFAULT `'active'` |
| `answers` | `jsonb` | NOT NULL, DEFAULT `'{}'`, CHECK `jsonb_typeof(answers) = 'object'` |
| `source` | `text` | NULL (for example a `utm_source` value) |
| `rejection_notified_at` | `timestamptz` | NULL (candidates see a rejection only after this is set) |
| `submitted_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE (`job_id`, `candidate_id`) (one application per person per job)
- INDEX (`job_id`, `stage_id`) (pipeline board)
- INDEX (`candidate_id`)
- INDEX (`company_id`, `submitted_at` DESC)
- GIN INDEX on `answers` using `jsonb_path_ops` (filtering by custom fields)
- A job with applications cannot be deleted; close it instead. Deleting a candidate removes their applications, which is what a data-erasure request needs.

### 3.11 `files`
Uploaded CVs and file-type answers. Rows are created before the upload starts, and often before the application exists.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE CASCADE |
| `application_id` | `uuid` | NULL, FK → `applications.id` ON DELETE CASCADE (set when the form is submitted) |
| `purpose` | `file_purpose` | NOT NULL |
| `field_key` | `uuid` | NULL |
| `storage_key` | `text` | NOT NULL, UNIQUE |
| `original_name` | `text` | NOT NULL |
| `mime_type` | `text` | NOT NULL |
| `size_bytes` | `bigint` | NOT NULL, CHECK `size_bytes > 0` |
| `status` | `file_status` | NOT NULL, DEFAULT `'pending'` |
| `uploaded_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- CHECK `(purpose = 'answer') = (field_key IS NOT NULL)`
- UNIQUE (`application_id`) WHERE `purpose = 'cv'` (one CV per application)
- INDEX (`application_id`)
- INDEX (`status`, `created_at`) (cleanup job for uploads that never finished or were never attached)
- Deleting a row does not delete the object in storage. The application must delete the object as well.

### 3.12 `application_events`
Append-only history of everything that happens to an application. Never updated or deleted by the application.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `application_id` | `uuid` | NOT NULL, FK → `applications.id` ON DELETE CASCADE |
| `type` | `event_type` | NOT NULL |
| `from_stage_id` | `uuid` | NULL, FK → `stages.id` ON DELETE SET NULL |
| `to_stage_id` | `uuid` | NULL, FK → `stages.id` ON DELETE SET NULL |
| `actor_id` | `uuid` | NULL, FK → `users.id` ON DELETE SET NULL (NULL means the system) |
| `data` | `jsonb` | NOT NULL, DEFAULT `'{}'` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- INDEX (`application_id`, `created_at`)
- Store the stage names in `data` as well, so the history still reads correctly if a stage is later deleted.

### 3.13 `notes`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `application_id` | `uuid` | NOT NULL, FK → `applications.id` ON DELETE CASCADE |
| `author_id` | `uuid` | NULL, FK → `users.id` ON DELETE SET NULL |
| `body` | `text` | NOT NULL, CHECK `length(trim(body)) > 0` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- INDEX (`application_id`, `created_at`)

### 3.14 `scores`
A reviewer's rating of an application overall, or of one answer.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK → `companies.id` ON DELETE CASCADE |
| `application_id` | `uuid` | NOT NULL, FK → `applications.id` ON DELETE CASCADE |
| `reviewer_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `field_key` | `uuid` | NULL (NULL means an overall score) |
| `value` | `smallint` | NOT NULL, CHECK `value BETWEEN 1 AND 5` |
| `comment` | `text` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

- UNIQUE NULLS NOT DISTINCT (`application_id`, `reviewer_id`, `field_key`) (one score per reviewer per answer, and one overall score; needs PostgreSQL 15+)

## 4. JSONB shapes

These are validated in the application, not by the database.

### 4.1 `form_versions.fields`
An array of field objects:

```json
[
  {
    "key": "3f1c9a52-6f0e-4b7a-9a43-1d2c8e5b7f10",
    "type": "yes_no",
    "label": "Are you able to work on-site in Cairo?",
    "helpText": null,
    "required": true,
    "order": 0,
    "config": {
      "knockout": { "rejectWhen": false }
    }
  }
]
```

| Property | Type | Rules |
|---|---|---|
| `key` | uuid string | Unique within the form. Stays the same across versions for the same question. |
| `type` | string | One of the field types below. |
| `label` | string | Required, non-empty. |
| `helpText` | string or null | Optional. |
| `required` | boolean | Required. |
| `order` | integer | Unique within the form. |
| `config` | object | Shape depends on `type`. |

Field types for the first version:

| Type | `config` | Answer value in `applications.answers` |
|---|---|---|
| `short_text` | `{ "maxLength": 200 }` | string |
| `long_text` | `{ "maxLength": 5000 }` | string |
| `single_select` | `{ "options": [{ "id": "uuid", "label": "..." }], "knockout": { "rejectOptionIds": ["uuid"] } }` | option id (string) |
| `multi_select` | `{ "options": [...], "maxSelections": 3 }` | array of option ids |
| `yes_no` | `{ "knockout": { "rejectWhen": false } }` | boolean |
| `file` | `{ "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 10485760 }` | file id (uuid string) |

`knockout` is optional on `single_select` and `yes_no`. Options are referenced by `id`, not label, so relabelling an option does not break old answers.

Name, email, phone, and CV are not part of `fields`. They are fixed inputs on every form and are stored in `candidates` and `files`.

### 4.2 `applications.answers`
An object keyed by field key:

```json
{
  "3f1c9a52-6f0e-4b7a-9a43-1d2c8e5b7f10": true,
  "a8d2e7b1-0c4f-4e9d-8b21-5f6a7c8d9e01": "I have four years of experience with..."
}
```

Unanswered optional fields are omitted.

### 4.3 `application_events.data`

| Event type | `data` |
|---|---|
| `applied` | `{ "source": "linkedin" }` |
| `stage_changed` | `{ "fromStageName": "Screening", "toStageName": "Interview" }` |
| `auto_rejected` | `{ "fieldKey": "uuid", "fieldLabel": "..." }` |
| `rejected` | `{ "reason": "..." }` |
| `email_sent` | `{ "template": "application_received" }` |
| `note_added` | `{ "noteId": "uuid" }` |
| `score_added` | `{ "scoreId": "uuid", "value": 4 }` |
| `hired`, `withdrawn` | `{}` |

## 5. Relationships

- A `company` has many `memberships`, `jobs`, and `candidates`.
- A `user` has many `memberships`.
- A `job` has many `form_versions`, `stages`, `applications`, and `files`, and points at one published `form_version`.
- A `candidate_account` has many `candidates` (one per company the person applied to).
- A `candidate` has many `applications`.
- An `application` belongs to one `job`, one `candidate`, one `form_version`, and one `stage`, and has many `files`, `application_events`, `notes`, and `scores`.

## 6. Creation order

1. Extension `citext`
2. Enums
3. `users`
4. `companies`
5. `memberships`
6. `jobs` (without the `published_form_version_id` FK)
7. `form_versions`
8. `ALTER TABLE jobs` to add the `published_form_version_id` FK
9. `stages`
10. `candidate_accounts`
11. `login_tokens`
12. `candidates`
13. `applications`
14. `files`
15. `application_events`
16. `notes`
17. `scores`

## 7. Rules enforced in the application

The database cannot check these, so the services must:

- `company_id` on a child row equals the `company_id` of its parent.
- `applications.stage_id` belongs to the same job as the application.
- `applications.form_version_id` belongs to the same job and is a published version.
- `applications.answers` is valid against the fields of that form version.
- A published `form_versions` row is never modified.
- `candidate_accounts` is written only from a verified candidate session.
- When a login token is used, set `candidates.account_id` on every row whose email matches.
- When an application moves to a `hired` or `rejected` stage, update `applications.status` in the same transaction and write an `application_events` row.

## 8. Not included yet

- **Invitations** (inviting teammates by email): add with the team feature.
- **Refresh tokens or sessions for `users`:** add if you use refresh-token rotation instead of short-lived access tokens only.
- **Structured experience, timed questions, and video fields:** new field types in `form_versions.fields`; video will also need transcoding columns on `files`.
- **Billing and plans.**
