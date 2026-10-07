1. During signup the user will be notified if the org name already exists (For slug).
   Add a tiny public endpoint later:
   GET /v1/organization/name-available?name=Acme%20Corp
   { available: false, slug: "acme-corp" }

2. Deleting an org leaves orphaned users so we can alert them "You dont belong to any org".

3. No rate limiting yet.** Someone could try many passwords quickly. Adding
   `@nestjs/throttler` to `/login` and `/forgot-password` is the next
   improvement.

4. One incident per problem, without a special database index. When an
   alert arrives, the service's row is locked (`SELECT ... FOR UPDATE`)
   for the length of the transaction, so two alerts for the same service
   are handled one after the other and the second one finds the first
   one's incident. A partial unique index would also work, but Prisma
   can't describe one in the schema, and the lock is easier to follow.

5. Incident numbers (INC-1, INC-2) come from a counter on the
   organization, increased inside the same transaction. Counting existing
   incidents would hand two alerts the same number.

6. Acknowledge and Resolve are a conditional update ("set to acknowledged
   where the status is still triggered"). If nothing was updated, someone
   else got there first and the API answers 409 with who it was. No locks
   needed.

7. Escalation timers are BullMQ jobs in Redis, not `setTimeout`. A job has
   a fixed id per incident, step and round, so it can't be queued twice,
   and it is still there after the server restarts. The worker runs inside
   the API process; a separate worker process is the next step if it ever
   needs to scale.

8. A job checks the incident again when it runs. If it has been
   acknowledged meanwhile, the job does nothing. That is simpler and safer
   than trying to cancel every job at the right moment.

9. On-call is calculated, not stored. Who is on call is worked out from
   the schedule's start date, rotation and timezone each time it is asked
   (with luxon, so daylight saving is right). There is no table of shifts
   to keep in sync.

10. If nobody is on call for a schedule, the owners and admins are emailed
    instead, and the timeline says so. An alert must never go nowhere.

11. Email buttons work without logging in. Each email carries two
    single-use tokens; only their hashes are stored. The link opens a
    confirm page first, because mail scanners follow links and would
    otherwise acknowledge incidents by themselves.

12. Someone who turns incident emails off is skipped, the timeline records
    it, and the incident escalates as normal when the timer runs out.

13. Small helpers live in the service that uses them. Hashing a token or
    making a slug is a few lines, and reading one file top to bottom is
    easier than following imports. Only bigger pieces (the on-call
    calculation, the webhook formats) have their own file.

14. The web app has one accent colour, and it is the text colour. Red and
    amber are kept only for incident status and severity, so colour always
    means something.
