export type Email = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const p = (html: string, color = '#18181b') =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${color};">${html}</p>`;

const button = (href: string, label: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr>
      <td style="border-radius:6px;background:#18181b;">
        <a href="${href}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
      </td>
    </tr>
  </table>`;

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
            <tr>
              <td style="padding-bottom:32px;font-size:13px;font-weight:700;letter-spacing:2px;color:#18181b;">VIGIL</td>
            </tr>
            <tr>
              <td>${body}</td>
            </tr>
            <tr>
              <td style="padding-top:24px;border-top:1px solid #e4e4e7;font-size:12px;line-height:18px;color:#a1a1aa;">
                Vigil &middot; On-call and incident management
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function forgotPasswordEmail(opts: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Email {
  const name = escapeHtml(opts.name);
  const subject = 'Reset your Vigil password';

  const html = layout(
    subject,
    [
      p(`Hi ${name},`),
      p(
        `We got a request to reset the password for your Vigil account. The link below expires in ${opts.expiresInMinutes} minutes.`,
      ),
      button(opts.resetUrl, 'Reset password'),
      p(
        `Or paste this link into your browser:<br /><a href="${opts.resetUrl}" style="color:#52525b;word-break:break-all;">${opts.resetUrl}</a>`,
        '#52525b',
      ),
      p(
        "If you didn't ask for this, you can ignore this email. Your password won't change.",
        '#71717a',
      ),
    ].join(''),
  );

  const text = `Hi ${opts.name},

We got a request to reset the password for your Vigil account. This link expires in ${opts.expiresInMinutes} minutes:

${opts.resetUrl}

If you didn't ask for this, you can ignore this email. Your password won't change.

Vigil`;

  return { subject, html, text };
}

function securityNotice(opts: {
  subject: string;
  name: string;
  what: string;
  forgotUrl: string;
}): Email {
  const name = escapeHtml(opts.name);

  const html = layout(
    opts.subject,
    [
      p(`Hi ${name},`),
      p(`${opts.what} You've been signed out on your other devices.`),
      p(
        `If this wasn't you, <a href="${opts.forgotUrl}" style="color:#18181b;">reset your password</a> right away and let your organization owner know.`,
        '#52525b',
      ),
    ].join(''),
  );

  const text = `Hi ${opts.name},

${opts.what} You've been signed out on your other devices.

If this wasn't you, reset your password right away and let your organization owner know:
${opts.forgotUrl}

Vigil`;

  return { subject: opts.subject, html, text };
}

export function passwordResetEmail(opts: {
  name: string;
  forgotUrl: string;
}): Email {
  return securityNotice({
    subject: 'Your Vigil password was reset',
    name: opts.name,
    what: 'The password for your Vigil account was just reset using a reset link.',
    forgotUrl: opts.forgotUrl,
  });
}

export function passwordChangedEmail(opts: {
  name: string;
  changedAt: string;
  forgotUrl: string;
}): Email {
  return securityNotice({
    subject: 'Your Vigil password was changed',
    name: opts.name,
    what: `The password for your Vigil account was changed from your profile settings on ${escapeHtml(opts.changedAt)}.`,
    forgotUrl: opts.forgotUrl,
  });
}

export function invitationEmail(opts: {
  inviterName: string;
  organizationName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresInDays: number;
}): Email {
  const inviter = escapeHtml(opts.inviterName);
  const organization = escapeHtml(opts.organizationName);
  // Organization names are user-provided, so the subject uses the raw text
  // (subjects aren't HTML) and the body uses the escaped one.
  const subject = `${opts.inviterName} invited you to ${opts.organizationName} on Vigil`;

  const html = layout(
    escapeHtml(subject),
    [
      p('Hi,'),
      p(
        `${inviter} invited you to join <strong>${organization}</strong> on Vigil as ${
          /^[aeiou]/i.test(opts.roleLabel) ? 'an' : 'a'
        } ${opts.roleLabel.toLowerCase()}.`,
      ),
      button(opts.acceptUrl, 'Accept invitation'),
      p(
        `Or paste this link into your browser:<br /><a href="${opts.acceptUrl}" style="color:#52525b;word-break:break-all;">${opts.acceptUrl}</a>`,
        '#52525b',
      ),
      p(
        `This invitation expires in ${opts.expiresInDays} days. If you weren't expecting it, you can ignore this email.`,
        '#71717a',
      ),
    ].join(''),
  );

  const text = `Hi,

${opts.inviterName} invited you to join ${opts.organizationName} on Vigil as ${
    /^[aeiou]/i.test(opts.roleLabel) ? 'an' : 'a'
  } ${opts.roleLabel.toLowerCase()}.

Accept the invitation:
${opts.acceptUrl}

This invitation expires in ${opts.expiresInDays} days. If you weren't expecting it, you can ignore this email.

Vigil`;

  return { subject, html, text };
}

export function incidentEmail(opts: {
  name: string;
  incidentNumber: number;
  title: string;
  severity: string;
  serviceName: string;
  acknowledgeUrl: string;
  resolveUrl: string;
  incidentUrl: string;
}): Email {
  const subject = `[${opts.severity}] INC-${opts.incidentNumber}: ${opts.title}`;

  const html = layout(
    escapeHtml(subject),
    [
      p(`Hi ${escapeHtml(opts.name)},`),
      p(
        `<strong>${escapeHtml(opts.title)}</strong><br />INC-${opts.incidentNumber} &middot; ${escapeHtml(opts.serviceName)} &middot; ${opts.severity}`,
      ),
      button(opts.acknowledgeUrl, 'Acknowledge'),
      p(
        `<a href="${opts.resolveUrl}" style="color:#52525b;">Resolve it</a> &nbsp;&middot;&nbsp; <a href="${opts.incidentUrl}" style="color:#52525b;">Open the incident</a>`,
        '#52525b',
      ),
      p(
        'You got this email because you are next in line for this service. The links work for 24 hours.',
        '#71717a',
      ),
    ].join(''),
  );

  const text = `Hi ${opts.name},

${opts.title}
INC-${opts.incidentNumber} - ${opts.serviceName} - ${opts.severity}

Acknowledge:
${opts.acknowledgeUrl}

Resolve:
${opts.resolveUrl}

Open the incident:
${opts.incidentUrl}

Vigil`;

  return { subject, html, text };
}
