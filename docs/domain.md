# EvilSpins Domain Model

## Card

`Card` is a shared business concept represented differently in the frontend
and backend.

### Backend representation

Source:
`evilspins.data/src/types.ts`

The backend `Card` represents the persisted/data-oriented representation.

Fields:
...

### Frontend representation

Source:
`evilspins.user/types/types.ts`

The frontend `Card` represents the client/UI-oriented representation.

Fields:
...

### Relationship

The two interfaces are distinct types.

They share several business concepts but are not structurally identical.

There is currently no explicit type conversion layer between them.

Important differences include:

- `month`, `day`, `hour`: backend numbers, frontend strings
- backend contains persistence/file metadata
- frontend contains UI/media-oriented properties
- frontend uses `createdAt`
- backend uses `created_at` and `updated_at`

Do not assume that the two `Card` interfaces can be substituted for each other.
