### Content Model: Project (`project`)

#### Purpose
Content entries of type “Project”. Links: gallery, techs.

#### Fields
- **title** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Title
- **slug** (`Symbol`)
  - required: **yes**
  - validations: `none`
  - description: Slug
- **description** (`Symbol`)
  - required: **no**
  - validations: `none`
  - description: Description
- **gallery** (`Array` (items: Link Entry))
  - required: **yes**
  - validations: `none`
  - description: Gallery
- **makingOf** (`RichText`)
  - required: **no**
  - validations: `{"enabledMarks":["bold","italic","underline","code","superscript","subscript","strikethrough"],"message":"Only bold, italic, underline, code, superscript, subscript, and strikethrough marks are allowed"}, {"enabledNodeTypes":["heading-1","heading-2","heading-3","heading-4","heading-5","heading-6","ordered-list","unordered-list","hr","blockquote","embedded-entry-block","embedded-asset-block","asset-hyperlink","embedded-entry-inline","entry-hyperlink","hyperlink","table"],"message":"Only heading 1, heading 2, heading 3, heading 4, heading 5, heading 6, ordered list, Unordered list, horizontal rule, quote, block entry, asset, link to asset, inline entry, link to entry, link to Url, and table nodes are allowed"}, {"nodes":{}}`
  - description: Making Of
- **techs** (`Array` (items: Link Entry))
  - required: **no**
  - validations: `none`
  - description: Techs

