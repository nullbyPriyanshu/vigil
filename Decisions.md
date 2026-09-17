1. During signup the user will be notified if the org name already exists (For slug).
   Add a tiny public endpoint later:
   GET /v1/organization/name-available?name=Acme%20Corp
   { available: false, slug: "acme-corp" }

2. Deleting an org leaves orphaned users so we can alert them "You dont belong to any org".