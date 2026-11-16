# Session Replay Privacy

## Current status

- Session Replay is **not offered**. Hospeda analytics run on Umami, which has no session recording.
- Replay was disabled in the previous PostHog setup (`disable_session_recording: true`) and
  was never turned on. PostHog was retired in HOS-2119.
- Nothing in `apps/web`, `apps/admin` or `apps/api` records sessions.

## If recording is ever introduced

Adopting any session-recording tool needs its own spec and a privacy review first. The
minimum policy is below.

### What must stay hidden

- passwords
- emails and phone numbers typed by users
- private messages
- contact data
- payment data
- tokens or sensitive query params

### Sensitive surfaces

- authentication
- contact forms to accommodations
- guest conversation access
- checkout and subscriptions
- messaging
- admin panel with user and billing data

### Requirements

- Mask all inputs and all text by default, with selective unmask on elements marked safe.
- Redact captured URLs that carry sensitive query params.
- Keep the admin panel off by default.
- Sample: never record 100% of sessions, prioritise error sessions and onboarding,
  publication and checkout flows.
- Verify manually (login/sign up, contact form, checkout, public navigation) before enabling.

## Conclusion

Replay is not offered. Keep it that way until masking, exclusions and sampling are approved
and manually verified.
