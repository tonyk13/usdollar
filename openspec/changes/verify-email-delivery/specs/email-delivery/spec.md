## ADDED Requirements

### Requirement: Test email command
The system SHALL provide a `test-email` command that sends a small confirmation email to the configured recipient using the configured `EMAIL_*` credentials, without invoking the report-generation pipeline or the LLM. The command MUST report clear success or failure to the terminal.

#### Scenario: Email configured and credentials valid
- **WHEN** a user runs `npm run test-email` with valid `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_TO` set
- **THEN** a short test email is delivered to `EMAIL_TO` and the terminal prints a success message naming the recipient

#### Scenario: Email not configured
- **WHEN** a user runs `npm run test-email` with no `EMAIL_*` environment variables set
- **THEN** no email is sent, the terminal prints setup instructions pointing to `.env.example` and the Gmail App Password article, and the process exits with a non-zero status

#### Scenario: Email configured but credentials invalid
- **WHEN** a user runs `npm run test-email` with `EMAIL_*` set but the credentials are wrong (e.g. a regular password instead of an App Password)
- **THEN** no email is sent, the terminal prints the specific SMTP error message, and the process exits with a non-zero status

### Requirement: Credential verification before report generation
When email is configured (`isEmailConfigured()` returns true), the scheduler and one-shot entry points SHALL verify SMTP connectivity and authentication via `transporter.verify()` BEFORE generating the report. If verification fails, the run MUST abort with a clear error message and NOT generate or send the report.

#### Scenario: Invalid credentials detected before report generation
- **WHEN** a scheduled run starts with `EMAIL_*` set but the SMTP credentials are invalid
- **THEN** the run aborts with an error message containing the SMTP failure detail, and no LLM API call is made and no report is generated

#### Scenario: Valid credentials proceed normally
- **WHEN** a scheduled run starts with `EMAIL_*` set and the SMTP credentials verify successfully
- **THEN** the run proceeds to generate the report and email it

#### Scenario: Email not configured proceeds in terminal-only mode
- **WHEN** a scheduled run starts with no `EMAIL_*` set
- **THEN** the run proceeds to generate the report and print it to the terminal, and a warning is logged noting email is not configured — the run does NOT abort

### Requirement: Clear environment variable template
`.env.example` SHALL document the email configuration fields with an explicit note that `EMAIL_PASS` MUST be a Gmail App Password (with a link to the support article) and SHALL show `EMAIL_TO` as a distinct field with an example value visibly different from the `EMAIL_USER` example.

#### Scenario: User copies the email template
- **WHEN** a user copies the email block from `.env.example` into `.env`
- **THEN** they see `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_TO` as separate fields, and an inline comment stating that `EMAIL_PASS` must be a Gmail App Password, not a regular password
