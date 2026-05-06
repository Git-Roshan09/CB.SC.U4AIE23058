# Notification System Design

## Stage 1

This is the design of REST APIs for a notification platform where students get updates about Placements, Events, and Results.
---
When a student logs in, they should be able to:
- See all their notifications
- Know how many are unread
- Mark a notification as read (one at a time or all at once)
- Get new notifications in real time without refreshing the page

---

### The API Endpoints I designed

**Getting notifications**

```
GET /api/notifications
Authorization: Bearer <token>
```

This returns the list of notifications for the logged-in student. I added optional filters so the frontend can show only Placement notifications, or only unread ones, etc.

Query params:
- `type` — filter by "Placement", "Event", or "Result"
- `isRead` — true or false
- `page` and `limit` — for pagination so we don't load 1000 notifications at once

Response:
```json
{
  "notifications": [
    {
      "id": "--uuid--",
      "type": "Placement",
      "message": "Affordmed hiring drive on May 6th",
      "isRead": false,
      "createdAt": "--timing--"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

---

**Getting the unread count**

```
GET /api/notifications/unread/count
Authorization: Bearer <token>
```

This is a lightweight call — just returns a number. The frontend can show a badge like "12 unread" without fetching all notifications.

Response:
```json
{
  "unreadCount": 12
}
```

---

**Marking one notification as read**

```
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Notification marked as read",
  "id": "uuid"
}
```

---

**Marking all notifications as read**

```
PUT /api/notifications/read-all
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "All notifications marked as read",
  "updatedCount": 12  #initially 12 unread, now all are read
}
```

---

**Creating a notification (admin only)**

```
POST /api/notifications
Authorization: Bearer <admin-token>
```

Request body:
```json
{
  "studentIds": ["id1", "id2"],
  "type": "Placement",
  "message": "Affordmed hiring drive on May 6th"
}
```

Response:
```json
{
  "message": "Notifications created",
  "count": 2
}
```

---

**Deleting a notification**

```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Notification deleted"
}
```

---

### Real-time notifications

For real-time delivery, I'd use Server-Sent Events (SSE). The reason I picked SSE over WebSockets is simple — notifications only flow one way, from the server to the student. WebSockets make sense when the client also needs to send data back (like a chat app). SSE is lighter and works over plain HTTP.

```
GET /api/notifications/stream
Authorization: Bearer <token>
Content-Type: text/event-stream
```

When a new notification is created for a student, the server pushes it through the open SSE connection right away — no polling needed.

---

## Stage 2

Now that the APIs are designed, I need to pick a database and set up the schema to store everything reliably.

### Why I chose PostgreSQL

I went with PostgreSQL because notifications are relational by nature — each notification belongs to a student, has a type, a read status, and a timestamp. These are exactly the kinds of things that relational databases handle well.

MongoDB crossed my mind, but the problem with it here is that as data grows, querying "all unread notifications for student X, ordered by date" becomes complex without proper schema structure. PostgreSQL handles this cleanly with indexes and joins.

Also, PostgreSQL gives ACID guarantees which means no notification gets lost halfway through a write — that matters a lot when you're sending to 50,000 students at once.

### Schema

```sql
CREATE TABLE students (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)        NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMP           DEFAULT NOW()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY    DEFAULT gen_random_uuid(),
  student_id  INTEGER             NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        VARCHAR(50)         NOT NULL CHECK (type IN ('Placement', 'Event', 'Result')),
  message     TEXT                NOT NULL,
  is_read     BOOLEAN             DEFAULT false,
  created_at  TIMESTAMP           DEFAULT NOW()
);
```

### Queries for each API

For fetching paginated notifications:
```sql
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

For unread count:
```sql
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE student_id = $1 AND is_read = false;
```

For marking one as read:
```sql
UPDATE notifications
SET is_read = true
WHERE id = $1 AND student_id = $2;
```

For marking all as read:
```sql
UPDATE notifications
SET is_read = true
WHERE student_id = $1 AND is_read = false;
```

