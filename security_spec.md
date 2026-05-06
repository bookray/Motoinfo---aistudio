# Firestore Security Specification - TeleGuard

## Data Invariants
1. **User Identity**: Every document in `/users` represents a dashboard administrator. Roles are immutable except by a `SUPER_ADMIN`.
2. **Relational Integrity**: `chat_bans` and `memberships` must refer to valid `chatId`s.
3. **Audit Trail**: `logs` are append-only. Existing logs cannot be modified or deleted.
4. **Access Control**: Only the bootstrapped Super Admin (`bookray1114@gmail.com`) can perform initial setup and elevated system configuration.

## The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a user profile with role `SUPER_ADMIN` as an unauthenticated user.
2. **Privilege Escalation**: An `ADVERTISER` attempting to update their own role to `SUPER_ADMIN`.
3. **Ghost Field Injection**: Adding a field `isSystemVerified: true` to a chat document.
4. **ID Poisoning**: Creating a chat with a 2KB long ID string.
5. **Timestamp Fraud**: Setting a future `createdAt` date manually instead of `request.time`.
6. **Orphaned Record**: Creating a `chat_ban` for a non-existent `chatId`.
7. **Negative Resource Exhaustion**: Setting `messagesSent` to `-1,000,000`.
8. **PII Leak**: An `ADVERTISER` attempting to `list` all documents in the `users` collection.
9. **State Shortcut**: Changing a task's `lastRun` without actually running it (if checked by system).
10. **Shadow Update**: Updating a log entry message after it was created.
11. **Email Spoofing**: Matching the admin email but with `email_verified: false`.
12. **Blanket Read Attack**: Querying `/bans` without any filters as a guest.

## Test Runner Plan
I will implement `firestore.rules.test.ts` to verify these payloads are rejected.
