# Account service verification

Mozilla Accounts can require Fastly service verification before processing a sign-in request. This happens before password or two-factor verification and must not be reported as an incorrect password.

The desktop and Android clients use the same account user agent for API calls and verification requests. Each verification attempt starts with a separate cookie jar while retaining the existing physical-network transport. Successful verification cookies are then installed in the account client. Desktop callers share an in-flight verification rather than racing on the cookie jar.

Desktop account clients use Electron's Chromium network transport throughout sign-in, verification and token renewal. The transport is injected into the control client and carried into its verification client. This avoids mixing Node's HTTP stack with the desktop browser's operating-system proxy and networking behavior. Certificate validation, redirect rejection and request deadlines remain enabled.

The initialization reader decodes JSON arguments, including nested arrays and escaped delimiters, without evaluating downloaded JavaScript. It validates the challenge path against the page's asset prefix. Failed script downloads report their HTTP status instead of being misidentified as a changed JavaScript format. Unsupported interactive challenges remain errors; these changes do not automate image CAPTCHAs.

## Validation

- Desktop fixtures cover nested JSON, malformed and executable arguments, unexpected challenge paths, concurrent verification, fresh cookies, consistent account headers and script HTTP errors.
- Android fixtures cover the JSON reader, account headers and clearance installation on the API host.
- Live unauthenticated checks reproduced a successful verification followed by an API HTTP 406 rejection. A separate request reached API input validation (HTTP 400). This confirms that successful challenge submission alone is insufficient evidence of working account sign-in.
- The Chromium transport subsequently reached account authentication: a reserved, random `example.invalid` address returned HTTP 400 with Mozilla error 102 (`Unknown account`). The opt-in `scripts/check-account-service.cjs` reproduces this without a real email, password or account session. This checks the service gate and does not establish successful sign-in for an existing account.
- Real account sign-in must be confirmed in the installed client. No user passwords, two-factor codes or session tokens are required in chat or diagnostic logs.
