import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// User-provided text (like a name) must be escaped before going into HTML.
// Otherwise a user named `<a href="evil.com">Click</a>` could inject links
// into the emails we send.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );

    this.from = this.configService.getOrThrow<string>('MAIL_FROM');

    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    if (!this.frontendUrl) {
      throw new Error('FRONTEND_URL must be set (e.g. http://localhost:3000)');
    }
  }

  async sendForgotPasswordEmail(
    email: string,
    name: string,
    resetToken: string,
  ) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Reset your VIGIL password',
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reset your VIGIL password</title>
        </head>

        <body style="
          margin: 0;
          padding: 0;
          background-color: #08090a;
          font-family: Arial, Helvetica, sans-serif;
          color: #e5e7eb;
        ">

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="background-color: #08090a; padding: 40px 20px;"
          >
            <tr>
              <td align="center">

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    max-width: 520px;
                    background-color: #111315;
                    border: 1px solid #24282b;
                    border-radius: 12px;
                    overflow: hidden;
                  "
                >

                  <!-- Header -->
                  <tr>
                    <td style="padding: 28px 32px 20px;">
                      <div style="
                        font-size: 22px;
                        font-weight: 700;
                        letter-spacing: 3px;
                        color: #f5f5f5;
                      ">
                        <span style="color: #10b981;">V</span>IGIL
                      </div>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 32px 36px;">

                      <h1 style="
                        margin: 0 0 16px;
                        font-size: 28px;
                        line-height: 1.3;
                        color: #f5f5f5;
                      ">
                        Reset your password
                      </h1>

                      <p style="
                        margin: 0 0 12px;
                        font-size: 15px;
                        line-height: 1.6;
                        color: #a1a1aa;
                      ">
                        Hi ${escapeHtml(name)},
                      </p>

                      <p style="
                        margin: 0 0 28px;
                        font-size: 15px;
                        line-height: 1.6;
                        color: #a1a1aa;
                      ">
                        We received a request to reset the password
                        for your VIGIL account.
                      </p>

                      <!-- Button -->
                      <table
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                      >
                        <tr>
                          <td
                            align="center"
                            style="
                              border-radius: 7px;
                              background-color: #10b981;
                            "
                          >
                            <a
                              href="${resetUrl}"
                              style="
                                display: inline-block;
                                padding: 13px 24px;
                                font-size: 14px;
                                font-weight: 600;
                                color: #06130e;
                                text-decoration: none;
                                border-radius: 7px;
                              "
                            >
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="
                        margin: 28px 0 8px;
                        font-size: 13px;
                        line-height: 1.6;
                        color: #71717a;
                      ">
                        This link will expire in 5 minutes.
                      </p>

                      <p style="
                        margin: 0;
                        font-size: 13px;
                        line-height: 1.6;
                        color: #71717a;
                      ">
                        If you didn't request a password reset, you can
                        safely ignore this email.
                      </p>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="
                      padding: 20px 32px;
                      border-top: 1px solid #24282b;
                    ">
                      <p style="
                        margin: 0;
                        font-size: 12px;
                        color: #52525b;
                      ">
                        © ${new Date().getFullYear()} VIGIL. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>

              </td>
            </tr>
          </table>

        </body>
      </html>
    `,
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to send password reset email: ${error.message}`,
      );
    }

    return data;
  }

  async sendPasswordResetSuccessEmail(email: string, name: string) {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Your VIGIL password was reset',
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Password Reset Successful</title>
        </head>

        <body style="
          margin: 0;
          padding: 40px 20px;
          background-color: #08090a;
          font-family: Arial, Helvetica, sans-serif;
          color: #e5e7eb;
        ">

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="background-color: #08090a;"
          >
            <tr>
              <td align="center">

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    max-width: 520px;
                    background-color: #111315;
                    border: 1px solid #24282b;
                    border-radius: 12px;
                    overflow: hidden;
                  "
                >

                  <!-- Header -->
                  <tr>
                    <td style="padding: 28px 32px 20px;">
                      <div style="
                        font-size: 22px;
                        font-weight: 700;
                        letter-spacing: 3px;
                        color: #f5f5f5;
                      ">
                        <span style="color: #10b981;">V</span>IGIL
                      </div>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 32px 36px;">

                      <h1 style="
                        margin: 0 0 16px;
                        font-size: 26px;
                        line-height: 1.3;
                        color: #f5f5f5;
                      ">
                        Password reset successful
                      </h1>

                      <p style="
                        margin: 0 0 12px;
                        font-size: 15px;
                        line-height: 1.6;
                        color: #a1a1aa;
                      ">
                        Hi ${escapeHtml(name)},
                      </p>

                      <p style="
                        margin: 0 0 20px;
                        font-size: 15px;
                        line-height: 1.6;
                        color: #a1a1aa;
                      ">
                        Your VIGIL account password has been
                        successfully reset.
                      </p>

                      <div style="
                        padding: 14px 16px;
                        background-color: #0d1915;
                        border: 1px solid #164e3b;
                        border-radius: 8px;
                        margin-bottom: 24px;
                      ">
                        <p style="
                          margin: 0;
                          font-size: 14px;
                          color: #10b981;
                        ">
                          Your account is secure and ready to use.
                        </p>
                      </div>

                      <p style="
                        margin: 0;
                        font-size: 13px;
                        line-height: 1.6;
                        color: #71717a;
                      ">
                        If you did not make this change, please secure
                        your account immediately and contact support.
                      </p>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="
                      padding: 20px 32px;
                      border-top: 1px solid #24282b;
                    ">
                      <p style="
                        margin: 0;
                        font-size: 12px;
                        color: #52525b;
                      ">
                        © ${new Date().getFullYear()} VIGIL.
                        All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>

              </td>
            </tr>
          </table>

        </body>
      </html>
    `,
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to send password reset confirmation email: ${error.message}`,
      );
    }

    return data;
  }
}