#### Relationships
- **gallery**: entry link · array · targets: `imageAsset`,- **techs**: entry link · array · targets: `tech`

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
    "id": "3nckjIdsP3yjqZeY6Mhku7",
    "type": "Entry",
    "createdAt": "2026-02-02T03:22:45.672Z",
    "updatedAt": "2026-04-13T17:52:56.305Z",
    "environment": {
      "sys": {
        "id": "master",
        "type": "Link",
        "linkType": "Environment"
      }
    },
    "publishedVersion": 88,
    "publishedAt": "2026-04-13T17:52:56.305Z",
    "firstPublishedAt": "2026-02-02T03:36:26.074Z",
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
    "publishedCounter": 21,
    "version": 89,
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
        "id": "project"
      }
    },
    "urn": "crn:contentful:::content:spaces/01x0it4nypq8/environments/master/entries/3nckjIdsP3yjqZeY6Mhku7"
  },
  "fields": {
    "title": {
      "en-US": "2024"
    },
    "slug": {
      "en-US": "2024"
    },
    "description": {
      "en-US": "A curated selection of drawings made during 2024. A curated selection of drawings made during 2024. A curated selection of drawings made during 2024. A curated selection of drawings made during 2024. A curated selection of drawings made during 2024."
    },
    "gallery": {
      "en-US": [
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "4rH4mi6uuxBlzOQruLHoDC"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "4rzxIFVC186PEtmMIrO7rb"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "7ptw29xT6KfPr8Acdf2mqF"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "5GTt7xxABnigpYsrqwJIVY"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "68Ywlp70zqzF2NvV9QJP27"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "5GKtVWsrrP7A0gQUptVEU9"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "5RaNqrE1FohHlkAJIfuAkJ"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "49GelqUtCf4r1CLPV3Buz2"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "4RLjs1tJoUcC3T2KKRMd85"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "Snnk4m9ziwjH6g9DBsSYo"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "6nbfB9ZHyGr4XXFS7lSxuj"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "2JwkigqFxfjG0STOfZd5jK"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "UHjtHv3cA50FWJQAHZLhS"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "2vTYtPLPTLyKYEqtkBfZc7"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "61GgmOTdxtas8wH6ZINuoF"
          }
        }
      ]
    },
    "makingOf": {
      "en-US": {
        "data": {},
        "content": [
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "The Evolution of Digital Art: A 2025 Perspective",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-2"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          },
          {
            "data": {
              "target": {
                "sys": {
                  "id": "1bKBGJEtRDeAoyap8eVnsr",
                  "type": "Link",
                  "linkType": "Asset"
                }
              }
            },
            "content": [],
            "nodeType": "embedded-asset-block"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "marks": [],
                    "value": "Duis aute irure dolor in reprehenderit in voluptate ",
                    "nodeType": "text"
                  },
                  {
                    "data": {},
                    "marks": [
                      {
                        "type": "italic"
                      }
                    ],
                    "value": "velit esse cillum dolore eu fugiat nulla pariatur",
                    "nodeType": "text"
                  }
                ],
                "nodeType": "paragraph"
              }
            ],
            "nodeType": "blockquote"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-2"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-3"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Digital brush ",
                        "nodeType": "text"
                      },
                      {
                        "data": {},
                        "marks": [
                          {
                            "type": "bold"
                          }
                        ],
                        "value": "manipulation",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Color theory application",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Light and shadow dynamics",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Texture layering",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Compositional balance",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              }
            ],
            "nodeType": "unordered-list"
          },
          {
            "data": {
              "target": {
                "sys": {
                  "id": "3m8EhJBciBC6hyP8yrPkkZ",
                  "type": "Link",
                  "linkType": "Asset"
                }
              }
            },
            "content": [],
            "nodeType": "embedded-asset-block"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat ",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [
                  {
                    "type": "underline"
                  }
                ],
                "value": "cupidatat",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [],
                "value": " non proident, sunt in culpa qui",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [
                  {
                    "type": "bold"
                  }
                ],
                "value": " officia deserunt mollit anim id est labo",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [],
                "value": "rum.",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "",
                "nodeType": "text"
              },
              {
                "data": {
                  "uri": "https://www.instagram.com/"
                },
                "content": [
                  {
                    "data": {},
                    "marks": [],
                    "value": "Esto es un link",
                    "nodeType": "text"
                  }
                ],
                "nodeType": "hyperlink"
              },
              {
                "data": {},
                "marks": [],
                "value": "",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Duis aute irure dolor in r",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [
                  {
                    "type": "underline"
                  }
                ],
                "value": "eprehenderit in voluptate velit esse cillum",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [],
                "value": " dolore eu fugiat nulla pariatur. Excepteur sint occaecat cu",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [
                  {
                    "type": "bold"
                  }
                ],
                "value": "pidatat non proident, sunt in culpa qui",
                "nodeType": "text"
              },
              {
                "data": {},
                "marks": [],
                "value": " officia deserunt mollit anim id est laborum.",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Digital brush ",
                        "nodeType": "text"
                      },
                      {
                        "data": {},
                        "marks": [
                          {
                            "type": "bold"
                          }
                        ],
                        "value": "manipulation",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Color theory application",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Light and shadow dynamics",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Texture layering",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "marks": [],
                        "value": "Compositional balance",
                        "nodeType": "text"
                      }
                    ],
                    "nodeType": "paragraph"
                  }
                ],
                "nodeType": "list-item"
              }
            ],
            "nodeType": "ordered-list"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-2"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-3"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-4"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-5"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "Key Techniques Used",
                "nodeType": "text"
              }
            ],
            "nodeType": "heading-6"
          },
          {
            "data": {},
            "content": [],
            "nodeType": "hr"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "content": [
                          {
                            "data": {},
                            "marks": [],
                            "value": "lalallaa",
                            "nodeType": "text"
                          }
                        ],
                        "nodeType": "paragraph"
                      }
                    ],
                    "nodeType": "table-header-cell"
                  },
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "content": [
                          {
                            "data": {},
                            "marks": [],
                            "value": "asasasas",
                            "nodeType": "text"
                          }
                        ],
                        "nodeType": "paragraph"
                      }
                    ],
                    "nodeType": "table-header-cell"
                  }
                ],
                "nodeType": "table-row"
              },
              {
                "data": {},
                "content": [
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "content": [
                          {
                            "data": {},
                            "marks": [],
                            "value": "asasasas",
                            "nodeType": "text"
                          }
                        ],
                        "nodeType": "paragraph"
                      }
                    ],
                    "nodeType": "table-cell"
                  },
                  {
                    "data": {},
                    "content": [
                      {
                        "data": {},
                        "content": [
                          {
                            "data": {},
                            "marks": [],
                            "value": "asasasasas",
                            "nodeType": "text"
                          }
                        ],
                        "nodeType": "paragraph"
                      }
                    ],
                    "nodeType": "table-cell"
                  }
                ],
                "nodeType": "table-row"
              }
            ],
            "nodeType": "table"
          },
          {
            "data": {},
            "content": [
              {
                "data": {},
                "marks": [],
                "value": "",
                "nodeType": "text"
              }
            ],
            "nodeType": "paragraph"
          }
        ],
        "nodeType": "document"
      }
    },
    "techs": {
      "en-US": [
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "46B0NIWSyEm9YVlOFyoVPv"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "2KcIejZZnsstED2ykLnSZk"
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
