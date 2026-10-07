import type { Page } from "@playwright/test";

// The tests sign in as their own person in their own organization, so
// nothing they do can touch real data. resend.dev is Resend's test inbox:
// mail sent there is accepted and thrown away.
export const TEST_USER = {
  name: "E2E Tester",
  email: "delivered+e2e@resend.dev",
  password: "Vigil@e2e-12345",
  organizationName: "E2E Tests",
};

export const TEST_SERVICE = "E2E Checkout";

// Calls the API from inside the page, so the login cookie is sent along.
export async function api<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      return { status: response.status, data: text ? JSON.parse(text) : null };
    },
    { method, path, body },
  );
}

// Signs in as the test person, creating the account the first time, and
// makes sure the organization has a team, a policy and a service to use.
export async function signInWithSetup(page: Page) {
  await page.goto("/login");

  const { email, password } = TEST_USER;
  const login = await api(page, "POST", "/auth/login", { email, password });
  if (login.status !== 200 && login.status !== 201) {
    const signup = await api(page, "POST", "/auth/signup", TEST_USER);
    if (signup.status >= 400) {
      throw new Error(`Could not create the test account: ${JSON.stringify(signup.data)}`);
    }
    // Sign in explicitly, whether or not signing up already did.
    await api(page, "POST", "/auth/login", { email, password });
  }

  const me = await api<{ user: { id: string } }>(page, "GET", "/auth/me");

  const teams = await api<{ data: { id: string }[] }>(page, "GET", "/teams");
  let teamId = teams.data.data[0]?.id;
  if (!teamId) {
    const team = await api<{ id: string }>(page, "POST", "/teams", {
      name: "E2E Team",
      memberIds: [me.data.user.id],
    });
    teamId = team.data.id;
  }

  const policies = await api<{ data: { id: string }[] }>(page, "GET", "/escalation-policies");
  let policyId = policies.data.data[0]?.id;
  if (!policyId) {
    const policy = await api<{ id: string }>(page, "POST", "/escalation-policies", {
      name: "E2E Policy",
      repeatCount: 0,
      steps: [
        { position: 1, delayMinutes: 30, targetType: "USER", targetId: me.data.user.id },
      ],
    });
    policyId = policy.data.id;
  }

  const services = await api<{ data: { id: string; name: string }[] }>(page, "GET", "/services");
  let service = services.data.data.find((s) => s.name === TEST_SERVICE);
  if (!service) {
    const created = await api<{ id: string; name: string }>(page, "POST", "/services", {
      name: TEST_SERVICE,
      teamId,
      escalationPolicyId: policyId,
    });
    service = created.data;
  }

  return { serviceId: service.id };
}