For bulk insert (sending to many students):
```sql
INSERT INTO notifications (student_id, type, message)
SELECT unnest($1::int[]), $2, $3;
```

### Problems that will come up as data grows

With 50,000 students and millions of notifications, a few things will start breaking:

- **Slow reads** — without indexes, every query does a full table scan. At 5 million rows this gets very slow.
- **Table getting too large** — old notifications pile up. You'd want to archive or partition the table by month.
- **Write bottlenecks** — sending to 50,000 students at once means 50,000 inserts. That needs to be done in bulk or via a queue, not one by one.

---

## Stage 3

The slow query in docs:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

### about how accurate it is?

The logic is correct  it's fetching unread notifications for a specific student, sorted newest first. But there are two problems with it.

First, `SELECT *` fetches every column including the full message text for every row. That's a lot of unnecessary data being moved around.

Second and more importantly, there's no index on `studentID`, `isRead`, or `createdAt`. So when this query runs on a table with 5 million rows, the database reads every single row, checks if it matches, and then sorts the results. That's an O(n) scan — slow and gets worse as data grows. At 5 million rows this could easily take 2–5 seconds per request.

### Should we index every column?

No, that's bad advice. Indexes speed up reads but they slow down writes  every INSERT or UPDATE also has to update the index. If we're inserting notifications for 50,000 students at once and every column is indexed, each insert becomes much heavier. We'd trade fast reads for very slow writes, which is the wrong tradeoff here.

Only index the columns you actually filter and sort on.

### Optimized version

First, create a composite index:

```sql
CREATE INDEX idx_notifications_student_read_date
ON notifications (student_id, is_read, created_at DESC);
```

This single index covers the WHERE clause and the ORDER BY in one shot. The database goes directly to the matching rows instead of scanning everything.

Then rewrite the query to only select what's needed:

```sql
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC;
```

With this index, what was a 2–5 second scan becomes a sub-10ms lookup. That's the difference between a bad user experience and a fast one.

### Finding all students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM notifications n
JOIN students s ON n.student_id = s.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

To support this query efficiently:

```sql
CREATE INDEX idx_notifications_type_date
ON notifications (type, created_at DESC);
```

---

## Stage 4

The problem here is that every time a student loads the page, the app hits the database for their notifications. At 50,000 students this means the database is getting hammered constantly, causing slow responses and bad user experience.

### What I'd suggest

**Redis caching** is the most effective fix. The idea is simple — the first time a student loads their notifications, we fetch from the database and store the result in Redis with a short TTL (say 60 seconds). Every request within that 60 seconds gets served from Redis, not the database.

```
Request comes in
  → Check Redis for this student's notifications
  → Cache hit?  Return immediately (no DB query)
  → Cache miss? Query DB, store in Redis, return result
```

The tradeoff is that notifications might be up to 60 seconds stale. That's usually acceptable for a notification feed. When a new notification is created for a student, we just delete their cache key so the next request gets fresh data.

**Pagination** is the second thing I'd add. Right now the query probably loads all notifications at once. Loading just the first 10 or 20 makes each query faster and lighter on the DB.

**Read replicas** are the third option for when traffic really scales — route all read queries to a replica and writes to the primary. The downside is replication lag and extra infrastructure cost, but at large scale it's worth it.

In practice I'd combine all three: Redis for caching the unread count (which is the most frequent and cheapest query), pagination to keep result sizes small, and a read replica once the traffic justifies it.

---

## Stage 5

Looking at the `notify_all` function:

```python
function notify_all(student_ids: array, message: string):
  for student_id in student_ids:
    send_email(student_id, message)
    save_to_db(student_id, message)
    push_to_app(student_id, message)
```

### What's wrong with this

The biggest problem is that it processes students one by one in a loop. If each student takes even 100ms (which is fast for an email API), 50,000 students = 83 minutes. That's completely unusable.

The second issue is fault tolerance. The logs showed that `send_email` failed at student 200. Since it's a loop with no error handling, those remaining 49,800 students never got their notification. There's no retry, no way to know who got it and who didn't.

