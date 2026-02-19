# Backend API Requirements for Admin Console Integration

To make all admin console features fully functional and actionable, please implement the following endpoints and data contracts. These endpoints should be protected (admin-only) and return JSON.

---

## System Tab

### 1. Performance Metrics
- **GET /api/admin/performance**
  - Returns: `{ cpu: number, memory: number, uptime: number, reqPerMin: number, ... }`

### 2. Feature Flags
- **GET /api/admin/feature-flags**
  - Returns: `[ { key: string, enabled: boolean, description?: string } ]`
- **POST /api/admin/feature-flags**
  - Body: `{ key: string, enabled: boolean }`
  - Action: Create or update a flag
- **DELETE /api/admin/feature-flags/:key**
  - Action: Remove a flag

### 3. Deploy/Rollback
- **GET /api/admin/deploys**
  - Returns: `[ { id: string, status: string, startedAt: string, finishedAt?: string } ]`
- **POST /api/admin/deploy**
  - Action: Trigger a new deploy
- **POST /api/admin/rollback**
  - Body: `{ deployId: string }`
  - Action: Roll back to a previous deploy

### 4. API Key Management
- **GET /api/admin/api-keys**
  - Returns: `[ { key: string, createdAt: string, lastUsedAt?: string, revoked: boolean } ]`
- **POST /api/admin/api-keys**
  - Body: `{ description?: string }`
  - Action: Create a new API key
- **DELETE /api/admin/api-keys/:key**
  - Action: Revoke an API key

---

## Extensibility Tab

### 1. Plugin Management
- **GET /api/admin/plugins**
  - Returns: `[ { name: string, enabled: boolean, version: string, description?: string } ]`
- **POST /api/admin/plugins/install**
  - Body: `{ name: string }`
- **POST /api/admin/plugins/enable**
  - Body: `{ name: string }`
- **POST /api/admin/plugins/disable**
  - Body: `{ name: string }`
- **DELETE /api/admin/plugins/:name**
  - Action: Remove a plugin

### 2. Webhook/Automation Triggers
- **GET /api/admin/webhooks**
  - Returns: `[ { id: string, url: string, event: string, enabled: boolean } ]`
- **POST /api/admin/webhooks**
  - Body: `{ url: string, event: string }`
- **POST /api/admin/webhooks/enable**
  - Body: `{ id: string }`
- **POST /api/admin/webhooks/disable**
  - Body: `{ id: string }`
- **DELETE /api/admin/webhooks/:id**
  - Action: Remove a webhook

---

## Broadcast Tab

### 1. Scheduling
- **POST /api/admin/broadcast/schedule**
  - Body: `{ message: string, sendAt: string (ISO8601) }`
  - Action: Schedule a broadcast

### 2. Targeting
- **POST /api/admin/broadcast/target**
  - Body: `{ message: string, segment: string }` (e.g., 'all', 'admins', 'pro', 'free')
  - Action: Send broadcast to a segment

---

## General Notes
- All endpoints should require admin authentication (e.g., Bearer token).
- Return clear success/error responses: `{ success: true, ... }` or `{ success: false, error: string }`
- Use ISO8601 for all timestamps.

---

Once these endpoints are available, the admin console UI can be fully wired for real, actionable controls and data.
