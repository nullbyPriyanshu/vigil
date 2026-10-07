import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from 'src/auth/auth.constants';
import type { JwtPayload } from 'src/auth/auth.guard';

@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const origin = client.handshake.headers.origin;
    if (origin && frontendUrl && origin !== frontendUrl) {
      client.disconnect();
      return;
    }

    const token = this.getToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await client.join(`org:${payload.orgId}`);
    } catch {
      client.disconnect();
    }
  }

  private getToken(client: Socket) {
    const auth = client.handshake.auth as { token?: string };
    if (auth.token) {
      return auth.token;
    }

    const cookies = (client.handshake.headers.cookie ?? '').split('; ');
    const cookie = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    return cookie ? cookie.slice(ACCESS_TOKEN_COOKIE.length + 1) : null;
  }
}
