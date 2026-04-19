# Gmail MCP Server (Security-Hardened Fork)

A security-hardened [Model Context Protocol](https://modelcontextprotocol.io/) server for Gmail. Designed for use with Claude Code, Claude Desktop, or any MCP-compatible client.

> **Fork lineage:** [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) -> [ArtyMcLabin/Gmail-MCP-Server](https://github.com/ArtyMcLabin/Gmail-MCP-Server) -> this repo.
>
> This fork adds security hardening for safe daily use with AI assistants: safety flags that disable dangerous tools by default, prompt injection boundaries around email content, and locked-down OAuth scopes.

## Security Model

This fork is built around the principle that **an AI assistant reading your email should not be able to send, delete, or create forwarding rules** unless you explicitly opt in.

### Safety Flags

Dangerous tools are **disabled by default** via compile-time flags in `src/tools.ts`:

| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_SEND_EMAIL` | `false` | `send_email`, `reply_all` |
| `ENABLE_DELETE_EMAIL` | `false` | `delete_email`, `batch_delete_emails` |
| `ENABLE_FILTER_CREATION` | `false` | `create_filter`, `create_filter_from_template` |

To enable a capability, change the flag to `true` in `src/tools.ts` and rebuild (`npm run build`).

### Prompt Injection Protection

All email content returned to the AI is wrapped in random cryptographic boundaries:

```
--- UNTRUSTED EMAIL CONTENT [a1b2c3d4e5f6...] ---
(email body here)
--- END UNTRUSTED EMAIL CONTENT [a1b2c3d4e5f6...] ---
```

The boundary is generated with `crypto.randomUUID()` per call and stripped from the content if it appears, making it impossible for a malicious email to fake the closing marker.

### Locked OAuth Scopes

OAuth scopes are **hardcoded** in `src/scopes.ts` (the `--scopes` CLI flag is ignored):

```typescript
const HARDCODED_SCOPES = ["gmail.modify"];
```

- `gmail.modify` covers read, draft, archive, and label operations
- `gmail.settings.basic` is **excluded** (it enables auto-forwarding rules)
- `gmail.send` and `gmail.compose` are **excluded**

To change scopes, edit `HARDCODED_SCOPES` in `src/scopes.ts` and re-authenticate.

### Additional Hardening

- **CRLF header injection prevention** -- all user-supplied header values are sanitized
- **Path traversal protection** -- attachment downloads validate resolved paths
- **OAuth callback binds to 127.0.0.1 only** -- no network exposure during auth
- **Credential files written with 0o600 permissions** -- owner-only access

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Choose **Desktop app**, give it a name, click **Create**
7. Download the JSON file and rename it to `gcp-oauth.keys.json`

> If your app is in "Testing" mode, add authorized test users under **OAuth consent screen > Audience > Test users**.

### 2. Install and Authenticate

```bash
git clone https://github.com/zenrith-fluxman/gmail-mcp-server.git
cd gmail-mcp-server
npm install && npm run build

# Place your OAuth keys
mkdir -p ~/.gmail-mcp
mv /path/to/gcp-oauth.keys.json ~/.gmail-mcp/

# Authenticate (opens browser)
node dist/index.js auth
```

Credentials are saved to `~/.gmail-mcp/credentials.json`.

### 3. Configure Your MCP Client

**Claude Code** (`~/.claude.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/path/to/gmail-mcp-server/dist/index.js"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/path/to/gmail-mcp-server/dist/index.js"]
    }
  }
}
```

## Available Tools

With default safety flags, 15 tools are available. Tools marked with a lock require enabling the corresponding safety flag.

### Reading

| Tool | Description |
|------|-------------|
| `search_emails` | Search emails using Gmail query syntax. Returns metadata only (no bodies). |
| `bulk_read_emails` | Read multiple emails at once. Returns full bodies with attachment metadata. |
| `download_attachment` | Download an email attachment to local filesystem. |

### Threads

| Tool | Description |
|------|-------------|
| `get_thread` | Retrieve all messages in a thread (chronological order). |
| `list_inbox_threads` | List threads matching a query with snippet and message count. |
| `get_inbox_with_threads` | List threads with optional full message expansion. |

### Writing

| Tool | Description |
|------|-------------|
| `draft_email` | Create a draft email (supports HTML, attachments, threading). |
| `modify_email` | Add/remove labels on an email. |
| `batch_modify_emails` | Modify labels on multiple emails in batches. |
| `archive_emails` | Remove emails from inbox (optionally apply a tracking label). |

### Labels

| Tool | Description |
|------|-------------|
| `list_email_labels` | List all Gmail labels (system + user). |
| `create_label` | Create a new label. |
| `update_label` | Update a label's name or visibility. |
| `delete_label` | Delete a user-created label. |
| `get_or_create_label` | Get a label by name, creating it if it doesn't exist. |

### Disabled by Default

| Tool | Safety Flag | Risk |
|------|-------------|------|
| `send_email` | `ENABLE_SEND_EMAIL` | Sends email immediately |
| `reply_all` | `ENABLE_SEND_EMAIL` | Sends to all recipients |
| `delete_email` | `ENABLE_DELETE_EMAIL` | Permanent deletion, no undo |
| `batch_delete_emails` | `ENABLE_DELETE_EMAIL` | Bulk permanent deletion |
| `create_filter` | `ENABLE_FILTER_CREATION` | Can set up auto-forwarding |
| `create_filter_from_template` | `ENABLE_FILTER_CREATION` | Can set up auto-forwarding |

### Filter Tools (Read-Only, Always Available)

| Tool | Description |
|------|-------------|
| `list_filters` | List all Gmail filters. |
| `get_filter` | Get details of a specific filter. |
| `delete_filter` | Delete a filter. |

## Re-authenticating

To change scopes or refresh credentials:

```bash
rm ~/.gmail-mcp/credentials.json
node dist/index.js auth
```

## Troubleshooting

- **OAuth keys not found** -- ensure `gcp-oauth.keys.json` is in `~/.gmail-mcp/`
- **"invalid_grant" error** -- token expired. Delete `~/.gmail-mcp/credentials.json` and re-authenticate.
- **Port 3000 in use** -- free the port before running auth (`lsof -i :3000`)
- **"Not a test user" error** -- add the Google account under OAuth consent screen > Audience > Test users

## License

MIT (see [LICENSE](LICENSE))

## Acknowledgments

- [GongRzhe](https://github.com/GongRzhe) -- original Gmail MCP server
- [ArtyMcLabin](https://github.com/ArtyMcLabin) -- maintained fork with reply threading, send-as aliases, and CI hardening
- Security contributions from [@JF10R](https://github.com/JF10R), [@MaxGhenis](https://github.com/MaxGhenis), [@nicholas-anthony-ai](https://github.com/nicholas-anthony-ai), [@tansanDOTeth](https://github.com/tansanDOTeth)
