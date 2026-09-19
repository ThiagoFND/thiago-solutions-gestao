import { Injectable } from '@nestjs/common';
/** WebSocket transport disabled: clients refresh through authorized HTTP endpoints. */
@Injectable()
export class EventsGateway {
  emitStock(_payload: unknown) {}
  emitOrder(_payload: unknown) {}
  emitProduction(_payload: unknown) {}
}
