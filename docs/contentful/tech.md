### Content Model: Tech (`tech`)

#### Purpose
Tecnologías usadas en cada proyecto (Pencil, PS, Procreate).

#### Fields
- **name** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Name
- **slug** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Slug
- **order** (`Integer`)
  - required: **no**
  - validations: `none`
  - description: Order

#### Relationships
—

#### Example Entry
```json
{
  "sys": {
    "space": {
      "sys": {
        "type": "Link",
        "linkType": "Space",
        "id": "01x0it4nypq8"
      }
    },
    "id": "46B0NIWSyEm9YVlOFyoVPv",
    "type": "Entry",
    "createdAt": "2026-02-02T03:10:18.301Z",
    "updatedAt": "2026-02-02T03:12:00.799Z",
    "environment": {
      "sys": {
        "id": "master",
        "type": "Link",
        "linkType": "Environment"
      }
    },
    "publishedVersion": 3,
    "publishedAt": "2026-02-02T03:12:00.799Z",
    "firstPublishedAt": "2026-02-02T03:12:00.799Z",
    "createdBy": {
      "sys": {
        "type": "Link",
        "linkType": "User",
        "id": "032kKEUOIBl7YsoftcvCuS"
      }
    },
    "updatedBy": {
      "sys": {
        "type": "Link",
        "linkType": "User",
        "id": "032kKEUOIBl7YsoftcvCuS"
      }
    },
    "publishedCounter": 1,
    "version": 4,
    "publishedBy": {
      "sys": {
        "type": "Link",
        "linkType": "User",
        "id": "032kKEUOIBl7YsoftcvCuS"
      }
    },
    "fieldStatus": {
      "*": {
        "en-US": "published"
      }
    },
    "automationTags": [],
    "contentType": {
      "sys": {
        "type": "Link",
        "linkType": "ContentType",
        "id": "tech"
      }
    },
    "urn": "crn:contentful:::content:spaces/01x0it4nypq8/environments/master/entries/46B0NIWSyEm9YVlOFyoVPv"
  },
  "fields": {
    "name": {
      "en-US": "Pencil"
    },
    "slug": {
      "en-US": "pencil"
    },
    "order": {
      "en-US": 1
    }
  }
}
```

#### Usage in Frontend
- List view: show key fields and status (draft/published).
- Edit view: schema-driven form mapped from Contentful field definitions.
- Relations: resolve entry/asset links via Management API lookups.
