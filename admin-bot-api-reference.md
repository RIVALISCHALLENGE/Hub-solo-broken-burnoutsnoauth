# 📡 Admin & Bot Management API Reference

## Bot Management

### List All Bots
**GET** `/api/bots`
- Returns: `[ { botId, name, avatar, stats, ... } ]`

### Update Bot Stats
**POST** `/api/bots/:botId`
- Body: `{ stats: { ... } }`
- Returns: `{ success: true }`

### Force Bot to Join a Session
**POST** `/api/bots/:botId/join`
- Returns: `{ success: true, message: string }`

### Force Bot to Leave a Session
**POST** `/api/bots/:botId/leave`
- Returns: `{ success: true, message: string }`

### Update Bot Config
**POST** `/api/bots/:botId/config`
- Body: `{ config: { ... } }`
- Returns: `{ success: true }`

---

## System Tab

### Performance Metrics
**GET** `/api/admin/performance`
- Returns: `{ cpu, memory, uptime, reqPerMin, success }`

### Feature Flags
**GET** `/api/admin/feature-flags`
- Returns: `[ { key, enabled, description? } ]`

**POST** `/api/admin/feature-flags`
- Body: `{ key, enabled, description? }`
- Returns: `{ success: true }`

**DELETE** `/api/admin/feature-flags/:key`
- Returns: `{ success: true }`

### Deploy/Rollback
**GET** `/api/admin/deploys`
- Returns: `[ { id, status, startedAt, finishedAt? } ]`

**POST** `/api/admin/deploy`
- Returns: `{ success: true, id }`

**POST** `/api/admin/rollback`
- Body: `{ deployId }`
- Returns: `{ success: true }`

### API Key Management
**GET** `/api/admin/api-keys`
- Returns: `[ { key, createdAt, lastUsedAt?, revoked } ]`

**POST** `/api/admin/api-keys`
- Body: `{ description? }`
- Returns: `{ success: true, key }`

**DELETE** `/api/admin/api-keys/:key`
- Returns: `{ success: true }`

---

## Extensibility Tab

### Plugin Management
**GET** `/api/admin/plugins`
- Returns: `[ { name, enabled, version, description? } ]`

**POST** `/api/admin/plugins/install`
- Body: `{ name }`
- Returns: `{ success: true }`

**POST** `/api/admin/plugins/enable`
- Body: `{ name }`
- Returns: `{ success: true }`

**POST** `/api/admin/plugins/disable`
- Body: `{ name }`
- Returns: `{ success: true }`

**DELETE** `/api/admin/plugins/:name`
- Returns: `{ success: true }`

### Webhook/Automation Triggers
**GET** `/api/admin/webhooks`
- Returns: `[ { id, url, event, enabled } ]`

**POST** `/api/admin/webhooks`
- Body: `{ url, event }`
- Returns: `{ success: true, id }`

**POST** `/api/admin/webhooks/enable`
- Body: `{ id }`
- Returns: `{ success: true }`

**POST** `/api/admin/webhooks/disable`
- Body: `{ id }`
- Returns: `{ success: true }`

**DELETE** `/api/admin/webhooks/:id`
- Returns: `{ success: true }`

---

## Broadcast Tab

### Schedule a Broadcast
**POST** `/api/admin/broadcast/schedule`
- Body: `{ message, sendAt }`
- Returns: `{ success: true }`

### Targeted Broadcast
**POST** `/api/admin/broadcast/target`
- Body: `{ message, segment }`
- Returns: `{ success: true }`

---

**All endpoints require admin authentication (Bearer token). All timestamps are ISO8601. All responses are JSON.**
---

## Payments (Stripe Integration)

### Create Checkout Session
**POST** `/api/payments/checkout`


**Example:**
 Body: `{ priceId: "<priceId>", userId }`
 Returns: `{ success: true, sessionUrl }`

Valid price IDs:
	- `price_1T1XanJzhejoQ9C7S6D7XbwU`
	- `price_1T1XakJzhejoQ9C71HH5Bnv1`
	- `price_1T1XamJzhejoQ9C7wyhVRcHv`
    - `price_1T1XalJzhejoQ9C71ihd5lV6`

Use any of the above Stripe price IDs to create a checkout session for payments. The backend will handle session creation and return a Stripe-hosted checkout URL.

**Example:**

```json
{
	"priceId": "price_1T1XanJzhejoQ9C7S6D7XbwU",
	"userId": "user_123"
}
```

**Response:**

```json
{
	"success": true,
	"sessionUrl": "https://checkout.stripe.com/pay/cs_test_..."
}
```