The third issue is that the DB save and email are coupled together in the same loop. The email API is external and slow. The DB insert is local and fast. Mixing them means the DB also slows down whenever the email API is slow. They should be completely independent.

### Should DB save and email happen together?

No, they shouldn't. Save to DB first — that's fast and reliable. Sending email is a separate concern that can fail independently. If you save to DB and then the email fails, you know exactly which notifications are saved and can retry just the email part. If they're coupled and the email fails midway, you don't know which DB records are "safe" without checking each one.

### How I'd redesign it

```
notify_all(student_ids, message)
  │
  ├─ Step 1: Bulk insert ALL notifications into DB in one query
  │           Fast, atomic — either all succeed or none do
  │
  └─ Step 2: Push each student_id into an email job queue
              │
              └─ Background workers pick jobs from the queue
                   → send_email()     → retry up to 3 times if it fails
                   → push_to_app()   → retry up to 3 times if it fails
```

Revised pseudocode:

```python
function notify_all(student_ids, message, type):
  # One bulk insert — much faster than 50,000 individual inserts
  bulk_insert_notifications(student_ids, message, type)

  # Queue jobs for async processing — this returns immediately
  for student_id in student_ids:
    email_queue.push({ student_id, message })
    push_queue.push({ student_id, message })

# Workers run in parallel (can have 50 workers running at the same time)
function email_worker():
  job = email_queue.pop()
  try:
    send_email(job.student_id, job.message)
    mark_email_sent(job.student_id)
  except:
    email_queue.retry(job, max_attempts=3)
```

With 50 workers running in parallel, 50,000 students get emailed in roughly 100 seconds instead of 83 minutes. Failed emails are retried automatically. The DB is updated immediately and independently of whatever the email API is doing.

---

## Stage 6

### What I built

I built a `GET /notifications/priority` endpoint that fetches all notifications from the API, scores each one based on importance and freshness, and returns the top 10 in ranked order.

The code lives in the `notification_app_be/` folder.

### How I decided what "priority" means

Two things determine how important a notification is — what type it is, and how recent it is.

For type, I gave each category a weight:
- Placement → 3 (most important, directly affects career)
- Result → 2
- Event → 1 (least urgent)

For recency, I used a decay formula. A notification from 0 hours ago gets a multiplier of 1.0. One from 24 hours ago gets about 0.04. The older it is, the less it matters.

```
priority_score = type_weight × (1 / (1 + hours_since_notification))
```

So a very recent Result can outrank an old Placement, which feels right — if a company posted a hiring notice 3 days ago it matters less than your exam result from an hour ago.

### How I maintain the top 10 efficiently — Min-Heap

The naive approach would be to score all notifications and sort them. That works but it's O(n log n) and gets expensive as notifications pile up. It also doesn't scale well if notifications are arriving in a stream.

Instead I used a min-heap of fixed size 10.

A min-heap always keeps the smallest element at the top. I use this to my advantage:

```
For each notification coming in:
  1. Compute its priority score
  2. If the heap has fewer than 10 items → add it directly
  3. If the heap already has 10 items:
       → Compare score with the heap root (the lowest score in our current top 10)
       → If new score is higher → remove the root, add this notification
       → If new score is lower → skip it, it doesn't make the top 10
```

After going through all notifications, the heap holds exactly the 10 highest-scored ones. I then sort those 10 to get the final ranked list.

The benefit is that each notification takes O(log 10) time which is basically constant. So the total time is O(n) regardless of how many notifications exist. And if new notifications keep streaming in, I can keep comparing them against the heap root without ever reprocessing old ones.

### The API response

```
GET /notifications/priority
```

```json
{
  "success": true,
  "count": 10,
  "notifications": [
    {
      "rank": 1,
      "priorityScore": 0.3989,
      "id": "--uuid--",
      "type": "Placement",
      "message": "Affordmed Corporation hiring",
      "timestamp": "--timing--"
    }
  ]
}
```

---
