# Firestore Security Specification — Watch me Darling

## 1. Data Invariants
1. Every document under `/users/{userId}` and `/users/{userId}/private/{docId}` belongs strictly to the authenticated and verified user whose Firebase Auth UID matches `{userId}` and `request.resource.data.uid`.
2. Unverified users (neither `request.auth.token.email_verified == true` nor a verified Firebase Phone Auth `request.auth.token.phone_number`) cannot create, read, or update user records or private contact documents.
3. All PII (`email`, `phoneNumber`) is isolated inside `/users/{userId}/private/contact` and never stored on `/users/{userId}`.
4. `ageVerified18Plus` must always be `true` and `verified` must always be `true`.
5. `uid` and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
6. Top-level `list` queries on `/users` are strictly limited to `resource.data.uid == request.auth.uid` (no cross-user enumeration).
7. No ghost fields are permitted: strict `keys().hasAll(...) && keys().hasOnly(...)` on `create` and `affectedKeys().hasOnly(...)` on `update`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: `POST /users/uid123` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Account**: `POST /users/uid123` where `request.auth.uid == 'uid123'`, `email_verified == false`, and `phone_number == null` -> `PERMISSION_DENIED`.
3. **Cross-User Read (PII Leak)**: `GET /users/otherUid/private/contact` as `uid123` -> `PERMISSION_DENIED`.
4. **UID Spoofing on Create**: `POST /users/uid123` where `data.uid == 'victimUid'` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: `POST /users/uid123` containing extra key `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Underage Bypass Attempt**: `POST /users/uid123` with `ageVerified18Plus: false` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: `POST /users/uid123` with client-supplied past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: `UPDATE /users/uid123` attempting to change `uid` or `createdAt` -> `PERMISSION_DENIED`.
9. **Oversized String DoW Attack**: `POST /users/uid123` with 20KB `displayName` -> `PERMISSION_DENIED`.
10. **Invalid Private Doc ID**: `POST /users/uid123/private/evil_doc_id` -> `PERMISSION_DENIED` (only `contact` allowed).
11. **Collection Enumeration (`list`)**: `LIST /users` without `where('uid', '==', auth.uid)` -> `PERMISSION_DENIED`.
12. **PII Leak in Public Profile**: `POST /users/uid123` attempting to attach `email` or `phoneNumber` -> `PERMISSION_DENIED`.
