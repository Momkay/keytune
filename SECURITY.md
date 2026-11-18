# Security

Keytune is a static page that talks to your keyboard over WebHID. It has no server, no account and no analytics, and nothing you do is uploaded. A strict Content Security Policy blocks every network request except to its own files.

It writes to your keyboard's memory, so it saves a backup file to your Downloads folder before the first change and checks every write by reading it back.

Found a problem that could damage a keyboard or leak data? Please report it privately through the repository's "Report a vulnerability" button (GitHub security advisories) instead of a public issue.
