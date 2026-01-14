# Security Policy

## Reporting a Vulnerability
Please do not open public issues for security vulnerabilities.

If this project is hosted on GitHub, use Security Advisories to report issues.
Otherwise, email the maintainer at:

security-contact@example.com

Replace the email above with your preferred security contact before publishing.

## Supported Versions
Only the latest released version is supported with security updates.

## Scope
Report issues such as:
- Exposure of API tokens or user data
- Message spoofing between extension components
- Injection or privilege escalation paths in the extension
- Unexpected data exfiltration

## Minimum-Privilege Checklist
- Avoid new permissions unless required; document why they are needed.
- Keep `host_permissions` limited to Twitter/X and required API endpoints.
- Avoid injecting scripts into unrelated domains.
- Prefer local storage for secrets; do not sync API keys.
