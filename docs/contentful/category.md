### Content Model: Sidebar items (`category`)

#### Purpose
Items del Navbar: Project (Items simples) / Navigation Group (Items expandibles). Links: projectsTree.

#### Fields
- **title** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Title
- **slug** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Slug
- **order** (`Integer`)
  - required: **no**
  - validations: `none`
  - description: Order
- **projectsTree** (`Array` (items: Link Entry))
  - required: **no**
  - validations: `none`
  - description: Projects Tree

#### Relationships
- **projectsTree**: entry link · array · targets: `project`, `navigationGroup`

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
    "id": "6U4nbciAHTM0FP4iSjIWGE",
    "type": "Entry",
    "createdAt": "2026-02-02T03:39:51.492Z",
    "updatedAt": "2026-04-11T04:36:43.335Z",
    "environment": {
      "sys": {
        "id": "master",
        "type": "Link",
        "linkType": "Environment"
      }
    },
    "publishedVersion": 17,
    "publishedAt": "2026-04-11T04:36:43.335Z",
    "firstPublishedAt": "2026-02-02T03:45:39.869Z",
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
    "publishedCounter": 7,
    "version": 18,
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
        "id": "category"
      }
    },
    "urn": "crn:contentful:::content:spaces/01x0it4nypq8/environments/master/entries/6U4nbciAHTM0FP4iSjIWGE"
  },
  "fields": {
    "title": {
      "en-US": "Drawings"
    },
    "slug": {
      "en-US": "drawings"
    },
    "order": {
      "en-US": 1
    },
    "projectsTree": {
      "en-US": [
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "1Rv05h4KWswcn4GxCPLzx7"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "Ws9hljRPiSmWig0zUDwSZ"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "4mwOdcZ6sOPmaRjqNCx5Le"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "1uOnudCSdANsJZSWsR450v"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "ErlW6UE6wPiRdbZffXMje"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "3kVC5FGNSa9oTTSlPLWpuw"
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
