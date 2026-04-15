### Content Model: Navigation Group (`navigationGroup`)

#### Purpose
Items del Sidebar por Proyecto. Links: items.

#### Fields
- **title** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Title
- **items** (`Array` (items: Link Entry))
  - required: **no**
  - validations: `none`
  - description: Items

#### Relationships
- **items**: entry link · array · targets: `project`

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
    "id": "1Rv05h4KWswcn4GxCPLzx7",
    "type": "Entry",
    "createdAt": "2026-02-02T03:38:17.209Z",
    "updatedAt": "2026-04-11T03:11:07.694Z",
    "environment": {
      "sys": {
        "id": "master",
        "type": "Link",
        "linkType": "Environment"
      }
    },
    "publishedVersion": 8,
    "publishedAt": "2026-04-11T03:11:07.694Z",
    "firstPublishedAt": "2026-02-02T03:39:40.119Z",
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
    "publishedCounter": 3,
    "version": 9,
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
        "id": "navigationGroup"
      }
    },
    "urn": "crn:contentful:::content:spaces/01x0it4nypq8/environments/master/entries/1Rv05h4KWswcn4GxCPLzx7"
  },
  "fields": {
    "title": {
      "en-US": "Selection"
    },
    "items": {
      "en-US": [
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "3nckjIdsP3yjqZeY6Mhku7"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "6TzmqN4Gq68IA3LF9p4S1j"
          }
        }
      ]
    }
  }
}
```

#### Usage in Frontend
- List view: show key fields and status (draft/published).
- Edit view: schema-driven form mapped from Contentful field definitions.
- Relations: resolve entry/asset links via Management API lookups.
