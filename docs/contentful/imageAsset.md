### Content Model: ImageAsset (`imageAsset`)

#### Purpose
Cada imagen de galería como entidad independiente (clave para lightbox, share, order). Links: image.

#### Fields
- **title** (`Symbol`)
  - required: **no**
  - validations: `none`
  - description: Title
- **slug** (`Symbol`)
  - required: **yes**
  - validations: `{"unique":true}`
  - description: Slug
- **image** (`Link:Asset`)
  - required: **yes**
  - validations: `none`
  - description: Image
- **alt** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Alt

#### Relationships
- **image**: asset link · single · targets: Asset

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
    "id": "4rH4mi6uuxBlzOQruLHoDC",
    "type": "Entry",
    "createdAt": "2026-02-02T03:15:35.597Z",
    "updatedAt": "2026-02-16T04:39:06.420Z",
    "environment": {
      "sys": {
        "id": "master",
        "type": "Link",
        "linkType": "Environment"
      }
    },
    "publishedVersion": 7,
    "publishedAt": "2026-02-16T04:39:06.420Z",
    "firstPublishedAt": "2026-02-02T03:20:36.196Z",
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
    "publishedCounter": 2,
    "version": 8,
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
        "id": "imageAsset"
      }
    },
    "urn": "crn:contentful:::content:spaces/01x0it4nypq8/environments/master/entries/4rH4mi6uuxBlzOQruLHoDC"
  },
  "fields": {
    "title": {
      "en-US": "Image 1"
    },
    "slug": {
      "en-US": "image-1"
    },
    "image": {
      "en-US": {
        "sys": {
          "type": "Link",
          "linkType": "Asset",
          "id": "4toKliZ1l4EKvkPPTP8aTr"
        }
      }
    },
    "alt": {
      "en-US": "Black men sitting"
    }
  }
}
```

#### Usage in Frontend
- List view: show key fields and status (draft/published).
- Edit view: schema-driven form mapped from Contentful field definitions.
- Relations: resolve entry/asset links via Management API lookups.
